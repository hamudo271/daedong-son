/**
 * 사이트 공용 콘텐츠 관리(CMS) — 유튜브 영상 · 전문칼럼 · 성공 사례
 * - 저장소: Cloudflare D1 (env.DB)
 * - 관리자 로그인: env.ADMIN_PASSWORD(Cloudflare 비밀값) 또는 관리자 화면에서 바꾼 비밀번호(PBKDF2 해시, D1 settings)
 * - 세션: HttpOnly·Secure·SameSite=Strict 쿠키, HMAC 서명(키는 D1에 처음 한 번 무작위 생성), 비밀번호를 바꾸면 기존 세션 무효
 * - 본문 HTML은 저장할 때 허용 목록으로 정리(HTMLRewriter)
 * - 사이트마다 쓰는 종류(site.kinds)만 관리자에 보인다. 기본은 ['youtube','column'].
 *   'case'(성공 사례)는 보험사 제시액·손해사정 결과를 extra(JSON)에 담는다.
 * 해운누리(Pages Functions)·형통(Workers)·대동(Workers)이 같은 파일을 쓴다. 원본: deliverables/cms-core/core.js
 */
const enc = new TextEncoder();
export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// magazine·tip: 대동 '손해사정 사례' 메뉴의 매거진·팁(2026-10-14). 저장 규칙은 전문칼럼과 같다(본문 필수).
export const KINDS = ['youtube', 'column', 'case', 'magazine', 'tip'];
export const KIND_LABEL = { youtube: '유튜브 영상', column: '전문칼럼', case: '성공 사례', magazine: '매거진', tip: '뉴스룸' };
const siteKinds = (site) => (Array.isArray(site?.kinds) && site.kinds.length ? site.kinds.filter((k) => KINDS.includes(k)) : ['youtube', 'column']);

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL CHECK (kind IN ('youtube','column','case','magazine','tip')),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
    title TEXT NOT NULL,
    summary TEXT NOT NULL DEFAULT '',
    body TEXT NOT NULL DEFAULT '',
    video_id TEXT,
    category TEXT NOT NULL DEFAULT '',
    author TEXT NOT NULL DEFAULT '',
    cover_id INTEGER,
    pinned INTEGER NOT NULL DEFAULT 0,
    published_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    views INTEGER NOT NULL DEFAULT 0,
    extra TEXT NOT NULL DEFAULT '{}')`,
  `CREATE INDEX IF NOT EXISTS posts_list ON posts(kind, status, pinned DESC, published_at DESC, id DESC)`,
  `CREATE TABLE IF NOT EXISTS media (id INTEGER PRIMARY KEY AUTOINCREMENT, mime TEXT NOT NULL, bytes BLOB NOT NULL, w INTEGER, h INTEGER, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS settings (k TEXT PRIMARY KEY, v TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS login_fail (ip TEXT PRIMARY KEY, n INTEGER NOT NULL, until INTEGER NOT NULL)`,
];
let ready = false;
export async function ensure(db) {
  if (ready) return;
  await db.batch(SCHEMA.map((s) => db.prepare(s)));
  // 예전 데이터베이스(해운누리·형통)에는 extra 열이 없다 → 한 번만 추가
  const cols = (await db.prepare('PRAGMA table_info(posts)').all()).results.map((c) => c.name);
  if (!cols.includes('extra')) await db.prepare("ALTER TABLE posts ADD COLUMN extra TEXT NOT NULL DEFAULT '{}'").run();
  ready = true;
}
/** extra(JSON 문자열) → 객체. 깨진 값은 빈 객체 */
export function parseExtra(v) {
  if (v && typeof v === 'object') return v;
  try {
    const o = JSON.parse(v || '{}');
    return o && typeof o === 'object' ? o : {};
  } catch {
    return {};
  }
}

/* ---------------- 공통 도구 ---------------- */
const getSetting = async (db, k) => (await db.prepare('SELECT v FROM settings WHERE k=?').bind(k).first())?.v ?? null;
const setSetting = (db, k, v) => db.prepare('INSERT INTO settings(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v').bind(k, String(v)).run();
const hex = (buf) => [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, '0')).join('');
const randHex = (n) => hex(crypto.getRandomValues(new Uint8Array(n)));
const fromHex = (h) => new Uint8Array(h.match(/../g).map((x) => parseInt(x, 16)));
const sha256 = async (s) => hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));
function same(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
async function pbkdf2(pw, saltHex) {
  const key = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: fromHex(saltHex), iterations: 100000 }, key, 256));
}
/** 한국 시간 기준 오늘 날짜 YYYY-MM-DD */
export const todayKST = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const nowISO = () => new Date().toISOString();
const json = (o, s = 200, h = {}) =>
  new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...h } });

/* ---------------- 로그인·세션 ---------------- */
async function hmac(db, data) {
  let k = await getSetting(db, 'session_key');
  if (!k) {
    k = randHex(32);
    await setSetting(db, 'session_key', k);
  }
  const key = await crypto.subtle.importKey('raw', enc.encode(k), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
}
const pwVer = async (db) => (await getSetting(db, 'pw_ver')) || '0';
async function newSession(db) {
  const exp = Date.now() + 12 * 3600e3;
  return `${exp}.${await hmac(db, `${exp}.${await pwVer(db)}`)}`;
}
export async function isAdmin(req, db) {
  const m = (req.headers.get('Cookie') || '').match(/(?:^|;\s*)cms_s=([0-9]+)\.([0-9a-f]{64})/);
  if (!m || Number(m[1]) < Date.now()) return false;
  return same(await hmac(db, `${m[1]}.${await pwVer(db)}`), m[2]);
}
const cookie = (v, age) => `cms_s=${v}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${age}`;
async function checkPassword(env, pw) {
  const h = await getSetting(env.DB, 'pw_hash');
  if (h) {
    const [salt, want] = h.split(':');
    return same(await pbkdf2(pw, salt), want);
  }
  if (!env.ADMIN_PASSWORD) return null; // 아직 비밀번호가 설정되지 않음
  return same(await sha256(pw), await sha256(env.ADMIN_PASSWORD));
}
const clientIP = (req) => req.headers.get('CF-Connecting-IP') || 'local';

/* ---------------- 유튜브 ---------------- */
export function youtubeId(input) {
  const s = String(input || '').trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  const m = s.match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/|v\/))([\w-]{11})/);
  return m ? m[1] : null;
}

/* ---------------- 본문 정리(허용 목록) ---------------- */
const ALLOW = {
  p: [], br: [], h2: [], h3: [], h4: [], strong: [], b: [], em: [], i: [], u: [], s: [], blockquote: [], ul: [], ol: [], li: [],
  a: ['href', 'target'], img: ['src', 'alt', 'width', 'height'], figure: [], figcaption: [], hr: [], span: [], div: [],
  iframe: ['src', 'title'],
};
const DROP = new Set(['script', 'style', 'object', 'embed', 'form', 'input', 'button', 'textarea', 'select', 'option', 'link', 'meta', 'svg', 'math', 'template', 'noscript', 'head', 'title', 'base', 'frame', 'frameset', 'applet']);
export async function sanitize(html) {
  const rw = new HTMLRewriter()
    .on('*', {
      element(el) {
        const t = el.tagName.toLowerCase();
        if (DROP.has(t)) return el.remove();
        if (!(t in ALLOW)) return el.removeAndKeepContent();
        const keep = ALLOW[t];
        for (const [name] of [...el.attributes]) if (!keep.includes(name)) el.removeAttribute(name);
        if (t === 'a') {
          const h = el.getAttribute('href') || '';
          if (!/^(https?:\/\/|mailto:|tel:|\/|#)/i.test(h)) el.removeAttribute('href');
          if (el.getAttribute('target') !== '_blank') el.removeAttribute('target');
          el.setAttribute('rel', 'noopener nofollow');
        }
        if (t === 'img') {
          const s = el.getAttribute('src') || '';
          if (!/^(\/media\/\d+|https:\/\/)/.test(s)) return el.remove();
          el.setAttribute('loading', 'lazy');
        }
        if (t === 'iframe') {
          const s = el.getAttribute('src') || '';
          if (!/^https:\/\/www\.youtube(-nocookie)?\.com\/embed\/[\w-]{11}/.test(s)) return el.remove();
          el.setAttribute('allowfullscreen', '');
          el.setAttribute('loading', 'lazy');
        }
      },
    })
    .onDocument({ comments: (c) => c.remove() });
  const out = await rw.transform(new Response(String(html || ''), { headers: { 'content-type': 'text/html; charset=utf-8' } })).text();
  return out.trim();
}
const plain = (html) => String(html || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

/* ---------------- 글 저장 ---------------- */
/** '12,000만 원' → 12000, '지급거절' → 0. 숫자 칸이 비어 있으면 금액 문구에서 숫자만 뽑는다 */
export function amountNum(num, text) {
  const n = String(num ?? '').trim();
  if (n !== '' && Number.isFinite(+n) && +n >= 0) return Math.round(+n);
  return parseInt(String(text || '').replace(/[^\d]/g, ''), 10) || 0;
}
async function normalize(b, allowed = ['youtube', 'column']) {
  const kind = KINDS.includes(b.kind) && allowed.includes(b.kind) ? b.kind : null;
  if (!kind) throw new Error('콘텐츠 종류가 올바르지 않습니다.');
  const title = String(b.title || '').trim().slice(0, 200);
  if (!title) throw new Error('제목을 입력해 주세요.');
  const p = {
    kind,
    title,
    status: b.status === 'published' ? 'published' : 'draft',
    summary: String(b.summary || '').trim().slice(0, 600),
    category: String(b.category || '').trim().slice(0, 40),
    author: String(b.author || '').trim().slice(0, 40),
    pinned: b.pinned ? 1 : 0,
    published_at: /^\d{4}-\d{2}-\d{2}$/.test(b.published_at || '') ? b.published_at : todayKST(),
    cover_id: Number.isInteger(+b.cover_id) && +b.cover_id > 0 ? +b.cover_id : null,
    video_id: null,
    body: '',
    extra: '{}',
  };
  if (kind === 'youtube') {
    p.video_id = youtubeId(b.video_id || b.url);
    if (!p.video_id) throw new Error('유튜브 주소를 확인해 주세요.');
  } else if (kind === 'case') {
    // 성공 사례: 요약(카드 문구)은 필수, 상세 내용은 선택
    const x = parseExtra(b.extra);
    const before = String(x.before || '').trim().slice(0, 40);
    const after = String(x.after || '').trim().slice(0, 40);
    if (!before) throw new Error('보험사 제시액을 입력해 주세요. (예: 12,000만 원 · 지급거절)');
    if (!after) throw new Error('손해사정 결과 금액을 입력해 주세요. (예: 23,000만 원)');
    if (!p.summary) throw new Error('사례 요약을 입력해 주세요.');
    p.extra = JSON.stringify({
      before_label: String(x.before_label || '').trim().slice(0, 30) || '보험사 제시액',
      before,
      before_num: amountNum(x.before_num, before),
      after,
      after_num: amountNum(x.after_num, after),
    });
    p.body = await sanitize(String(b.body || '').slice(0, 300000));
    if (!plain(p.body)) p.body = '';
  } else {
    p.body = await sanitize(String(b.body || '').slice(0, 300000));
    if (!plain(p.body)) throw new Error('본문을 입력해 주세요.');
    if (!p.summary) p.summary = plain(p.body).slice(0, 140);
  }
  return p;
}

/* ---------------- 관리자 API ---------------- */
export async function handleApi(req, env, site) {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, '');
  const db = env.DB;
  await ensure(db);

  const kinds = siteKinds(site);
  const pickKind = (v) => (kinds.includes(v) ? v : kinds[0]);
  if (path === '/api/cms/config') {
    const configured = !!(env.ADMIN_PASSWORD || (await getSetting(db, 'pw_hash')));
    const labels = { ...KIND_LABEL, ...(site.labels || {}) };
    return json({ name: site.name, color: site.color, home: site.home, urls: site.urls, authors: site.authors, kinds, labels, configured });
  }
  if (path === '/api/cms/login' && req.method === 'POST') {
    const ip = clientIP(req);
    const f = await db.prepare('SELECT n, until FROM login_fail WHERE ip=?').bind(ip).first();
    if (f && f.until > Date.now()) return json({ error: '로그인 시도가 많습니다. 15분 뒤에 다시 시도해 주세요.' }, 429);
    const body = await req.json().catch(() => ({}));
    const ok = await checkPassword(env, String(body.password || ''));
    if (ok === null) return json({ error: '관리자 비밀번호가 아직 설정되지 않았습니다.' }, 503);
    if (!ok) {
      const n = (f?.n || 0) + 1;
      await db
        .prepare('INSERT INTO login_fail(ip,n,until) VALUES(?,?,?) ON CONFLICT(ip) DO UPDATE SET n=excluded.n, until=excluded.until')
        .bind(ip, n >= 8 ? 0 : n, n >= 8 ? Date.now() + 15 * 60e3 : 0)
        .run();
      return json({ error: '비밀번호가 맞지 않습니다.' }, 401);
    }
    await db.prepare('DELETE FROM login_fail WHERE ip=?').bind(ip).run();
    return json({ ok: true }, 200, { 'set-cookie': cookie(await newSession(db), 43200) });
  }
  if (path === '/api/cms/logout' && req.method === 'POST') return json({ ok: true }, 200, { 'set-cookie': cookie('', 0) });

  if (!(await isAdmin(req, db))) return json({ error: '로그인이 필요합니다.' }, 401);
  if (req.method !== 'GET') {
    if (req.headers.get('X-CMS') !== '1') return json({ error: '잘못된 요청입니다.' }, 400);
    const o = req.headers.get('Origin');
    if (o && o !== url.origin) return json({ error: '허용되지 않은 요청입니다.' }, 403);
  }

  try {
    if (path === '/api/cms/me') return json({ ok: true });

    if (path === '/api/cms/posts' && req.method === 'GET') {
      const kind = pickKind(url.searchParams.get('kind'));
      const q = (url.searchParams.get('q') || '').trim();
      const page = Math.max(1, +url.searchParams.get('page') || 1);
      const per = 20;
      const where = ['kind=?'];
      const args = [kind];
      if (q) {
        where.push('(title LIKE ? OR category LIKE ? OR author LIKE ?)');
        args.push(`%${q}%`, `%${q}%`, `%${q}%`);
      }
      const st = url.searchParams.get('status');
      if (st === 'draft' || st === 'published') {
        where.push('status=?');
        args.push(st);
      }
      const w = where.join(' AND ');
      const total = (await db.prepare(`SELECT COUNT(*) c FROM posts WHERE ${w}`).bind(...args).first()).c;
      const rows = (
        await db
          .prepare(`SELECT id,kind,status,title,category,author,video_id,cover_id,pinned,published_at,updated_at,views FROM posts WHERE ${w} ORDER BY pinned DESC, published_at DESC, id DESC LIMIT ? OFFSET ?`)
          .bind(...args, per, (page - 1) * per)
          .all()
      ).results;
      return json({ items: rows, total, page, pages: Math.max(1, Math.ceil(total / per)) });
    }
    if (path === '/api/cms/posts' && req.method === 'POST') {
      const p = await normalize(await req.json(), kinds);
      const t = nowISO();
      const r = await db
        .prepare('INSERT INTO posts(kind,status,title,summary,body,video_id,category,author,cover_id,pinned,published_at,created_at,updated_at,extra) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
        .bind(p.kind, p.status, p.title, p.summary, p.body, p.video_id, p.category, p.author, p.cover_id, p.pinned, p.published_at, t, t, p.extra)
        .run();
      return json({ ok: true, id: r.meta.last_row_id });
    }
    const pm = path.match(/^\/api\/cms\/posts\/(\d+)$/);
    if (pm) {
      const id = +pm[1];
      if (req.method === 'GET') {
        const row = await db.prepare('SELECT * FROM posts WHERE id=?').bind(id).first();
        return row ? json(row) : json({ error: '글을 찾을 수 없습니다.' }, 404);
      }
      if (req.method === 'PUT') {
        const p = await normalize(await req.json(), kinds);
        await db
          // pinned: 고정 체크 유지 시 기존 고정 순위값(3·2·1 등)을 보존 — 사례 노출 순서(2026-10-14 사무소 요청)가 수정 저장으로 깨지지 않게
          .prepare('UPDATE posts SET kind=?,status=?,title=?,summary=?,body=?,video_id=?,category=?,author=?,cover_id=?,pinned=CASE WHEN ?=1 AND pinned>0 THEN pinned ELSE ? END,published_at=?,updated_at=?,extra=? WHERE id=?')
          .bind(p.kind, p.status, p.title, p.summary, p.body, p.video_id, p.category, p.author, p.cover_id, p.pinned, p.pinned, p.published_at, nowISO(), p.extra, id)
          .run();
        return json({ ok: true, id });
      }
      if (req.method === 'DELETE') {
        await db.prepare('DELETE FROM posts WHERE id=?').bind(id).run();
        return json({ ok: true });
      }
    }
    if (path === '/api/cms/media' && req.method === 'POST') {
      const type = (req.headers.get('content-type') || '').split(';')[0];
      if (!/^image\/(jpeg|png|webp|gif)$/.test(type)) return json({ error: '이미지 파일(JPG·PNG·WEBP)만 올릴 수 있습니다.' }, 415);
      const buf = await req.arrayBuffer();
      if (buf.byteLength > 1_800_000) return json({ error: '이미지가 너무 큽니다(최대 1.8MB).' }, 413);
      const w = +url.searchParams.get('w') || null;
      const h = +url.searchParams.get('h') || null;
      const r = await db.prepare('INSERT INTO media(mime,bytes,w,h,created_at) VALUES(?,?,?,?,?)').bind(type, buf, w, h, nowISO()).run();
      return json({ ok: true, id: r.meta.last_row_id, url: `/media/${r.meta.last_row_id}` });
    }
    if (path === '/api/cms/oembed') {
      const id = youtubeId(url.searchParams.get('url'));
      if (!id) return json({ error: '유튜브 주소를 확인해 주세요.' }, 400);
      const r = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent('https://www.youtube.com/watch?v=' + id)}`);
      if (!r.ok) return json({ id, title: '', author: '', note: '영상 정보를 불러오지 못했습니다(비공개·삭제 영상일 수 있음).' });
      const o = await r.json();
      return json({ id, title: o.title || '', author: o.author_name || '' });
    }
    if (path === '/api/cms/categories') {
      const kind = pickKind(url.searchParams.get('kind'));
      const rows = (await db.prepare("SELECT DISTINCT category c FROM posts WHERE kind=? AND category<>'' ORDER BY category").bind(kind).all()).results;
      return json(rows.map((r) => r.c));
    }
    if (path === '/api/cms/password' && req.method === 'POST') {
      const b = await req.json();
      const ok = await checkPassword(env, String(b.current || ''));
      if (!ok) return json({ error: '현재 비밀번호가 맞지 않습니다.' }, 400);
      const next = String(b.next || '');
      if (next.length < 10) return json({ error: '새 비밀번호는 10자 이상으로 정해 주세요.' }, 400);
      const salt = randHex(16);
      await setSetting(db, 'pw_hash', `${salt}:${await pbkdf2(next, salt)}`);
      await setSetting(db, 'pw_ver', String(Date.now()));
      return json({ ok: true }, 200, { 'set-cookie': cookie(await newSession(db), 43200) });
    }
  } catch (e) {
    return json({ error: e.message || '처리 중 오류가 발생했습니다.' }, 400);
  }
  return json({ error: '없는 주소입니다.' }, 404);
}

/* ---------------- 공개 화면용 데이터 ---------------- */
export async function serveMedia(env, id) {
  await ensure(env.DB);
  const row = await env.DB.prepare('SELECT mime, bytes FROM media WHERE id=?').bind(id).first();
  if (!row) return new Response('Not found', { status: 404 });
  return new Response(new Uint8Array(row.bytes), {
    headers: { 'content-type': row.mime, 'cache-control': 'public, max-age=31536000, immutable' },
  });
}

export async function listPublic(db, kind, { page = 1, per = 12, cat = '' } = {}) {
  await ensure(db);
  const where = ["kind=? AND status='published'"];
  const args = [kind];
  if (cat) {
    where.push('category=?');
    args.push(cat);
  }
  const w = where.join(' AND ');
  const total = (await db.prepare(`SELECT COUNT(*) c FROM posts WHERE ${w}`).bind(...args).first()).c;
  const pages = Math.max(1, Math.ceil(total / per));
  page = Math.min(Math.max(1, page), pages);
  const items = (
    await db
      .prepare(`SELECT id,title,summary,video_id,category,author,cover_id,pinned,published_at,views,extra FROM posts WHERE ${w} ORDER BY pinned DESC, published_at DESC, id DESC LIMIT ? OFFSET ?`)
      .bind(...args, per, (page - 1) * per)
      .all()
  ).results;
  const cats = (await db.prepare("SELECT category c, COUNT(*) n FROM posts WHERE kind=? AND status='published' AND category<>'' GROUP BY category ORDER BY n DESC, category").bind(kind).all()).results;
  return { items, total, page, pages, cats, per };
}

/** 본문 화면용 글 하나 + 목록 순서 기준 이전(더 최근)·다음(더 이전) 글. index는 공개 목록에서의 순번(0부터) */
export async function getPublic(db, id, { preview = false, kind = 'column' } = {}) {
  await ensure(db);
  const row = await db.prepare(`SELECT * FROM posts WHERE id=? AND kind=?${preview ? '' : " AND status='published'"}`).bind(id, kind).first();
  if (!row) return null;
  const order = 'pinned DESC, published_at DESC, id DESC';
  const all = (await db.prepare(`SELECT id,title FROM posts WHERE kind=? AND status='published' ORDER BY ${order}`).bind(kind).all()).results;
  const i = all.findIndex((r) => r.id === row.id);
  return { post: row, index: i, total: all.length, newer: i > 0 ? all[i - 1] : null, older: i >= 0 && i < all.length - 1 ? all[i + 1] : null };
}

export async function bumpViews(db, id) {
  await db.prepare('UPDATE posts SET views=views+1 WHERE id=?').bind(id).run();
}
export { plain };

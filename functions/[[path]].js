/** Cloudflare Pages Functions: 기존 D1 CMS를 Next 정적 산출물에 결합한다. */
import { handleApi, handleInquiry, serveMedia, listPublic, getPublic, isAdmin, bumpViews, plain, esc, ensure } from '../server/core.js';
import { SITE, TYPES, ldScript } from '../lib/site.js';
import { caseTrackHTML, caseListHTML, caseViewHTML, postViewHTML, caseNotFoundHTML } from '../server/render.jsx';

const TYPE_BY_PATH = { '/cases': 'case', '/cases/magazine': 'magazine', '/cases/news': 'tip' };
async function typeCounts(db) {
  const rows = (await db.prepare("SELECT kind, COUNT(*) n FROM posts WHERE status='published' GROUP BY kind").all()).results;
  return Object.fromEntries(rows.map((r) => [r.kind, r.n]));
}
async function asset(env, origin, path) {
  let res = await env.ASSETS.fetch(new Request(new URL(path, origin)));
  for (let i = 0; i < 3 && res.status >= 300 && res.status < 400 && res.headers.get('location'); i++) {
    res = await env.ASSETS.fetch(new Request(new URL(res.headers.get('location'), origin)));
  }
  return res;
}
/**
 * 틀(정적 HTML)에 CMS 내용을 끼워 넣는다.
 * h1ToP: 글 상세는 글 제목이 h1이 되도록 틀의 메뉴 제목(h1.sub-title)을 p로 바꾼다(모양은 클래스로 같음)
 * noindex: 관리자 미리보기·빈 목록은 검색에 올리지 않는다
 */
async function render(env, url, shellPath, { root = '#cms-root', html, status = 200, meta = null, swap = {}, h1ToP = false, noindex = false }) {
  const base = await asset(env, url.origin, shellPath);
  let rw = new HTMLRewriter().on(root, { element: (el) => el.setInnerContent(html, { html: true }) });
  for (const [sel, h] of Object.entries(swap)) rw = rw.on(sel, { element: (el) => el.setInnerContent(h, { html: true }) });
  if (h1ToP) rw = rw.on('h1.sub-title', { element: (el) => { el.tagName = 'p'; } });
  if (noindex) rw = rw.on('head', { element: (el) => el.append('<meta name="robots" content="noindex">', { html: true }) });
  if (meta) {
    // 대표 주소는 항상 SITE.url 기준(Railway 기본 주소·미리보기 주소로 들어와도 같은 canonical)
    const canon = SITE.url + url.pathname;
    rw = rw
      .on('title', { element: (el) => el.setInnerContent(meta.title) })
      .on('meta[name="description"]', { element: (el) => el.setAttribute('content', meta.desc) })
      .on('meta[property="og:title"]', { element: (el) => el.setAttribute('content', meta.title) })
      .on('meta[property="og:description"]', { element: (el) => el.setAttribute('content', meta.desc) })
      .on('meta[property="og:image"]', { element: (el) => meta.image && el.setAttribute('content', meta.image) })
      .on('meta[property="og:type"]', { element: (el) => meta.type && el.setAttribute('content', meta.type) })
      .on('meta[property="og:url"]', { element: (el) => el.setAttribute('content', canon) })
      .on('link[rel="canonical"]', { element: (el) => el.setAttribute('href', canon) })
      .on('head', { element(el) {
        for (const o of [].concat(meta.ld || [])) el.append(ldScript(o), { html: true });
      }});
  }
  const out = rw.transform(base);
  const headers = new Headers(out.headers);
  headers.set('content-type', 'text/html; charset=utf-8');
  headers.set('cache-control', 'no-store');
  headers.delete('etag');
  return new Response(out.body, { status, headers });
}

async function route(ctx, url, p) {
  const { request, env } = ctx;
  const db = env.DB;
  if (p === '/' || p === '/index.html') {
    const d = await listPublic(db, 'case', { page: 1, per: 8 });
    return render(env, url, '/', { root: '#caseTrack', html: caseTrackHTML(d.items) });
  }
  if (p === '/cases.html' || p === '/cases-view' || p === '/cases-view.html') return Response.redirect(url.origin + '/cases' + url.search, 301);
  if (p === '/cases/tip') return Response.redirect(url.origin + '/cases/news' + url.search, 301);
  if (TYPE_BY_PATH[p]) {
    const kind = TYPE_BY_PATH[p];
    const t = TYPES[kind];
    const page = Math.max(1, parseInt(url.searchParams.get('page'), 10) || 1);
    const cat = (url.searchParams.get('cat') || '').slice(0, 40);
    const [d, counts] = await Promise.all([listPublic(db, kind, { page, cat, per: 12 }), typeCounts(db)]);
    const opt = { html: caseListHTML(d, cat, kind, counts), swap: { '.sub-lead': t.lead, '.xbox-p': t.xbox } };
    if (kind !== 'case') opt.meta = { title: t.label + ' | 손해사정 사례 | ' + SITE.name, desc: t.desc };
    // 글이 하나도 없는 매거진·뉴스룸 목록은 빈 페이지라 검색에 올리지 않는다
    if (!d.total) opt.noindex = true;
    return render(env, url, '/cases', opt);
  }
  const m = p.match(/^\/cases\/(\d+)$/);
  if (!m) return null;
  const preview = url.searchParams.has('preview') && (await isAdmin(request, db));
  const row = await db.prepare('SELECT kind FROM posts WHERE id=?').bind(+m[1]).first().catch(() => null);
  const k = row?.kind;
  const r = TYPES[k] ? await getPublic(db, +m[1], { preview, kind: k }) : null;
  if (!r) return render(env, url, '/cases-view.html', { html: caseNotFoundHTML(), status: 404 });
  if (r.post.status === 'published' && !preview) ctx.waitUntil(bumpViews(db, r.post.id));
  const q = r.post;
  const t = TYPES[k];
  const canon = SITE.url + url.pathname;
  const cover = q.cover_id ? SITE.url + '/media/' + q.cover_id : null;
  const desc = (q.summary || plain(q.body)).slice(0, 150);
  return render(env, url, '/cases-view.html', {
    html: k === 'case' ? caseViewHTML(r, preview) : postViewHTML(r, preview),
    swap: { '.sub-lead': t.lead },
    h1ToP: true,
    noindex: preview,
    meta: {
      title: q.title + ' | ' + t.label + ' | ' + SITE.name,
      desc,
      image: cover,
      type: 'article',
      ld: [
        {
          '@context': 'https://schema.org', '@type': 'Article', headline: q.title.slice(0, 110), description: desc,
          datePublished: q.published_at, dateModified: (q.updated_at || q.published_at || '').slice(0, 10),
          image: [cover || SITE.url + '/assets/img/og-default.jpg'],
          author: q.author && q.author !== SITE.name ? { '@type': 'Person', name: q.author } : { '@type': 'Organization', name: SITE.name, url: SITE.url + '/' },
          publisher: { '@type': 'Organization', name: SITE.name, logo: { '@type': 'ImageObject', url: SITE.url + '/assets/img/logo-512.png' } },
          mainEntityOfPage: canon,
        },
        {
          '@context': 'https://schema.org', '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: '홈', item: SITE.url + '/' },
            { '@type': 'ListItem', position: 2, name: t.label, item: SITE.url + t.href },
            { '@type': 'ListItem', position: 3, name: q.title, item: canon },
          ],
        },
      ],
    },
  });
}

/** 검색엔진용 sitemap.xml: 고정 페이지 + 공개된 사례·매거진·뉴스룸 글 */
async function sitemap(db) {
  await ensure(db);
  const rows = (await db.prepare("SELECT id, kind, published_at, updated_at FROM posts WHERE status='published' ORDER BY id").all()).results.filter((r) => TYPES[r.kind]);
  const day = (r) => (r.updated_at || r.published_at || '').slice(0, 10);
  const newest = (kind) => rows.filter((r) => !kind || r.kind === kind).map(day).sort().pop();
  const urls = [['/', newest()], ['/about'], ['/services'], ['/partners'], ['/contact'], ['/cases', newest('case')]];
  if (newest('magazine')) urls.push(['/cases/magazine', newest('magazine')]);
  if (newest('tip')) urls.push(['/cases/news', newest('tip')]);
  for (const r of rows) urls.push(['/cases/' + r.id, day(r)]);
  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map(([u, m]) => `  <url><loc>${esc(SITE.url + u)}</loc>${m ? `<lastmod>${m}</lastmod>` : ''}</url>`).join('\n') +
    '\n</urlset>\n';
  return new Response(xml, { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
}

export async function onRequest(ctx) {
  const { request, env } = ctx;
  const url = new URL(request.url);
  const p = url.pathname.replace(/\/+$/, '') || '/';
  if (p.startsWith('/api/cms/')) return handleApi(request, env, SITE);
  const media = p.match(/^\/media\/(\d+)$/);
  if (media) return serveMedia(env, +media[1]);
  // 상담 신청: site.js가 모든 페이지의 폼에서 '/'로 POST 한다
  if (p === '/' && request.method === 'POST') return handleInquiry(request, env);
  if (request.method !== 'GET' && request.method !== 'HEAD') return ctx.next();
  try {
    if (p === '/sitemap.xml') return await sitemap(env.DB);
    const res = await route(ctx, url, p);
    if (res) return res;
  } catch (e) {
    console.error('route error', p, e?.stack || e);
  }
  return ctx.next();
}

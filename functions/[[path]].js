/** Cloudflare Pages Functions: 기존 D1 CMS를 Next 정적 산출물에 결합한다. */
import { handleApi, serveMedia, listPublic, getPublic, isAdmin, bumpViews, plain, esc } from '../server/core.js';
import { SITE, TYPES } from '../lib/site.js';
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
async function render(env, url, shellPath, { root = '#cms-root', html, status = 200, meta = null, swap = {} }) {
  const base = await asset(env, url.origin, shellPath);
  let rw = new HTMLRewriter().on(root, { element: (el) => el.setInnerContent(html, { html: true }) });
  for (const [sel, h] of Object.entries(swap)) rw = rw.on(sel, { element: (el) => el.setInnerContent(h, { html: true }) });
  if (meta) {
    rw = rw
      .on('title', { element: (el) => el.setInnerContent(meta.title) })
      .on('meta[name="description"]', { element: (el) => el.setAttribute('content', meta.desc) })
      .on('meta[property="og:title"]', { element: (el) => el.setAttribute('content', meta.title) })
      .on('meta[property="og:description"]', { element: (el) => el.setAttribute('content', meta.desc) })
      .on('meta[property="og:image"]', { element: (el) => meta.image && el.setAttribute('content', meta.image) })
      .on('head', { element(el) {
        el.append('<link rel="canonical" href="' + esc(url.origin + url.pathname) + '">', { html: true });
        if (meta.ld) el.append('<script type="application/ld+json">' + JSON.stringify(meta.ld).replace(/</g, '\\u003c') + '</script>', { html: true });
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
  return render(env, url, '/cases-view.html', {
    html: k === 'case' ? caseViewHTML(r, preview) : postViewHTML(r, preview),
    swap: { '.sub-lead': t.lead },
    meta: {
      title: q.title + ' | ' + t.label + ' | ' + SITE.name,
      desc: (q.summary || plain(q.body)).slice(0, 150),
      image: q.cover_id ? url.origin + '/media/' + q.cover_id : null,
      ld: {
        '@context': 'https://schema.org', '@type': 'Article', headline: q.title,
        datePublished: q.published_at, dateModified: (q.updated_at || '').slice(0, 10),
        publisher: { '@type': 'ProfessionalService', name: SITE.name },
        image: q.cover_id ? [url.origin + '/media/' + q.cover_id] : undefined,
        mainEntityOfPage: url.origin + url.pathname,
      },
    },
  });
}

export async function onRequest(ctx) {
  const { request, env } = ctx;
  const url = new URL(request.url);
  const p = url.pathname.replace(/\/+$/, '') || '/';
  if (p.startsWith('/api/cms/')) return handleApi(request, env, SITE);
  const media = p.match(/^\/media\/(\d+)$/);
  if (media) return serveMedia(env, +media[1]);
  if (request.method !== 'GET' && request.method !== 'HEAD') return ctx.next();
  try {
    const res = await route(ctx, url, p);
    if (res) return res;
  } catch (e) {
    console.error('route error', p, e?.stack || e);
  }
  return ctx.next();
}

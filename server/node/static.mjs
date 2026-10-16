/** out/ 정적 파일을 Cloudflare Pages와 같은 규칙으로 내준다(.html 생략 주소, 308 정리, 404.html, _headers). */
import fs from 'node:fs';
import path from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.ttf': 'font/ttf', '.otf': 'font/otf', '.mp4': 'video/mp4', '.webm': 'video/webm', '.pdf': 'application/pdf', '.webmanifest': 'application/manifest+json',
};

/** Pages 경로 규칙(* = 아무 문자열, :name = 한 칸)을 정규식으로 */
export const pattern = (p) =>
  new RegExp('^' + p.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/:[A-Za-z]\w*/g, '[^/]+') + '$');

function parseHeaders(file) {
  if (!fs.existsSync(file)) return [];
  const rules = [];
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    if (!/^\s/.test(line)) rules.push({ re: pattern(line.trim()), set: [] });
    else if (rules.length) {
      const i = line.indexOf(':');
      if (i > 0) rules.at(-1).set.push([line.slice(0, i).trim(), line.slice(i + 1).trim()]);
    }
  }
  return rules;
}

export function createStatic(root) {
  const rules = parseHeaders(path.join(root, '_headers'));
  const isFile = (rel) => {
    const abs = path.join(root, rel);
    if (!abs.startsWith(root + path.sep)) return null;
    try {
      return fs.statSync(abs).isFile() ? abs : null;
    } catch {
      return null;
    }
  };
  const respond = (abs, pathname, status, method) => {
    const headers = new Headers({ 'content-type': TYPES[path.extname(abs).toLowerCase()] || 'application/octet-stream' });
    headers.set('cache-control', 'public, max-age=0, must-revalidate');
    for (const r of rules) if (r.re.test(pathname)) for (const [k, v] of r.set) headers.set(k, v);
    const body = method === 'HEAD' ? null : fs.readFileSync(abs);
    if (body) headers.set('content-length', String(body.length));
    return new Response(body, { status, headers });
  };
  const redirect = (url, to) => new Response(null, { status: 308, headers: { location: new URL(to + url.search, url).href } });

  return async function serve(request) {
    const url = new URL(request.url);
    let p;
    try {
      p = decodeURIComponent(url.pathname);
    } catch {
      p = url.pathname;
    }
    if (p.includes('\0') || p.split('/').includes('..')) return new Response('Bad request', { status: 400 });
    const method = request.method === 'HEAD' ? 'HEAD' : 'GET';

    if (p.endsWith('/index.html')) return redirect(url, p.slice(0, -'index.html'.length));
    if (p.endsWith('.html') && isFile(p)) return redirect(url, p.slice(0, -5));
    if (p === '/') {
      const f = isFile('index.html');
      if (f) return respond(f, p, 200, method);
    } else if (p.endsWith('/')) {
      const dir = isFile(p + 'index.html');
      if (dir) return respond(dir, p, 200, method);
      if (isFile(p.slice(0, -1) + '.html')) return redirect(url, p.slice(0, -1));
    } else {
      const f = isFile(p) || isFile(p + '.html') || isFile(p + '/index.html');
      if (f) return respond(f, p, 200, method);
    }
    const nf = isFile('404.html');
    return nf ? respond(nf, p, 404, method) : new Response('Not found', { status: 404 });
  };
}

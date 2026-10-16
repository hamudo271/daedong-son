/**
 * Railway(Node) 서버: Cloudflare Pages Functions(functions/[[path]].js)를 그대로 돌린다.
 * - D1 → node:sqlite 파일(Railway 볼륨). 처음 켤 때 seed/posts.json의 공개 사례를 넣는다.
 * - HTMLRewriter → lol-html wasm, env.ASSETS·ctx.next → out/ 정적 파일
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { HTMLRewriter } from './html-rewriter.mjs';
import { openD1 } from './d1.mjs';
import { createStatic, pattern } from './static.mjs';
import { ensure } from '../core.js';
import { onRequest } from '../../functions/[[path]].js';

globalThis.HTMLRewriter = HTMLRewriter;

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'out');
const volume = process.env.RAILWAY_VOLUME_MOUNT_PATH;
const DB_PATH = process.env.DB_PATH || (volume ? path.join(volume, 'cms.db') : path.join(ROOT, '.data', 'cms.db'));
if (process.env.RAILWAY_ENVIRONMENT && !volume && !process.env.DB_PATH)
  console.warn('[경고] Railway 볼륨이 없습니다. 다시 배포하면 CMS 글·사진이 사라집니다. 볼륨을 /data 에 연결하세요.');

const db = openD1(DB_PATH);
await ensure(db);
await seed();

const serveStatic = createStatic(OUT);
const routes = JSON.parse(fs.readFileSync(path.join(OUT, '_routes.json'), 'utf8'));
const include = routes.include.map(pattern);
const exclude = routes.exclude.map(pattern);
const env = { DB: db, ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || '', ASSETS: { fetch: (r) => serveStatic(new Request(r)) } };

async function seed() {
  const done = (await db.prepare("SELECT v FROM settings WHERE k='seeded'").first())?.v;
  if (done) return;
  const count = (await db.prepare('SELECT COUNT(*) c FROM posts').first()).c;
  const file = path.join(ROOT, 'seed', 'posts.json');
  if (count === 0 && fs.existsSync(file)) {
    const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
    await db.batch(
      rows.map((r) => {
        const cols = Object.keys(r);
        return db.prepare(`INSERT INTO posts(${cols.join(',')}) VALUES(${cols.map(() => '?').join(',')})`).bind(...cols.map((c) => r[c]));
      }),
    );
    console.log(`seed: 사례 ${rows.length}건을 넣었습니다.`);
  }
  await db.prepare("INSERT INTO settings(k,v) VALUES('seeded','1') ON CONFLICT(k) DO NOTHING").run();
}

async function handle(request) {
  const p = new URL(request.url).pathname;
  const fn = include.some((re) => re.test(p)) && !exclude.some((re) => re.test(p));
  if (!fn) return serveStatic(request);
  return onRequest({
    request,
    env,
    params: {},
    next: () => serveStatic(request),
    waitUntil: (pr) => Promise.resolve(pr).catch((e) => console.error('waitUntil', e)),
  });
}

const MAX_BODY = 5 * 1024 * 1024;
const COMPRESSIBLE = /^(text\/|application\/(javascript|json|xml|manifest\+json)|image\/svg\+xml)/;

// 클라이언트가 보낸 값은 믿지 않는다: CF-Connecting-IP(로그인 잠금 우회), X-Forwarded-Host(다른 주소로 리다이렉트)
const UNTRUSTED = new Set(['cf-connecting-ip', 'x-forwarded-host']);

function toRequest(req, body) {
  const proto = String(req.headers['x-forwarded-proto'] || 'http').split(',')[0].trim();
  const host = req.headers.host || 'localhost';
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) if (!UNTRUSTED.has(k)) headers.set(k, Array.isArray(v) ? v.join(', ') : v);
  // Railway 엣지는 요청마다 X-Real-IP를 실제 접속 IP로 덮어쓴다. 없으면(로컬) 소켓 주소
  headers.set('cf-connecting-ip', String(req.headers['x-real-ip'] || req.socket.remoteAddress || 'local').trim());
  const hasBody = body && req.method !== 'GET' && req.method !== 'HEAD';
  return new Request(`${proto}://${host}${req.url}`, { method: req.method, headers, body: hasBody ? body : undefined });
}

async function send(req, res, response) {
  const headers = {};
  response.headers.forEach((v, k) => {
    if (k !== 'set-cookie') headers[k] = v;
  });
  const cookies = response.headers.getSetCookie();
  if (cookies.length) headers['set-cookie'] = cookies;
  // 보안 헤더: 관리자·API는 다른 사이트에 끼워 넣기(클릭재킹) 금지, https면 HSTS
  const p = req.url.split('?')[0];
  const locked = /^\/(admin|api\/)/.test(p);
  headers['x-content-type-options'] ??= 'nosniff';
  headers['referrer-policy'] ??= 'strict-origin-when-cross-origin';
  headers['x-frame-options'] ??= locked ? 'DENY' : 'SAMEORIGIN';
  if (locked) headers['content-security-policy'] ??= "frame-ancestors 'none'";
  if (String(req.headers['x-forwarded-proto'] || '').startsWith('https')) headers['strict-transport-security'] ??= 'max-age=15552000';
  let body = req.method === 'HEAD' || !response.body ? null : Buffer.from(await response.arrayBuffer());
  const accept = String(req.headers['accept-encoding'] || '');
  if (body && body.length > 1024 && !headers['content-encoding'] && COMPRESSIBLE.test(headers['content-type'] || '')) {
    if (/\bbr\b/.test(accept)) {
      body = zlib.brotliCompressSync(body, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5 } });
      headers['content-encoding'] = 'br';
    } else if (/\bgzip\b/.test(accept)) {
      body = zlib.gzipSync(body);
      headers['content-encoding'] = 'gzip';
    }
    if (headers['content-encoding']) headers.vary = 'Accept-Encoding';
  }
  if (body) headers['content-length'] = String(body.length);
  else if (req.method !== 'HEAD') delete headers['content-length'];
  res.writeHead(response.status, headers);
  res.end(body);
}

const server = http.createServer((req, res) => {
  const chunks = [];
  let size = 0;
  req.on('data', (c) => {
    size += c.length;
    if (size > MAX_BODY) {
      res.writeHead(413, { 'content-type': 'text/plain; charset=utf-8' }).end('Payload too large');
      req.destroy();
    } else chunks.push(c);
  });
  req.on('end', async () => {
    try {
      await send(req, res, await handle(toRequest(req, Buffer.concat(chunks))));
    } catch (e) {
      console.error('request error', req.method, req.url, e?.stack || e);
      if (!res.headersSent) res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('Internal Server Error');
    }
  });
});

const PORT = Number(process.env.PORT) || 8080;
server.listen(PORT, () => console.log(`daedong server on :${PORT} (db: ${DB_PATH})`));
const stop = () => server.close(() => (db.raw.close(), process.exit(0)));
process.on('SIGTERM', stop);
process.on('SIGINT', stop);

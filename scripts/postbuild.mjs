import fs from 'node:fs';
import path from 'node:path';
import { SITE, orgLD, ldScript } from '../lib/site.js';

const root = process.cwd();
const out = path.join(root, 'out');
const ORIGIN = (process.env.SITE_URL || SITE.url).replace(/\/+$/, '');
const map = {
  'index.html': 'home',
  'about.html': 'about',
  'services.html': 'services',
  'partners.html': 'partners',
  'contact.html': 'contact',
  'cases.html': 'cases',
  'cases-view.html': 'cases-view',
  'admin.html': 'admin',
  '404.html': '404',
};
// 검색에 노출할 페이지의 대표 주소. cases-view는 상세 화면 틀이라 Functions가 글마다 다시 바꾼다
const CANONICAL = { home: '/', about: '/about', services: '/services', partners: '/partners', contact: '/contact', cases: '/cases', 'cases-view': '/cases' };

/** 원본 HTML에 검색엔진용 태그를 더한다. 관리자·404는 noindex 그대로 둔다 */
function seo(html, slug) {
  if (!CANONICAL[slug]) return html;
  const url = ORIGIN + CANONICAL[slug];
  let h = html
    .replace(/\s*<meta name="robots" content="noindex,nofollow">/, '')
    .replace(/\s*<meta property="og:image" content="[^"]*">/, '');
  const head = [
    `<link rel="canonical" href="${url}">`,
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:site_name" content="${SITE.name}">`,
    `<meta property="og:locale" content="ko_KR">`,
    `<meta property="og:image" content="${ORIGIN}/assets/img/og-default.jpg">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<link rel="icon" href="/favicon.ico" sizes="48x48">`,
    `<link rel="apple-touch-icon" href="/apple-touch-icon.png">`,
  ];
  if (slug === 'home' || slug === 'contact') head.push(ldScript(orgLD(ORIGIN)));
  if (!h.includes('</head>')) throw new Error('no </head> in ' + slug);
  h = h.replace('</head>', head.join('\n') + '\n</head>');
  // 첫 화면 영상(4.5MB)은 인트로가 끝나고 site.js가 재생할 때 내려받는다
  if (slug === 'home') h = h.replace(/(<video class="hero-video")([^>]*?) autoplay([^>]*?) preload="auto"/, '$1$2$3 preload="none"');
  if (/name="robots" content="noindex/.test(h)) throw new Error('noindex left in ' + slug);
  return h;
}

for (const [file, slug] of Object.entries(map)) {
  const target = path.join(out, file);
  if (!fs.existsSync(target)) throw new Error('missing exported route: ' + file);
  const page = JSON.parse(fs.readFileSync(path.join(root, 'content/pages', slug + '.json'), 'utf8'));
  fs.writeFileSync(target, seo(page.source, slug));
}
fs.writeFileSync(path.join(out, '_routes.json'), JSON.stringify({
  version: 1,
  include: ['/', '/index.html', '/cases', '/cases.html', '/cases/*', '/cases-view', '/cases-view.html', '/api/cms/*', '/media/*', '/sitemap.xml'],
  exclude: ['/assets/*', '/admin/*', '/_next/static/*'],
}, null, 2) + '\n');
fs.writeFileSync(path.join(out, '_headers'), [
  '/*',
  '  X-Content-Type-Options: nosniff',
  '',
  '/_next/static/*',
  '  Cache-Control: public, max-age=31536000, immutable',
  '',
  '/assets/*',
  '  Cache-Control: public, max-age=31536000, immutable',
  '',
  '/admin*',
  '  Cache-Control: no-store',
  '  X-Robots-Tag: noindex, nofollow',
  '',
].join('\n'));
fs.writeFileSync(path.join(out, 'robots.txt'), ['User-agent: *', 'Allow: /', 'Disallow: /api/', '', `Sitemap: ${ORIGIN}/sitemap.xml`, ''].join('\n'));

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const out = path.join(root, 'out');
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
for (const [file, slug] of Object.entries(map)) {
  const target = path.join(out, file);
  if (!fs.existsSync(target)) throw new Error('missing exported route: ' + file);
  const page = JSON.parse(fs.readFileSync(path.join(root, 'content/pages', slug + '.json'), 'utf8'));
  fs.writeFileSync(target, page.source);
}
fs.writeFileSync(path.join(out, '_routes.json'), JSON.stringify({
  version: 1,
  include: ['/', '/index.html', '/cases', '/cases.html', '/cases/*', '/cases-view', '/cases-view.html', '/api/cms/*', '/media/*'],
  exclude: ['/assets/*', '/admin/*', '/_next/static/*'],
}, null, 2) + '\n');
fs.writeFileSync(path.join(out, '_headers'), [
  '/*',
  '  X-Robots-Tag: noindex, nofollow',
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
  '',
].join('\n'));

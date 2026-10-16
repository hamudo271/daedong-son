#!/usr/bin/env python3
"""daedong-renewal/site → Next 프로젝트 데이터 추출 (원본은 읽기만).
- public/assets : 원본 자산 그대로 복사(디자인 불변)
- content/pages/{slug}.json : <title>/description/body class + body 최상위 블록(머리말·푸터·플로팅 제외)
  블록 = {tag, attrs, html}. 머리말(header+mnav)·푸터·플로팅·스크립트는 React 컴포넌트가 그린다.
"""
import json, os, re, shutil, html
from html.parser import HTMLParser
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(os.path.dirname(ROOT), 'daedong-renewal')
SITE = os.path.join(SRC, 'site')
VOID = {'area','base','br','col','embed','hr','img','input','link','meta','source','track','wbr'}

class Top(HTMLParser):
    """body 바로 아래 요소들의 (tag, attrs, 시작, 내용시작, 내용끝, 끝) 오프셋"""
    def __init__(self, text):
        super().__init__(convert_charrefs=False)
        self.text = text
        self.lines = [0]
        for m in re.finditer('\n', text): self.lines.append(m.end())
        self.depth = 0; self.inbody = False; self.items = []; self.cur = None; self.svg = 0
    def off(self):
        l, c = self.getpos(); return self.lines[l-1] + c
    def handle_starttag(self, tag, attrs):
        if tag == 'body': self.inbody = True; return
        if not self.inbody: return
        if tag in VOID: 
            if self.depth == 0: 
                s = self.off(); e = s + len(self.get_starttag_text())
                self.items.append([tag, attrs, s, e, e, e])
            return
        if self.depth == 0:
            s = self.off(); self.cur = [tag, attrs, s, s + len(self.get_starttag_text()), None, None]
        self.depth += 1
    def handle_startendtag(self, tag, attrs):
        pass
    def handle_endtag(self, tag):
        if tag == 'body': self.inbody = False; return
        if not self.inbody or tag in VOID: return
        self.depth -= 1
        if self.depth == 0 and self.cur:
            s = self.off(); self.cur[4] = s; self.cur[5] = s + len('</%s>' % tag)
            self.items.append(self.cur); self.cur = None

CHROME = {'skip', 'hd', 'mnav', 'ft', 'flt', 'cur', 'script'}
def kind(tag, attrs):
    a = dict(attrs)
    cls = (a.get('class') or '').split()
    if tag == 'a' and 'skip' in cls: return 'skip'
    if tag == 'header' and a.get('id') == 'hd': return 'hd'
    if a.get('id') == 'mnav': return 'mnav'
    if tag == 'footer' and 'ft' in cls: return 'ft'
    if 'flt' in cls: return 'flt'
    if 'cur' in cls: return 'cur'
    if tag == 'script': return 'script'
    return 'block'

def page(fn, slug):
    t = open(os.path.join(SITE, fn), encoding='utf-8').read()
    p = Top(t); p.feed(t)
    title = html.unescape(re.search(r'<title>(.*?)</title>', t).group(1))
    desc = html.unescape(re.search(r'<meta name="description" content="([^"]*)"', t).group(1))
    body = re.search(r'<body class="([^"]*)" data-form="([^"]*)"', t)
    order, blocks = [], []
    light = False; active = None
    for tag, attrs, s, cs, ce, e in p.items:
        k = kind(tag, attrs)
        if k == 'block':
            blocks.append({'tag': tag, 'attrs': dict(attrs), 'html': t[cs:ce]})
            order.append(len(blocks) - 1)
        else:
            order.append(k)
            if k == 'hd':
                light = 'hd--light' in (dict(attrs).get('class') or '')
                m = re.search(r'<a href="/(\w+)" class="on" aria-current="page">', t[s:e])
                active = m.group(1) if m else ('contact' if 'class="hd-cta" href="/contact" aria-current="page"' in t[s:e] else None)
    head = re.search(r'<head>([\s\S]*?)</head>', t).group(1)
    body_inner = re.search(r'<body[^>]*>([\s\S]*?)</body>', t).group(1)
    d = {'slug': slug, 'title': title, 'desc': desc, 'bodyClass': body.group(1), 'form': body.group(2),
         'light': light, 'active': active, 'order': order, 'blocks': blocks,
         'head': head, 'body': body_inner, 'source': t}
    os.makedirs(os.path.join(ROOT, 'content/pages'), exist_ok=True)
    json.dump(d, open(os.path.join(ROOT, 'content/pages', slug + '.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    return slug, order, title, active, light

if __name__ == '__main__':
    dst = os.path.join(ROOT, 'public/assets')
    if os.path.exists(dst): shutil.rmtree(dst)
    shutil.copytree(os.path.join(SITE, 'assets'), dst)
    for extra in os.listdir(SITE):
        p = os.path.join(SITE, extra)
        if os.path.isfile(p) and not extra.endswith('.html'):
            shutil.copy(p, os.path.join(ROOT, 'public', extra))
    shutil.copy(os.path.join(SRC, 'data.json'), os.path.join(ROOT, 'content/data.json'))
    admin_dst = os.path.join(ROOT, 'public/admin')
    if os.path.exists(admin_dst): shutil.rmtree(admin_dst)
    shutil.copytree(os.path.join(SRC, 'admin'), admin_dst)
    for fn, slug in [('index.html','home'),('about.html','about'),('services.html','services'),('cases.html','cases'),
                     ('cases-view.html','cases-view'),('contact.html','contact'),('partners.html','partners')]:
        print(page(fn, slug))
    a = open(os.path.join(SITE, 'index.html'), encoding='utf-8').read(); b = open(os.path.join(SITE, '404.html'), encoding='utf-8').read()
    os.makedirs(os.path.join(ROOT, 'content/pages'), exist_ok=True)
    json.dump({'slug':'404','title':'페이지를 찾을 수 없습니다','desc':'','bodyClass':'home','form':'preview',
               'head':re.search(r'<head>([\s\S]*?)</head>', b).group(1),
               'body':re.search(r'<body[^>]*>([\s\S]*?)</body>', b).group(1), 'source':b},
              open(os.path.join(ROOT, 'content/pages/404.json'),'w',encoding='utf-8'), ensure_ascii=False, indent=1)
    at = open(os.path.join(SRC, 'admin/index.html'), encoding='utf-8').read()
    json.dump({'slug':'admin','title':'콘텐츠 관리자','desc':'','bodyClass':'','form':'',
               'head':re.search(r'<head>([\s\S]*?)</head>', at).group(1),
               'body':re.search(r'<body[^>]*>([\s\S]*?)</body>', at).group(1), 'source':at},
              open(os.path.join(ROOT, 'content/pages/admin.json'),'w',encoding='utf-8'), ensure_ascii=False, indent=1)
    print('404 == index:', a == b)

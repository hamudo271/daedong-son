/**
 * '손해사정 사례' 메뉴(사례 · 매거진 · 뉴스룸) 공개 화면 조각 — 원본 cms/site.js 의 마크업을 React로 옮김.
 * Functions(server/render.jsx)가 renderToStaticMarkup 으로 같은 컴포넌트를 써서 #cms-root / #caseTrack 을 채운다.
 * 카드 구조·클래스는 원본과 같아서 site.css/site.js(막대 애니메이션·숫자 올라가기·슬라이더)가 그대로 동작한다.
 */
import React from 'react';
import { TYPES } from '../../lib/site';
import { parseExtra, plain } from '../../lib/text';

export const IconArrow = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
);
export const IconArrowL = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6" /></svg>
);
const dot = (d) => (d || '').replace(/-/g, '.');
const pad = (n) => String(n).padStart(2, '0');
const digits = (t) => parseInt(String(t || '').replace(/[^\d]/g, ''), 10) || 0;

/** 보험사 제시액 ↔ 손해사정 결과 숫자와 막대 너비 */
export function result(p) {
  const x = parseExtra(p.extra);
  const bn = Math.max(0, +x.before_num || 0);
  const an = Math.max(0, +x.after_num || 0);
  const mx = Math.max(bn, an) || 1;
  return {
    label: x.before_label || '보험사 제시액',
    before: x.before || '',
    after: x.after || '',
    bn,
    an,
    bw: Math.round((bn / mx) * 1000) / 10,
    aw: Math.round((an / mx) * 1000) / 10,
    // 숫자 올라가기는 문구의 숫자가 그래프 숫자와 같을 때만(예: '23,000만 원' ↔ 23000)
    count: an && digits(x.after) === an ? String(an) : undefined,
  };
}

const Bars = ({ r }) => (
  <>
    <div className="cmp-row cmp-before"><span>{r.label}</span><b>{r.before}</b><i style={{ '--w': r.bw + '%' }}></i></div>
    <div className="cmp-row cmp-after"><span>대동 손해사정 결과</span><b data-count={r.count}>{r.after}</b><i style={{ '--w': r.aw + '%' }}></i></div>
  </>
);

export function CaseCard({ p, no, cls = 'case' }) {
  const r = result(p);
  const href = '/cases/' + p.id;
  return (
    <article className={cls} data-tag={p.category || ''} data-rv="">
      <div className="case-head"><span className="case-no">CASE {pad(no)}</span>{p.category ? <span className="case-tag">{p.category}</span> : null}</div>
      <h3><a href={href}>{p.title}</a></h3>
      <div className="cmp"><Bars r={r} /></div>
      <p className="case-desc">{p.summary}</p>
      <a className="case-link" href={href} aria-label={p.title + ' 자세히 보기'}>자세히 보기 <IconArrow /></a>
    </article>
  );
}

const EmptyCard = ({ cls, t, d }) => (
  <div className={cls + ' case--empty'} data-rv=""><b>{t}</b><p>{d}</p></div>
);

/* 목록 사진 카드. 대표 이미지가 없으면 분야에 맞는 기본 사진 */
const FALLBACK_PIC = [
  [/교통|자동차|차량|운전|오토바이/, ['svc-accident', 'sub-traffic', 'hero-road']],
  [/암|진단|질병|뇌|심장|심혈관|후유장해|장해|실손|개인보험/, ['card-xray', 'svc-medical']],
  [/배상|낙상|시설|책임|화재/, ['svc-sign', 'card-docs']],
  [/근재|산재|근로|업무상/, ['cta-desk', 'card-docs']],
];
// 같은 분야 사례가 한 쪽에 여러 개 와도 사진이 겹치지 않게, 분야별로 몇 번째인지(seen) 세어 돌려 쓴다
const DEFAULT_POOL = ['card-docs', 'pen', 'cta-desk'];
const fallbackPic = (cat, seen) => {
  const pool = (FALLBACK_PIC.find(([re]) => re.test(cat || '')) || [null, DEFAULT_POOL])[1];
  const n = seen[pool[0]] || 0;
  seen[pool[0]] = n + 1;
  return pool[n % pool.length];
};
const AssetPic = ({ n }) => (
  <picture>
    <source type="image/webp" srcSet={'/assets/img/' + n + '-m.webp 960w, /assets/img/' + n + '-l.webp 1920w'} sizes="(max-width: 767px) 100vw, 50vw" />
    <img src={'/assets/img/' + n + '-l.jpg'} srcSet={'/assets/img/' + n + '-m.jpg 960w, /assets/img/' + n + '-l.jpg 1920w'} sizes="(max-width: 767px) 100vw, 50vw" alt="" loading="lazy" decoding="async" />
  </picture>
);
const Media = ({ p, seen }) =>
  p.cover_id ? <img src={'/media/' + p.cover_id} alt="" loading="lazy" decoding="async" /> : <AssetPic n={fallbackPic(p.category, seen)} />;

export function CaseTile({ p, no, seen = {} }) {
  const r = result(p);
  const href = '/cases/' + p.id;
  return (
    <article className="tile" data-tag={p.category || ''} data-rv="">
      <a className="tile-link" href={href} aria-label={p.title + ' 자세히 보기'}>
        <div className="tile-pic"><Media p={p} seen={seen} /></div>
        <span className="tile-wm" aria-hidden="true">{pad(no)}</span>
        <div className="tile-top"><div className="tile-top-l"><span className="tile-no">CASE {pad(no)}</span>{p.category ? <span className="tile-tag">{p.category}</span> : null}</div><span className="tile-go" aria-hidden="true"><IconArrow /></span></div>
        <div className="tile-body">
          <h3>{p.title}</h3>
          <p className="tile-sum">{p.summary}</p>
          <div className="tile-res">
            <span className="tile-before"><small>{r.label}</small><b>{r.before}</b></span>
            <span className="tile-after"><small>대동 손해사정 결과</small><b data-count={r.count}>{r.after}</b></span>
          </div>
        </div>
      </a>
    </article>
  );
}
const EmptyTile = ({ t, d }) => (
  <div className="tile tile--empty" data-rv=""><div className="tile-link"><b>{t}</b><p>{d}</p></div></div>
);

/** 메인 화면 사례 슬라이더(#caseTrack 안) */
export function CaseTrack({ items }) {
  if (!items.length) return <EmptyCard cls="case case--slide" t="등록된 사례가 아직 없습니다." d="관리자 화면에서 사례를 등록하면 이곳에 바로 보입니다." />;
  return <>{items.map((p, i) => <CaseCard key={p.id} p={p} no={i + 1} cls="case case--slide" />)}</>;
}

/** 유형 탭(손해사정 사례 · 매거진 · 뉴스룸). counts: 유형별 공개 글 수 */
export function TypeNav({ kind, counts = {} }) {
  return (
    <nav className="ctype" aria-label="콘텐츠 유형" data-rv="">
      {Object.entries(TYPES).map(([k, t]) => (
        <a key={k} href={t.href} className={k === kind ? 'on' : undefined} aria-current={k === kind ? 'page' : undefined}>{t.label}<small>{pad(counts[k] || 0)}</small></a>
      ))}
    </nav>
  );
}

/** 매거진·뉴스룸 목록 카드(사례 사진 카드와 같은 틀, 금액 대신 날짜·글쓴이) */
export function PostTile({ p, kind, seen = {} }) {
  const t = TYPES[kind] || TYPES.magazine;
  const href = '/cases/' + p.id;
  return (
    <article className="tile tile--post" data-tag={p.category || ''} data-rv="">
      <a className="tile-link" href={href} aria-label={p.title + ' 자세히 보기'}>
        <div className="tile-pic"><Media p={p} seen={seen} /></div>
        <div className="tile-top"><div className="tile-top-l"><span className="tile-no">{t.badge}</span>{p.category ? <span className="tile-tag">{p.category}</span> : null}</div><span className="tile-go" aria-hidden="true"><IconArrow /></span></div>
        <div className="tile-body">
          <h3>{p.title}</h3>
          {p.summary ? <p className="tile-sum">{p.summary}</p> : null}
          <p className="tile-meta"><time dateTime={p.published_at || ''}>{dot(p.published_at)}</time>{p.author ? <span>{p.author}</span> : null}</p>
        </div>
      </a>
    </article>
  );
}

/** 목록(/cases · /cases/magazine · /cases/news) — #cms-root 안. d = { items, cats:[{c,n}], page, pages, per } */
export function CaseList({ d, cat = '', kind = 'case', counts = {} }) {
  const t = TYPES[kind] || TYPES.case;
  const base = t.href;
  const Tab = ({ href, label, on }) => <a className={'tab' + (on ? ' on' : '')} href={href} aria-current={on ? 'page' : undefined}>{label}</a>;
  const start = (d.page - 1) * (d.per || 12);
  const seen = {};
  let grid;
  if (d.items.length) grid = d.items.map((p, i) => (kind === 'case' ? <CaseTile key={p.id} p={p} no={start + i + 1} seen={seen} /> : <PostTile key={p.id} p={p} kind={kind} seen={seen} />));
  else if (cat) grid = <EmptyTile t={'이 분야에는 아직 등록된 ' + t.unit + '이 없습니다.'} d="다른 분야를 선택해 보세요." />;
  else if (kind === 'case') grid = <EmptyTile t="등록된 사례가 아직 없습니다." d="관리자 화면에서 사례를 등록하면 이곳에 바로 보입니다." />;
  else grid = <EmptyTile t={t.label + ' 글을 준비하고 있습니다.'} d="곧 유익한 소식으로 찾아뵙겠습니다." />;
  const q = (n) => base + '?' + (cat ? 'cat=' + encodeURIComponent(cat) + '&' : '') + 'page=' + n;
  return (
    <>
      <TypeNav kind={kind} counts={counts} />
      <div className="sec-head sec-head--row" data-rv="">
        <div><p className="eyebrow">{t.eyebrow}</p><h2 id="cl-t">{t.h}</h2></div>
        {d.cats.length ? (
          <nav className="tabs tabs--link" aria-label="분야 선택">
            <Tab href={base} label="전체" on={!cat} />
            {d.cats.map((c) => <Tab key={c.c} href={base + '?cat=' + encodeURIComponent(c.c)} label={c.c} on={cat === c.c} />)}
          </nav>
        ) : null}
      </div>
      <div className="case-grid">{grid}</div>
      {d.pages > 1 ? (
        <nav className="pager" aria-label="쪽 이동">
          {d.page > 1 ? <a href={q(d.page - 1)} aria-label="이전 쪽"><IconArrowL /></a> : null}
          {Array.from({ length: d.pages }, (_, i) => (
            <a key={i} href={q(i + 1)} className={i + 1 === d.page ? 'on' : ''} aria-current={i + 1 === d.page ? 'page' : undefined}>{i + 1}</a>
          ))}
          {d.page < d.pages ? <a href={q(d.page + 1)} aria-label="다음 쪽"><IconArrow /></a> : null}
        </nav>
      ) : null}
    </>
  );
}

const Adj = ({ newer, older, label, unit }) =>
  newer || older ? (
    <nav className="cv-adj" aria-label={label}>
      {newer ? <a href={'/cases/' + newer.id}><small>이전 {unit}</small><span>{newer.title}</span></a> : null}
      {older ? <a href={'/cases/' + older.id}><small>다음 {unit}</small><span>{older.title}</span></a> : null}
    </nav>
  ) : null;

const Cover = ({ p }) => (p.cover_id ? <figure className="cv-cover" data-rv=""><img src={'/media/' + p.cover_id} alt="" loading="lazy" /></figure> : null);
const Body = ({ p }) => (p.body ? <div className="cv-body" data-rv="" dangerouslySetInnerHTML={{ __html: p.body }} /> : null);

/** 매거진·뉴스룸 상세(/cases/:id) — #cms-root 안 */
export function PostView({ v: { post: p, newer, older }, preview }) {
  const t = TYPES[p.kind] || TYPES.magazine;
  // 요약을 비워 두면 서버가 본문 앞부분으로 채운다 → 상세에서는 본문과 겹치므로 숨김
  const sum = p.summary && !plain(p.body).startsWith(p.summary.trim()) ? p.summary : '';
  return (
    <article className="cv cv--post">
      {preview && p.status !== 'published' ? <p className="cv-preview">임시저장 글 미리보기 — 관리자에게만 보입니다.</p> : null}
      <a className="cv-back" href={t.href}><IconArrowL /><span>{t.label} 목록</span></a>
      <header className="cv-head" data-rv="">
        <div className="case-head case-head--l"><span className="case-no">{t.badge}</span>{p.category ? <span className="case-tag">{p.category}</span> : null}</div>
        <h1 className="cv-title">{p.title}</h1>
        <p className="cv-meta"><time dateTime={p.published_at || ''}>{dot(p.published_at)}</time>{p.author ? <span>{p.author}</span> : null}<span>조회 {p.views + (preview ? 0 : 1)}</span></p>
      </header>
      {sum ? <p className="cv-sum" data-rv="">{sum}</p> : null}
      <Cover p={p} />
      <Body p={p} />
      <div className="cv-actions" data-rv="">
        <a className="btn btn-bronze" href="/contact">무료 상담 신청 <IconArrow /></a>
        <a className="btn btn-ink" href={t.href}>목록으로</a>
      </div>
      <Adj newer={newer} older={older} label="다른 글" unit="글" />
    </article>
  );
}

/** 성공 사례 상세(/cases/:id) — #cms-root 안 */
export function CaseView({ v: { post: p, index, newer, older }, preview }) {
  const r = result(p);
  const no = index >= 0 ? index + 1 : null;
  return (
    <article className="cv">
      {preview && p.status !== 'published' ? <p className="cv-preview">임시저장 사례 미리보기 — 관리자에게만 보입니다.</p> : null}
      <a className="cv-back" href="/cases"><IconArrowL /><span>손해사정 사례 목록</span></a>
      <header className="cv-head" data-rv="">
        <div className="case-head case-head--l">{no ? <span className="case-no">CASE {pad(no)}</span> : null}{p.category ? <span className="case-tag">{p.category}</span> : null}</div>
        <h1 className="cv-title">{p.title}</h1>
        <p className="cv-meta"><time dateTime={p.published_at || ''}>{dot(p.published_at)}</time><span>조회 {p.views + (preview ? 0 : 1)}</span></p>
      </header>
      <div className="cv-result" data-rv="">
        <div className="cv-res cv-res--before"><small>{r.label}</small><b>{r.before}</b></div>
        <i className="cv-res-arrow" aria-hidden="true"><IconArrow /></i>
        <div className="cv-res cv-res--after"><small>대동 손해사정 결과</small><b data-count={r.count}>{r.after}</b></div>
        <div className="cv-bars"><Bars r={r} /></div>
      </div>
      <p className="cv-sum" data-rv="">{p.summary}</p>
      <Cover p={p} />
      <Body p={p} />
      <div className="cv-actions" data-rv="">
        <a className="btn btn-bronze" href="/contact">비슷한 사례 무료 상담 <IconArrow /></a>
        <a className="btn btn-ink" href="/cases">목록으로</a>
      </div>
      <Adj newer={newer} older={older} label="다른 사례" unit="사례" />
    </article>
  );
}

export function CaseNotFound() {
  return (
    <div className="cv cv-empty" data-rv="">
      <p className="eyebrow">Not Found</p><h2>글을 찾을 수 없습니다.</h2><p>삭제되었거나 주소가 바뀐 글입니다.</p>
      <a className="btn btn-bronze" href="/cases">손해사정 사례 목록 <IconArrow /></a>
    </div>
  );
}

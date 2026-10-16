/** 사이트 기본 정보와 '손해사정 사례' 메뉴의 콘텐츠 유형 — 원본 cms/site.js 의 SITE·TYPES 그대로 */
export const SITE = {
  name: '대동 손해사정사무소',
  color: { main: '#a8885c', dark: '#0f2230' },
  home: '/',
  // '손해사정 사례' 메뉴 안의 콘텐츠 유형(2026-10-14 현도 요청: 사례 · 매거진 · 팁)
  kinds: ['case', 'magazine', 'tip'],
  labels: { case: '손해사정 사례', magazine: '매거진', tip: '뉴스룸' },
  urls: { case: '/cases', caseView: '/cases/{id}', magazine: '/cases/magazine', magazineView: '/cases/{id}', tip: '/cases/news', tipView: '/cases/{id}' },
  authors: ['대동 손해사정사무소', '오승창 손해사정사'],
};

/** 유형별 주소·문구. 목록은 /cases · /cases/magazine · /cases/news, 상세는 모두 /cases/:id */
export const TYPES = {
  case: { label: '손해사정 사례', href: '/cases', eyebrow: 'Claim Cases', h: '주요 손해사정 사례', badge: 'CASE', unit: '사례',
    lead: '고객님의 소중한 권리를<br>되찾아 드린 실제 사례입니다.', xbox: '대동 손해사정사무소가 고객님의 소중한 권리를 되찾아 드린 실제 사례입니다.',
    desc: '대동 손해사정사무소 주요 손해사정 사례 — 교통사고 후유장해, 암 진단비, 배상책임, 개인보험 지급거절 사건의 보험사 제시액과 손해사정 결과.' },
  magazine: { label: '매거진', href: '/cases/magazine', eyebrow: 'Magazine', h: '대동 매거진', badge: 'MAGAZINE', unit: '글',
    lead: '손해사정 현장에서 전하는<br>보험·보상 이야기입니다.', xbox: '손해사정 현장에서 직접 보고 겪은 보험·보상 이야기를 전합니다.',
    desc: '대동 손해사정사무소 매거진 — 손해사정 현장에서 전하는 보험·보상 이야기.' },
  // kind 'tip'은 DB 값 그대로 두고 화면 이름만 '뉴스룸'(2026-10-14 20:43 현도 요청). 옛 주소 /cases/tip → /cases/news 301
  tip: { label: '뉴스룸', href: '/cases/news', eyebrow: 'Newsroom', h: '대동 뉴스룸', badge: 'NEWS', unit: '글',
    lead: '대동 손해사정사무소의 소식과<br>보험·보상 뉴스를 전합니다.', xbox: '대동 손해사정사무소의 새 소식과 알아 두면 좋은 보험·보상 뉴스를 전합니다.',
    desc: '대동 손해사정사무소 뉴스룸 — 사무소 소식과 보험·보상 관련 뉴스.' },
};

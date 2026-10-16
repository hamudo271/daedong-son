/** 공개 화면 컴포넌트와 서버가 같이 쓰는 문자 도구(원본 cms/core.js 와 같은 규칙) */
export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
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
export const plain = (html) => String(html || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

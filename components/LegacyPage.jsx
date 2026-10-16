import React from 'react';

/** Next 정적 렌더 후 postbuild에서 원본 문서 구조를 그대로 복원한다. */
export default function LegacyPage({ page }) {
  return <legacy-root dangerouslySetInnerHTML={{ __html: page.body }} />;
}

export const legacyProps = (page) => ({ props: { page } });

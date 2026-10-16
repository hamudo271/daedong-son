# 대동 Next.js 전환 기록 — 2026-10-16

## 완료
- Next.js 16.4.1 pages router, output export.
- 공개 경로: /, /about, /services, /cases, /partners, /contact, /cases-view, /admin, /404.
- 원본 HTML/CSS/JS/모션 보존: build 후 9개 문서 모두 원본과 바이트 일치.
- Pages Functions + React CMS 조각: 메인 사례, 사례·매거진·뉴스룸 목록, 상세, 미리보기, 조회수, 메타·JSON-LD.
- 새 D1 daedong-next-cms에 기존 공개 사례 7건과 설정 복제.
- 새 Pages 프로젝트 daedong-next, 기존 관리자 비밀번호를 production secret으로 연결.
- 기존 daedong-renewal Worker와 daedong-cms는 변경하지 않음.

## 배포
- 주소: https://daedong-next.pages.dev
- 배포 ID: 9b5a29ad-ba7c-4d12-855e-a691a4ac795d
- D1 ID: feb9012a-fcfa-4f07-afcd-a781c716e5a6
- noindex/nofollow 유지.

## 검증
- Next build 성공, Pages Functions 번들 성공.
- 원본 HTML 동등성 9/9.
- 실배포 12개 경로 200, 기존 Worker 200.
- 브라우저 1440: 메인·사례 목록·상세·관리자, 가로 넘침/깨진 이미지/페이지 오류 0.
- 브라우저 390: 메인·사례·상담, 가로 넘침/깨진 이미지/페이지 오류 0.
- CMS E2E 12/12: 설정, 오답 로그인, 정상 로그인, 세션, 업로드, 작성, 공개 상세·목록, 삭제, 삭제 후 404, 로그아웃.
- 임시 글·이미지 삭제 후 posts=7, media=0.
- 기존/Next about 픽셀 차이 0.4260%; 차이는 애니메이션 중인 히어로 제목 영역에만 한정. 정적 HTML은 완전 일치.

## 백업
- 기존 D1 export: ../daedong-renewal/_backups/daedong-cms-20261016/daedong-cms.sql

## 남은 선택
- 기존 주소를 새 Next.js 배포로 전환할지는 사용자 확인 후 진행.

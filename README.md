# 대동 손해사정사무소 — Next.js 판

원본 ../daedong-renewal의 화면·DOM·모션을 그대로 유지하고 Next.js 16 pages router 정적 내보내기 + Cloudflare Pages Functions + D1로 옮긴 프로젝트다.

- 공개 페이지: Next.js output export, unstable_runtimeJS:false; 원본 CSS/JS와 HTML 순서를 postbuild에서 그대로 복원한다.
- CMS 화면: components/cms/Cases.jsx를 Pages Functions에서도 함께 사용한다.
- 관리자: /admin에서 사례·매거진·뉴스룸 작성, 사진 업로드, 비밀번호 변경.
- 검색 차단: out/_headers의 X-Robots-Tag: noindex, nofollow 유지.

## 명령

    npm install
    npm run build
    npx wrangler@4 pages dev out --port 8789
    npx wrangler@4 pages deploy out --project-name daedong-next --branch main --commit-dirty=true

GitHub(hamudo271/daedong-son) main에 푸시하면 .github/workflows/deploy.yml이 빌드 후 daedong-next Pages로 자동 배포한다. 저장소 시크릿 CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID가 필요하다. 원본 ../daedong-renewal이 없으면 build는 extract를 건너뛰고 커밋된 content/와 public/assets를 쓴다.

기존 daedong-renewal Worker와 daedong-cms D1은 건드리지 않는다. 새 배포는 daedong-next Pages와 daedong-next-cms D1을 사용한다.

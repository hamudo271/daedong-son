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

기존 daedong-renewal Worker와 daedong-cms D1은 건드리지 않는다. 새 배포는 daedong-next Pages와 daedong-next-cms D1을 사용한다.

## Railway (현재 운영)

GitHub(hamudo271/daedong-son) main에 푸시하면 Railway가 자동으로 빌드·배포한다.

- 빌드: npm run build → out/(정적) + dist/server.mjs(서버). 원본 ../daedong-renewal이 없으면 extract는 건너뛴다.
- 실행: npm start → server/node/main.mjs. functions/[[path]].js와 server/core.js를 그대로 쓰고, D1 대신 PostgreSQL(server/node/pg.mjs가 SQLite 문법을 바꿔 실행), HTMLRewriter 대신 lol-html wasm을 쓴다.
- 데이터: Railway Postgres(daedong-son의 DATABASE_URL 변수로 연결). 처음 켤 때 seed/posts.json(공개 사례 7건)을 넣는다. DATABASE_URL이 없으면 임시 SQLite 파일이라 배포할 때마다 글·사진이 사라진다.
- 변수: ADMIN_PASSWORD(관리자 비밀번호), DATABASE_URL(Postgres). 관리자 화면에서 비밀번호를 바꾸면 그 값이 우선한다.
- 로컬: npm run build:server && ADMIN_PASSWORD=... npm start → http://localhost:8080 (DATABASE_URL을 주면 Postgres, 없으면 .data/cms.db)

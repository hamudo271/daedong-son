const TEL_NO = () => (window.matchMedia && matchMedia('(max-width: 1023px)').matches) ? '010-5114-2465' : '062-710-7055';
/* 대동 손해사정사무소 리뉴얼 시안 — 외부 라이브러리 없음 */
(() => {
  const d = document, html = d.documentElement, body = d.body;
  const $ = (s, r = d) => r.querySelector(s);
  const $$ = (s, r = d) => [...r.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const hd = $('#hd');
  const isHome = body.classList.contains('page-home');

  /* ── 모바일 메뉴 ── */
  const burger = $('.hd-burger'), mnav = $('#mnav');
  const setMenu = (open) => {
    body.classList.toggle('menu-open', open);
    burger && burger.setAttribute('aria-expanded', open);
    burger && burger.setAttribute('aria-label', open ? '메뉴 닫기' : '메뉴 열기');
    mnav && mnav.setAttribute('aria-hidden', !open);
  };
  burger && burger.addEventListener('click', () => setMenu(!body.classList.contains('menu-open')));
  mnav && $$('a', mnav).forEach((a) => a.addEventListener('click', () => setMenu(false)));
  d.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });

  /* ── 위치 표시 드롭다운 ── */
  $$('.crumb-dd').forEach((dd) => {
    const b = $('button', dd);
    b.addEventListener('click', (e) => { e.stopPropagation(); const o = dd.classList.toggle('is-open'); b.setAttribute('aria-expanded', o); });
    d.addEventListener('click', () => { dd.classList.remove('is-open'); b.setAttribute('aria-expanded', false); });
  });

  /* ── FAQ · 동의 내용 ── */
  $$('.faq-q').forEach((q) => q.addEventListener('click', () => {
    const o = q.getAttribute('aria-expanded') !== 'true';
    q.setAttribute('aria-expanded', o);
    q.nextElementSibling.hidden = !o;
  }));
  $$('.agree-more').forEach((b) => b.addEventListener('click', () => {
    const t = d.getElementById(b.getAttribute('aria-controls'));
    const o = t.hidden; t.hidden = !o; b.setAttribute('aria-expanded', o); b.textContent = o ? '접기' : '내용 보기';
  }));

  /* ── 상담 폼: 시안 단계에서는 접수 연결 전임을 그대로 알린다 ── */
  $$('.js-form').forEach((f) => f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = $('.form-msg', f), btn = $('button[type=submit]', f);
    if (!f.reportValidity()) return;
    msg.classList.remove('is-err');
    const ag = f.querySelector('input[name=agree]:checked');
    if (ag && ag.value !== '동의') {
      msg.classList.add('is-err');
      msg.textContent = '개인정보 수집·이용에 동의하셔야 상담 신청이 가능합니다.';
      return;
    }
    if (body.dataset.form !== 'netlify') {
      msg.classList.add('is-err');
      msg.textContent = '시안 단계라 온라인 접수는 아직 연결되지 않았습니다. 전화 ' + TEL_NO() + '로 문의해 주세요.';
      return;
    }
    btn.disabled = true; msg.textContent = '전송 중입니다…';
    try {
      const r = await fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(new FormData(f)).toString() });
      if (!r.ok) throw new Error(r.status);
      msg.textContent = '상담 신청이 접수되었습니다. 확인 후 연락드리겠습니다.'; f.reset();
    } catch (err) {
      msg.classList.add('is-err');
      msg.textContent = '접수 중 문제가 생겼습니다. 전화 ' + TEL_NO() + '로 문의해 주세요.';
    } finally { btn.disabled = false; }
  }));

  /* ── 성공 사례 분야 탭 (정적 예비용 버튼 탭만. .tabs--link 는 서버에서 만든 링크라 그대로 이동) ── */
  $$('.tabs:not(.tabs--link)').forEach((g) => {
    const tabs = $$('.tab', g);
    tabs.forEach((t) => t.addEventListener('click', () => {
      tabs.forEach((x) => x.classList.toggle('on', x === t));
      const f = t.dataset.f;
      $$('.case-grid [data-tag]').forEach((c) => c.classList.toggle('is-hidden', f !== 'all' && c.dataset.tag !== f));
    }));
  });

  /* ── 숫자 올라가기 ── */
  const countUp = (el) => {
    if (el.dataset.done) return; el.dataset.done = '1';
    const target = +el.dataset.count, tpl = el.textContent.replace(/[\d,]+/, '#');
    if (reduce) return;
    const t0 = performance.now(), dur = 1500;
    const f = (t) => {
      const p = Math.min(1, (t - t0) / dur), v = Math.round(target * (1 - Math.pow(1 - p, 3)));
      el.textContent = tpl.replace('#', v.toLocaleString('ko-KR'));
      if (p < 1) requestAnimationFrame(f);
    };
    el.textContent = tpl.replace('#', '0');
    requestAnimationFrame(f);
  };

  /* ── 나타나기 ([data-rv]) ── */
  const rvs = $$('[data-rv]');
  rvs.forEach((el) => {
    if (el.style.getPropertyValue('--d')) return;
    const sib = [...el.parentElement.children].filter((x) => x.hasAttribute('data-rv'));
    const i = sib.indexOf(el);
    if (i > 0) el.style.setProperty('--d', Math.min(i, 6) * 90 + 'ms');
  });
  const io = new IntersectionObserver((ents) => ents.forEach((en) => {
    if (!en.isIntersecting) return;
    en.target.classList.add('rv-in');
    $$('[data-count]', en.target).forEach(countUp);
    io.unobserve(en.target);
  }), { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });
  rvs.forEach((el) => io.observe(el));

  /* ── 가로 슬라이더 (카드·사례) ── */
  $$('.js-track').forEach((tr) => {
    const ctl = tr.nextElementSibling;
    const prev = ctl && $('.js-prev', ctl), next = ctl && $('.js-next', ctl), bar = ctl && $('.js-bar', ctl);
    const step = () => {
      const c = tr.children[0]; if (!c) return 300;
      return c.getBoundingClientRect().width + (parseFloat(getComputedStyle(tr).columnGap) || 20);
    };
    prev && prev.addEventListener('click', () => tr.scrollBy({ left: -step(), behavior: 'smooth' }));
    next && next.addEventListener('click', () => tr.scrollBy({ left: step(), behavior: 'smooth' }));
    const upd = () => {
      if (!bar) return;
      const max = tr.scrollWidth - tr.clientWidth, vis = clamp(tr.clientWidth / tr.scrollWidth, 0.12, 1);
      const W = bar.parentElement.clientWidth, p = max > 0 ? tr.scrollLeft / max : 0;
      bar.style.setProperty('--tw', vis * 100 + '%');
      bar.style.setProperty('--tx', (p * W * (1 - vis)).toFixed(1) + 'px');
      prev && (prev.disabled = tr.scrollLeft < 4); next && (next.disabled = tr.scrollLeft > max - 4);
    };
    tr.addEventListener('scroll', upd, { passive: true });
    addEventListener('resize', upd); upd();
    // 마우스 끌기
    let down = false, sx = 0, sl = 0, moved = false;
    tr.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse' || e.button) return; down = true; moved = false; sx = e.clientX; sl = tr.scrollLeft; });
    addEventListener('pointermove', (e) => {
      if (!down) return;
      const dx = e.clientX - sx;
      if (!moved && Math.abs(dx) > 6) { moved = true; tr.classList.add('is-drag'); }
      if (moved) tr.scrollLeft = sl - dx;
    });
    addEventListener('pointerup', () => { if (!down) return; down = false; tr.classList.remove('is-drag'); });
    tr.addEventListener('click', (e) => { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
  });

  /* ── 주요 업무 패널 ── */
  const accItems = $$('.acc-item');
  const wideAcc = () => matchMedia('(min-width: 1024px)').matches;
  const setAcc = (it) => accItems.forEach((x) => x.classList.toggle('is-on', x === it));
  accItems.forEach((it) => {
    let t;
    it.addEventListener('mouseenter', () => { if (fine && wideAcc()) t = setTimeout(() => setAcc(it), 140); });
    it.addEventListener('mouseleave', () => clearTimeout(t));
    it.addEventListener('click', () => wideAcc() && setAcc(it));
    it.addEventListener('focus', () => wideAcc() && setAcc(it));
  });

  /* ── 커서 점 ── */
  const cur = $('.cur');
  if (cur && fine && !reduce) {
    let x = -100, y = -100, cx = x, cy = y;
    addEventListener('mousemove', (e) => { x = e.clientX; y = e.clientY; cur.classList.add('is-on'); }, { passive: true });
    d.addEventListener('mouseleave', () => cur.classList.remove('is-on'));
    d.addEventListener('mouseover', (e) => cur.classList.toggle('is-link', !!e.target.closest('a, button, .acc-item:not(.is-on), .card, label')));
    const loop = () => { cx += (x - cx) * 0.2; cy += (y - cy) * 0.2; cur.style.transform = `translate3d(${cx.toFixed(1)}px, ${cy.toFixed(1)}px, 0)`; requestAnimationFrame(loop); };
    loop();
  }

  /* ── 스크롤 연동: 넓어지는 상자 · 패럴랙스 · 헤더 ── */
  const xboxes = $$('.xbox-wrap');
  const pxs = $$('[data-px]');
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const onScroll = () => {
    const vh = innerHeight, y = scrollY;
    for (const w of xboxes) {
      const box = $('.xbox', w), r = w.getBoundingClientRect();
      if (r.bottom < 0 || r.top > vh) continue;
      const start = vh * 0.9, span = Math.max(1, r.height - vh * 0.55);
      const p = reduce ? 1 : clamp((start - r.top) / span, 0, 1), e2 = ease(p);
      const bw = box.clientWidth, mob = innerWidth < 768;
      const narrow = Math.min(bw, mob ? bw * 0.7 : 440);
      box.style.setProperty('--p', e2.toFixed(3));
      box.style.setProperty('--cx', (((bw - narrow) / 2) * (1 - e2)).toFixed(1) + 'px');
      box.style.setProperty('--cr', ((mob ? 110 : 170) * (1 - e2) + (mob ? 20 : 28) * e2).toFixed(1) + 'px');
      box.style.setProperty('--tp', clamp((p - 0.5) / 0.35, 0, 1).toFixed(3));
    }
    if (!reduce) for (const el of pxs) {
      const r = el.parentElement.getBoundingClientRect();
      if (r.bottom < -300 || r.top > vh + 300) continue;
      const c = r.top + r.height / 2 - vh / 2;
      el.style.transform = `translate3d(0, ${(-c * parseFloat(el.dataset.px)).toFixed(1)}px, 0)`;
    }
    if (!html.classList.contains('fp-on')) {
      hd.classList.toggle('is-scrolled', y > 8);
      if (isHome) hd.classList.toggle('is-solid', y > 60);
      body.classList.toggle('show-top', y > 500);
      if (isHome) body.classList.toggle('past-hero', y > vh * 0.6);
    }
  };
  let ticking = false;
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(() => { onScroll(); ticking = false; }); } }, { passive: true });
  addEventListener('resize', onScroll);
  onScroll();

  /* ── 맨 위로 ── */
  let goTop = () => scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  $$('.flt-top').forEach((b) => b.addEventListener('click', () => goTop()));

  if (!isHome) return;

  /* ═════════ 메인 ═════════ */
  const fp = $('.fp'), secs = $$('.fp-sec'), dots = $$('.fp-dots button');
  const mq = matchMedia('(min-width: 1024px) and (min-height: 660px)');
  let cur0 = 0, lock = false, fpOn = false, lastGo = 0, lastWheel = 0, lastAbs = 0, introDone = false;

  const activate = (s) => { s.classList.add('is-active'); $$('[data-count]', s).forEach(countUp); };
  const setTheme = () => {
    const light = secs[cur0].dataset.theme === 'light';
    body.classList.toggle('theme-light', light);
    hd.classList.toggle('is-ink', light);
    dots.forEach((b, i) => { b.classList.toggle('on', i === cur0); b.setAttribute('aria-current', i === cur0 ? 'true' : 'false'); });
    body.classList.toggle('show-top', cur0 > 0);
  };
  const place = (instant) => {
    if (instant) fp.style.transition = 'none';
    fp.style.transform = `translate3d(0, ${-secs[cur0].offsetTop}px, 0)`;
    if (instant) { fp.offsetHeight; fp.style.transition = ''; }
  };
  const go = (i, instant) => {
    i = clamp(i, 0, secs.length - 1);
    if (!fpOn) { secs[i].scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' }); return; }
    if (i === cur0 && !instant) return;
    cur0 = i; lock = true; lastGo = Date.now();
    place(instant); setTheme();
    if (introDone) setTimeout(() => activate(secs[i]), instant ? 0 : 420);
    setTimeout(() => { lock = false; }, instant ? 0 : 1100);
  };
  goTop = () => go(0);

  const enableFP = (on) => {
    fpOn = on;
    html.classList.toggle('fp-on', on);
    if (on) {
      scrollTo(0, 0);
      hd.classList.remove('is-solid', 'is-scrolled');
      place(true); setTheme();
      if (introDone) activate(secs[cur0]);
    } else {
      fp.style.transform = '';
      hd.classList.remove('is-ink'); body.classList.remove('theme-light');
      onScroll();
    }
  };

  addEventListener('wheel', (e) => {
    if (!fpOn) return;
    if (body.classList.contains('menu-open')) return;
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && e.target.closest('.track')) return; // 가로 슬라이더는 그대로
    e.preventDefault();
    if (body.classList.contains('intro-run')) return;
    const now = Date.now(), gap = now - lastWheel, abs = Math.abs(e.deltaY);
    lastWheel = now;
    if (lock) { lastAbs = abs; return; }
    if (abs < 4) return;
    if (now - lastGo < 1700 && gap < 120 && abs <= lastAbs + 6) { lastAbs = abs; return; } // 트랙패드 관성 꼬리
    lastAbs = abs;
    go(cur0 + (e.deltaY > 0 ? 1 : -1));
  }, { passive: false });

  addEventListener('keydown', (e) => {
    if (!fpOn || e.target.closest('input, textarea, select') || body.classList.contains('intro-run')) return;
    const k = e.key;
    if (k === 'ArrowDown' || k === 'PageDown' || (k === ' ' && !e.shiftKey)) { e.preventDefault(); if (!lock) go(cur0 + 1); }
    else if (k === 'ArrowUp' || k === 'PageUp' || (k === ' ' && e.shiftKey)) { e.preventDefault(); if (!lock) go(cur0 - 1); }
    else if (k === 'Home') { e.preventDefault(); go(0); }
    else if (k === 'End') { e.preventDefault(); go(secs.length - 1); }
  });
  let ty = null;
  addEventListener('touchstart', (e) => { ty = e.touches[0].clientY; }, { passive: true });
  addEventListener('touchend', (e) => {
    if (!fpOn || ty === null || lock) return;
    const dy = ty - e.changedTouches[0].clientY; ty = null;
    if (Math.abs(dy) > 50 && !e.target.closest('.track')) go(cur0 + (dy > 0 ? 1 : -1));
  }, { passive: true });
  d.addEventListener('focusin', (e) => {
    if (!fpOn) return;
    const s = e.target.closest('.fp-sec'); const i = secs.indexOf(s);
    if (i >= 0 && i !== cur0) { go(i, true); }
  });
  dots.forEach((b) => b.addEventListener('click', () => go(+b.dataset.go)));
  $$('[data-next]').forEach((b) => b.addEventListener('click', () => go(cur0 + 1)));
  addEventListener('resize', () => { if (fpOn) place(true); });

  // 모바일·태블릿: 화면에 들어오면 활성화
  const sio = new IntersectionObserver((ents) => ents.forEach((en) => {
    if (en.isIntersecting && introDone && !fpOn) activate(en.target);
  }), { threshold: 0.22 });
  secs.forEach((s) => sio.observe(s));

  mq.addEventListener('change', () => enableFP(mq.matches));
  enableFP(mq.matches);

  /* 히어로 슬라이드 */
  const slides = $$('.hero-slide'), heroBar = $('.hero-count .bar i'), heroNo = $('.js-hero-no');
  const video = $('.hero-video');
  let si = 0;
  const DUR = 7000;
  const show = (i) => {
    slides[si].classList.remove('is-on');
    si = (i + slides.length) % slides.length;
    slides[si].classList.add('is-on');
    if (heroNo) heroNo.textContent = String(si + 1).padStart(2, '0');
    if (heroBar) { heroBar.classList.remove('run'); heroBar.offsetWidth; heroBar.style.setProperty('--dur', DUR + 'ms'); heroBar.classList.add('run'); }
  };
  const startHero = () => {
    if (video) { const pr = video.play(); pr && pr.catch(() => {}); }
    show(0);
    if (!reduce) setInterval(() => show(si + 1), DUR);
  };

  /* 인트로 (목헌 참고) */
  const startHome = () => {
    introDone = true;
    startHero();
    if (fpOn) activate(secs[cur0]);
    else secs.forEach((s) => { const r = s.getBoundingClientRect(); if (r.top < innerHeight * 0.8 && r.bottom > 0) activate(s); });
  };
  const intro = $('#intro');
  const runIntro = () => {
    let seen = false;
    try { seen = sessionStorage.getItem('dd_intro') === '1'; } catch (err) {}
    const force = /[?&]intro=1/.test(location.search);
    if (!intro || reduce || (seen && !force)) { if (intro) intro.hidden = true; startHome(); return; }
    try { sessionStorage.setItem('dd_intro', '1'); } catch (err) {}
    body.classList.add('intro-run'); html.classList.add('intro-lock');
    const txt = $('.intro-txt', intro), text = $('.intro-type', intro).dataset.text;
    let finished = false;
    const finish = () => {
      if (finished) return; finished = true;
      intro.classList.add('is-lift');
      body.classList.remove('intro-run'); html.classList.remove('intro-lock');
      setTimeout(startHome, 380);
      setTimeout(() => { intro.hidden = true; }, 1150);
    };
    $('.intro-skip', intro).addEventListener('click', finish);
    requestAnimationFrame(() => requestAnimationFrame(() => intro.classList.add('is-draw')));
    let n = 0;
    const type = () => {
      if (finished) return;
      n += 1; txt.textContent = text.slice(0, n);
      if (n < text.length) setTimeout(type, 72); else setTimeout(finish, 950);
    };
    setTimeout(type, 900);
  };
  runIntro();
})();

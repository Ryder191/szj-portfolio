
(() => {
  'use strict';
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const coarse = matchMedia('(hover: none), (pointer: coarse)');
  const dialog = $('#lightbox');
  const canMove = () => !reduce.matches && !document.hidden && !dialog.open;
  const play = el => el.play().catch(() => {});
  const format = n => String(n).padStart(2, '0');
  const en = document.documentElement.lang === 'en';
  const t = (zh, english) => en ? english : zh;

  // An already running local preview can still serve the previous header template.
  // Reuse its actual links so refreshing an earlier preview also preserves the correct tab order.
  const oldNav = $('.folio-nav.masthead');
  if (oldNav && ['127.0.0.1','localhost'].includes(location.hostname)) {
    const brand = $('.brand',oldNav), locale = $('.locale-switch',oldNav);
    const links = ['resume','about','index','contact'].map(id => $('[data-folio-nav="'+id+'"]',oldNav));
    if (brand && locale && links.every(Boolean)) {
      const group = document.createElement('div');
      group.className = 'desk-links';
      group.append(...links);
      oldNav.classList.remove('masthead','desk-links');
      oldNav.replaceChildren(brand,group,locale);
    }
  }

  const back = $('[data-project-back]');
  if (back) {
    const library = new URL(back.href);
    const libraryDirectory = new URL('./', library);
    const workDirectory = new URL('works/', library).pathname;
    function returnEntry(nav) {
      if (!nav?.currentEntry) return null;
      const entries = nav.entries();
      for (let i = nav.currentEntry.index - 1; i >= 0; i--) {
        if (!entries[i].url) break;
        const url = new URL(entries[i].url);
        if (url.origin !== library.origin) break;
        if (url.pathname === library.pathname || url.pathname === libraryDirectory.pathname) return entries[i];
        if (!url.pathname.startsWith(workDirectory) || !/^[a-z0-9-]+\.html$/.test(url.pathname.slice(workDirectory.length))) break;
      }
      return null;
    }
    back.addEventListener('click', event => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const nav = window.navigation;
      const entry = returnEntry(nav);
      if (!entry) return; // Direct links and new tabs use the section in the current language.
      const { committed, finished } = nav.traverseTo(entry.key);
      event.preventDefault();
      committed.catch(err => {
        if (err.name !== 'AbortError' && back.isConnected) location.assign(back.href);
      });
      finished.catch(() => {});
    });
  }

  const folio = $('.folio-nav');
  const localeLink = $('[data-locale-switch]');
  const otherPage = localeLink && new URL(localeLink.href);
  const stops = folio ? ['poster','resume','about','contents','work','index','honors','screening-room','shot-studies','contact']
    .map(id => document.getElementById(id)).filter(Boolean) : [];
  const markerLine = () => Math.max($('.site-header').offsetHeight + 23, Math.min(innerHeight * .22, 180));
  function currentStop() {
    if (scrollY + innerHeight >= document.documentElement.scrollHeight - 2) {
      // On short screens the last two anchors can reach the same scroll limit.
      const target = document.getElementById(location.hash.slice(1));
      const anchored = target && stops.find(s => s.contains(target));
      const top = target?.getBoundingClientRect().top;
      return anchored && top >= $('.site-header').offsetHeight - 1 && top < innerHeight ? anchored : stops.at(-1);
    }
    return stops.filter(s => s.getBoundingClientRect().top <= markerLine()).at(-1) || stops[0];
  }
  function matchSection() {
    if (!otherPage) return;
    const id = location.hash.slice(1);
    const target = document.getElementById(id);
    let fragment = '';
    if (folio) {
      const active = currentStop();
      const inGallery = active.id === 'work' && target?.closest('#index');
      if (active.id !== 'poster') fragment = target && (active.contains(target) || inGallery) ? id : active.id;
    } else if (target) {
      fragment = id;
    } else if (scrollY > innerHeight * .25) {
      const section = $$('main section[id], .project-body[id]').filter(node => node.getBoundingClientRect().top <= markerLine()).at(-1);
      fragment = section?.id || '';
    }
    otherPage.hash = fragment;
    if (localeLink.href !== otherPage.href) localeLink.href = otherPage.href;
  }
  localeLink?.addEventListener('click', matchSection);
  window.addEventListener('hashchange', matchSection);
  if (folio) {
    const links = new Map($$('[data-folio-nav]', folio).map(link => [link.dataset.folioNav,link]));
    let marked, pending = false;
    function mark() {
      pending = false;
      const { id } = currentStop();
      const next = id === 'poster' ? null : links.get(id === 'contents' ? 'about' : links.has(id) ? id : 'index');
      if (next !== marked) {
        marked?.removeAttribute('aria-current');
        next?.setAttribute('aria-current','location');
        marked = next;
      }
      matchSection();
    }
    function queueMark() {
      if (pending) return;
      pending = true;
      requestAnimationFrame(mark);
    }
    window.addEventListener('scroll', queueMark, {passive:true});
    window.addEventListener('hashchange', queueMark);
    window.addEventListener('resize', queueMark);
    window.addEventListener('pageshow', queueMark);
    document.fonts.ready.then(queueMark);
    mark();
  }

  for (const card of $$('.feature')) {
    const v = $('[data-feature-src]', card);
    if (!v) continue;
    let timer = 0, hovering = false;
    function reset() {
      hovering = false;
      clearTimeout(timer);
      card.classList.remove('is-previewing');
      v.pause();
    }
    card.addEventListener('pointerenter', ev => {
      if (ev.pointerType !== 'mouse' || coarse.matches || !canMove()) return;
      hovering = true;
      timer = setTimeout(() => {
        if (!hovering || !canMove()) return;
        if (!v.hasAttribute('src')) v.src = v.dataset.featureSrc;
        play(v);
      }, 360);
    });
    v.addEventListener('playing', () => {
      if (hovering && canMove()) card.classList.add('is-previewing');
      else v.pause();
    });
    card.addEventListener('pointerleave', reset);
    card.addEventListener('pointercancel', reset);
    reduce.addEventListener('change', () => { if (reduce.matches) reset(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) reset(); });
  }

  // Animated inserts in the project records still use their own viewport playback.
  const loops = $$('video[data-src]').filter(v => v.dataset.lb !== 'film');
  const inView = new Set();
  function syncLoop(v) {
    if (canMove() && inView.has(v)) {
      if (!v.hasAttribute('src')) v.src = v.dataset.src;
      play(v);
    } else {
      v.pause();
    }
  }
  const loopObserver = new IntersectionObserver(entries => {
    entries.forEach(({target:v, intersectionRatio}) => {
      if (intersectionRatio >= .26) inView.add(v);
      else inView.delete(v);
      syncLoop(v);
    });
  },{threshold:.26});
  for (const v of loops) {
    v.addEventListener('playing',() => v.classList.add('playing'));
    loopObserver.observe(v);
  }

  // Each chapter has a contact print in the margin. The rows stay readable
  // while the print follows pointer or keyboard focus.
  const printLayout = matchMedia('(min-width: 761px) and (hover: hover)');
  for (const chapter of $$('[data-archive-chapter]')) {
    const print = $('.archive-print', chapter), rows = $$('.project-row', chapter);
    const still = $('img', print), video = $('video', print);
    const number = $('[data-print-number]', print), title = $('[data-print-title]', print);
    let viewed = rows[0], hovering = null, delay = 0, fade;
    function stopPrint() {
      if (!hovering) return;
      hovering = null;
      clearTimeout(delay);
      video.classList.remove('playing');
      video.pause();
    }
    async function inspect(row) {
      if (viewed !== row) viewed.removeAttribute('data-previewed');
      viewed = row;
      row.setAttribute('data-previewed', '');
      const src = row.dataset.previewImg;
      const current = still.getAttribute('src') === src;
      if (!current) {
        const incoming = new Image();
        incoming.src = src;
        try { await incoming.decode(); } catch (_) { return; }
        if (viewed !== row) return;
        still.src = src;
        still.style.setProperty('--art-position', row.dataset.previewPosition || 'center');
        fade?.cancel();
        if (canMove()) fade = still.animate([{opacity:.68}, {opacity:1}], {duration:240, easing:'ease-out'});
      }
      number.textContent = $('.row-num', row).textContent;
      title.textContent = $('.row-copy strong', row).textContent;
    }
    video.addEventListener('playing', () => {
      if (hovering === viewed && hovering && canMove()) video.classList.add('playing');
      else video.pause();
    });
    for (const row of rows) {
      row.addEventListener('pointerenter', ev => {
        if (!printLayout.matches || ev.pointerType !== 'mouse') return;
        stopPrint();
        inspect(row);
        if (row.dataset.previewVideo && canMove()) {
          hovering = row;
          delay = setTimeout(() => {
            if (hovering !== row || viewed !== row || !canMove()) return;
            if (video.getAttribute('src') !== row.dataset.previewVideo) video.src = row.dataset.previewVideo;
            play(video);
          }, 330);
        }
      });
      row.addEventListener('pointerleave', stopPrint);
      row.addEventListener('pointercancel', stopPrint);
      row.addEventListener('focus', () => {
        if (!printLayout.matches) return;
        if (hovering !== row) stopPrint();
        inspect(row);
      });
    }
    window.addEventListener('scroll', stopPrint, {passive:true});
    document.addEventListener('visibilitychange', stopPrint);
    printLayout.addEventListener('change', stopPrint);
    reduce.addEventListener('change', () => { stopPrint(); if (reduce.matches) fade?.cancel(); });
  }

  // Load the film and its controls on demand; preview loops never get a toolbar.
  const films = $$('video[data-film]');
  const filmJumps = $$('a[data-film-start]');
  for (const v of films) {
    const wrap = v.closest('.film'), btn = $('.playbtn', wrap);
    if (!btn) continue;
    let error, player;
    const report = () => {
      btn.hidden = false;
      if (player) player.bar.hidden = true;
      if (!error) {
        error = document.createElement('p');
        error.className = 'film-error';
        error.setAttribute('role', 'status');
        wrap.append(error);
      }
      error.textContent = t('暂时无法播放，请再试一次。','Couldn’t play this video. Please try again.');
    };
    v.addEventListener('error', report);
    v.addEventListener('playing', () => {
      wrap.classList.add('is-started');
      if (player) player.bar.hidden = false;
      films.filter(other => other !== v).forEach(other => other.pause());
      if (!btn.hidden && wrap.classList.contains('film-showcase') && wrap.getBoundingClientRect().bottom > innerHeight) {
        wrap.scrollIntoView({ block: 'nearest' });
      }
      if (document.activeElement === btn) v.focus({ preventScroll: true });
      btn.hidden = true;
      error?.remove(); error = null;
    });
    async function startFilm(at) {
      if (!v.hasAttribute('src') || v.error) v.src = v.dataset.film;
      if (Number.isFinite(at)) v.currentTime = at;
      player ||= window.makeFilmPlayer(v,wrap);
      player.bar.hidden = false;
      try { await v.play(); } catch (err) { if (err.name !== 'AbortError') report(); }
    }
    btn.addEventListener('click', () => startFilm());
    const screen = v.closest('.project-hero[id]');
    for (const jump of filmJumps) {
      if (!screen || jump.hash !== '#' + screen.id) continue;
      jump.addEventListener('click', ev => {
        if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
        startFilm(Number(jump.dataset.filmStart));
        if (document.activeElement === jump) v.focus({ preventScroll:true });
      });
    }
  }

  // The dialog manages focus and Escape natively; arrow keys switch within each gallery.
  const media = $$('[data-lb]'), content = $('.lb-content', dialog);
  const previous = $('.lb-prev', dialog), next = $('.lb-next', dialog);
  const closer = $('.lb-close', dialog), total = $('.lb-count', dialog);
  let slide = 0, hits = [], caller, galleryPlayer;
  function stopGallery() {
    if (!galleryPlayer) return;
    galleryPlayer.destroy(); galleryPlayer = null;
    const v = $('video',content);
    if (v) { v.removeAttribute('src'); v.load(); }
  }
  function show(n) {
    stopGallery();
    slide = (n + hits.length) % hits.length;
    const match = hits[slide], item = match.matches('img,video') ? match : $('img', match);
    const movie = item.tagName === 'VIDEO';
    const node = document.createElement(movie ? 'video' : 'img');
    total.textContent = format(slide + 1) + ' / ' + format(hits.length) + '  ·  ' + (movie ? t('片段','Video') : t('图片','Image'));
    if (movie) {
      node.playsInline = true;
      node.setAttribute('aria-label',item.getAttribute('aria-label') || t('项目片段','Project clip'));
      node.src = item.dataset.src || item.currentSrc;
      node.poster = item.poster;
      node.loop = item.dataset.lb !== 'film'; node.muted = node.loop;
    } else {
      node.alt = item.alt || t('作品大图','Full-size image');
      node.src = item.dataset.fullSrc || item.currentSrc || item.src;
      node.addEventListener('click', () => dialog.close());
    }
    node.addEventListener('error', () => {
      if (!node.isConnected) return;
      const p = document.createElement('p');
      p.textContent = t('无法加载此媒体。','This media couldn’t be loaded.');
      stopGallery();content.replaceChildren(p);
    });
    if (movie) {
      const shell = document.createElement('div');shell.append(node);content.replaceChildren(shell);
      galleryPlayer = window.makeFilmPlayer(node,shell);play(node);
    } else content.replaceChildren(node);
  }
  function open(item) {
    caller = item;
    const group = item.closest('.case-section, .project-hero, .honor-grid, .about-grid, .edit-timeline');
    hits = group ? $$('[data-lb]', group).filter(n => n.getClientRects().length > 0) : [item];
    previous.disabled = next.disabled = hits.length < 2;
    dialog.showModal();
    films.forEach(v => v.pause());
    loops.forEach(syncLoop);
    show(hits.indexOf(item));
    closer.focus();
  }
  for (const item of media) {
    item.addEventListener('click', () => open(item));
    if (item.tagName === 'BUTTON') continue;
    item.tabIndex = 0;
    item.setAttribute('role', 'button');
    if (!item.hasAttribute('aria-label')) item.setAttribute('aria-label', item.tagName === 'VIDEO' ? t('放大播放片段','Play full-size clip') : t('查看大图','View full-size image') + (item.alt ? t('：',': ') + item.alt : ''));
    item.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(item); }
    });
  }
  closer.addEventListener('click', () => dialog.close());
  previous.addEventListener('click', () => show(slide - 1));
  next.addEventListener('click', () => show(slide + 1));
  dialog.addEventListener('keydown', e => {
    if (hits.length < 2 || e.target.closest('video,.film-tools') || e.defaultPrevented) return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      show(slide + (e.key === 'ArrowRight' ? 1 : -1));
    }
  });
  content.addEventListener('click', e => { if (e.target === content) dialog.close(); });
  dialog.addEventListener('close', () => {
    stopGallery();
    content.replaceChildren();
    caller?.focus({ preventScroll: true });
    loops.forEach(syncLoop);
  });
  document.addEventListener('visibilitychange', () => {
    loops.forEach(syncLoop);
    if (document.hidden) { films.forEach(v => v.pause()); $('video',content)?.pause(); }
  });
  reduce.addEventListener('change', () => loops.forEach(syncLoop));

  // Motion follows the viewport; deep links and reduced motion still show full content.
  if (window.gsap && window.ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);
    gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
      $$('[data-reveal]').forEach(el => {
        if (el.getBoundingClientRect().top < innerHeight * .91) return;
        gsap.from(el, {
          opacity: .38, y: 18, duration: .57, ease: 'power2.out', clearProps: 'transform,opacity',
          scrollTrigger: { trigger: el, start: 'top 94%', once: true }
        });
      });
    });
    gsap.matchMedia().add('(min-width: 761px) and (prefers-reduced-motion: no-preference)', () => {
      $$('.feature-insert').forEach(insert => gsap.fromTo(insert, {y:24}, {
        y:-34, ease:'none',
        scrollTrigger:{trigger:insert.closest('.feature-stage'), start:'top bottom', end:'bottom top', scrub:.45}
      }));
    });
    document.fonts.ready.then(() => ScrollTrigger.refresh());
  }
})();


(() => {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const mouse = matchMedia('(hover: hover) and (pointer: fine)');
  const lightbox = document.getElementById('lightbox');
  const gallery = document.getElementById('index');
  const filters = [...gallery.querySelectorAll('[data-filter]')];
  const sections = [...gallery.querySelectorAll('[data-card-group]')];
  const count = gallery.querySelector('[data-filter-count]');
  const printedCount = gallery.querySelector('h2 span');
  let activeCard = null;

  function showGroup(group) {
    let n = 0;
    for (const section of sections) {
      const size = section.querySelectorAll('[data-work-card]').length;
      section.hidden = !size || (group !== 'all' && section.dataset.cardGroup !== group);
      if (!section.hidden) n += size;
    }
    for (const a of filters) {
      if (a.dataset.filter === group) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    }
    printedCount.textContent = '(' + n + ')';
    count.textContent = document.documentElement.lang === 'en' ? 'Showing ' + n + ' projects' : '显示 ' + n + ' 个作品';
    if (activeCard?.card.closest('[hidden]')) stop();
  }
  function syncFilter() {
    const id = location.hash.slice(1);
    const group = filters.find(a => a.dataset.filter === id)?.dataset.filter;
    if (group) showGroup(group);
    else if (!id || id === 'index') showGroup('all');
    return group;
  }
  const directoryFilters = document.querySelectorAll('[data-directory-filter]');
  [...filters, ...directoryFilters].forEach(a => a.addEventListener('click', e => {
    if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    if (location.hash !== a.hash) history.pushState(null, '', a.hash);
    showGroup(a.dataset.filter || a.dataset.directoryFilter);
    if (a.dataset.directoryFilter) gallery.scrollIntoView({block:'start'});
  }));
  window.addEventListener('hashchange', syncFilter);
  showGroup('all');
  const group = syncFilter();
  const visit = performance.getEntriesByType('navigation')[0];
  if (group && visit?.type !== 'back_forward') {
    window.addEventListener('load', () => gallery.scrollIntoView({block:'start'}), {once:true});
  }

  function stop() {
    if (!activeCard) return;
    const { card, video, button, delay } = activeCard;
    activeCard = null;
    clearTimeout(delay);
    card.classList.remove('is-atlas-playing');
    button.setAttribute('aria-pressed', 'false');
    video.pause();
    if (video.hasAttribute('src')) {
      video.removeAttribute('src');
      video.load();
    }
  }
  function allowed(manual) {
    return !document.hidden && !lightbox.open && (manual || (mouse.matches && !reduced.matches));
  }
  function request(card, video, button, manual) {
    if (!allowed(manual)) return;
    stop();
    const playing = { card, video, button, manual, delay:0 };
    activeCard = playing;
    const start = () => {
      if (activeCard !== playing || !allowed(manual)) return;
      video.src = video.dataset.cardSrc;
      if (manual) button.setAttribute('aria-pressed', 'true');
      video.play().catch(() => { if (activeCard === playing) stop(); });
    };
    if (manual) start();
    else playing.delay = setTimeout(start, card.classList.contains('atlas-lead') ? 1100 : 265);
  }
  const view = new IntersectionObserver(entries => {
    if (entries.some(e => e.target === activeCard?.card && !e.isIntersecting)) stop();
  });
  for (const card of document.querySelectorAll('[data-motion-card]')) {
    const video = card.querySelector('[data-card-src]');
    const button = card.querySelector('[data-card-play]');
    if (!video || !button) continue;
    view.observe(card);
    card.addEventListener('pointerenter', e => {
      if (e.pointerType === 'mouse' && (!activeCard?.manual || activeCard.card !== card)) request(card, video, button, false);
    });
    for (const event of ['pointerleave','pointercancel']) card.addEventListener(event, () => {
      if (activeCard?.card === card && !activeCard.manual) stop();
    });
    button.addEventListener('click', () => {
      if (activeCard?.card === card && activeCard.manual) stop();
      else request(card, video, button, true);
    });
    video.addEventListener('playing', () => {
      if (activeCard?.card === card && allowed(activeCard.manual)) card.classList.add('is-atlas-playing');
    });
    video.addEventListener('error', () => { if (activeCard?.video === video) stop(); });
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  reduced.addEventListener('change', stop);
  mouse.addEventListener('change', stop);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') stop(); });
  new MutationObserver(() => { if (lightbox.open) stop(); }).observe(lightbox, {attributes:true, attributeFilter:['open']});

  // The personal information, experience and metrics drift at different depths.
  const resume = document.querySelector('[data-resume-scene]');
  const desktop = matchMedia('(min-width: 761px)');
  let x = 0, y = 0, frame = 0, near = false;
  const enabled = () => desktop.matches && mouse.matches && !reduced.matches && near;
  const clamp = n => Math.min(1, Math.max(-1, n));
  function paint() {
    frame = 0;
    const on = enabled(), r = resume.getBoundingClientRect();
    resume.style.setProperty('--resume-x', (on ? x : 0) + 'px');
    resume.style.setProperty('--resume-y', (on ? y : 0) + 'px');
    resume.style.setProperty('--resume-scroll', (on ? 18 * clamp((innerHeight * .5 - r.y - r.height * .5) / innerHeight) : 0) + 'px');
  }
  function queue() { if (!frame) frame = requestAnimationFrame(paint); }
  resume.addEventListener('pointermove', e => {
    if (!enabled() || e.pointerType !== 'mouse' || e.buttons) return;
    const r = resume.getBoundingClientRect();
    x = 17 * clamp(2 * (e.clientX - r.x) / r.width - 1);
    y = 12 * clamp(2 * (e.clientY - r.y) / r.height - 1);
    queue();
  }, {passive:true});
  function reset() { x = y = 0; queue(); }
  resume.addEventListener('pointerleave', reset);
  new IntersectionObserver(([e]) => { near = e.isIntersecting; if (!near) reset(); else queue(); }).observe(resume);
  window.addEventListener('scroll', () => { if (near) queue(); }, {passive:true});
  window.addEventListener('resize', reset);
  for (const mq of [reduced, mouse, desktop]) mq.addEventListener('change', reset);

})();

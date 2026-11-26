(() => {
  'use strict';
  for (const index of document.querySelectorAll('[data-shot-index]')) {
    const track = index.querySelector('.pu-track');
    const tabs = [...track.querySelectorAll('a')];
    const panels = tabs.map(tab => document.getElementById(tab.hash.slice(1)));
    if (!panels.length || panels.some(panel => !panel)) continue;
    const stills = panels.map(panel => panel.querySelector('img'));
    const fragment = () => tabs.findIndex(tab => tab.hash === location.hash);
    let active = -1;
    function select(n, focus = false) {
      if (n !== active) {
        active = n;
        stills[n].loading = 'eager';
        tabs.forEach((tab, i) => {
          const selected = i === n;
          tab.tabIndex = selected ? 0 : -1;
          tab.setAttribute('aria-selected', String(selected));
          panels[i].hidden = !selected;
        });
      }
      if (focus) tabs[n].focus({ preventScroll:true });
    }
    track.setAttribute('role', 'tablist');
    tabs.forEach((tab, i) => {
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-controls', panels[i].id);
      panels[i].setAttribute('role', 'tabpanel');
      panels[i].setAttribute('aria-labelledby', tab.id);
      tab.addEventListener('click', ev => {
        if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
        ev.preventDefault();
        select(i, true);
      });
      tab.addEventListener('keydown', ev => {
        const last = tabs.length - 1;
        const next = { ArrowLeft:i === 0 ? last : i - 1, ArrowRight:i === last ? 0 : i + 1, Home:0, End:last }[ev.key];
        if (next === undefined) return;
        ev.preventDefault();
        select(next, true);
      });
    });
    select(Math.max(0, fragment()));
    index.setAttribute('data-index-ready', '');
    const warm = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      warm.disconnect();
      stills.forEach(img => { img.loading = 'eager'; img.decode().catch(() => {}); });
    }, { rootMargin:'260px 0px' });
    warm.observe(index);
    window.addEventListener('hashchange', () => {
      const next = fragment();
      if (next >= 0) select(next);
    });
  }
})();

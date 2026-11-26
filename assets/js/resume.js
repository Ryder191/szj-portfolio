(() => {
  'use strict';
  const mount = document.querySelector('.cv-mount');
  if (!mount) return;
  const paper = mount.querySelector('.cv-paper'), score = mount.querySelector('.cv-score');
  const toggle = mount.querySelector('[data-cv-toggle]');
  const phone = matchMedia('(max-width:600px) and (orientation:portrait)');
  let pending = false;
  function fit() {
    pending = false;
    if (mount.dataset.view !== 'fit') return;
    // Set real type at the available measure first. Only unusually long edits need optical scaling.
    const room = paper.getBoundingClientRect().height;
    const measure = () => parseFloat(getComputedStyle(score).height);
    const set = n => score.style.setProperty('--cv-density',String(n));
    set(1);
    if (measure() > room + .08) {
      let lo = .82, hi = 1;
      for (let i = 0; i < 5; i++) {
        const mid = (lo + hi) / 2;
        set(mid);
        if (measure() <= room + .08) lo = mid; else hi = mid;
      }
      set(lo);
    }
    const natural = measure();
    const ratio = natural <= room + .08 ? 1 : room / Math.max(1,natural);
    score.toggleAttribute('data-overset',ratio < 1);
    score.style.setProperty('--cv-fit', String(ratio));
  }
  function queue() { if (!pending) { pending = true; requestAnimationFrame(fit); } }
  function view(mode, jump = false) {
    mount.dataset.view = mode;
    mount.setAttribute('data-cv-ready','');
    toggle.textContent = mode === 'fit' ? toggle.dataset.read : toggle.dataset.fit;
    fit();
    if (jump) mount.scrollIntoView({behavior:'instant', block:'start'});
  }
  toggle.hidden = false;
  toggle.addEventListener('click', () => view(mount.dataset.view === 'fit' ? 'read' : 'fit', true));
  mount.addEventListener('keydown', e => {
    if (e.key === 'Escape' && mount.dataset.view === 'read') {
      view('fit',true);toggle.focus({preventScroll:true});
    }
  });
  const initial = () => view(phone.matches ? 'read' : 'fit');
  phone.addEventListener('change',initial);
  const observer = new ResizeObserver(queue);
  observer.observe(paper);observer.observe(score);
  document.fonts.ready.then(queue);
  initial();
})();

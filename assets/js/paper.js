(() => {
  'use strict';
  const root = document.documentElement;
  const motion = matchMedia('(prefers-reduced-motion: no-preference)');
  let pickedFrame;

  function isProject(url) {
    return url.origin === location.origin && /\/works\/[a-z0-9-]+\.html$/.test(url.pathname);
  }
  function share(frame, transition) {
    frame.setAttribute('data-paper-frame', '');
    const release = () => frame.removeAttribute('data-paper-frame');
    transition.finished.then(release, release);
  }
  function allowTransition(transition) {
    if (!transition) return false;
    // Skipping the visual transition can reject ready while navigation succeeds.
    transition.ready.catch(() => {});
    if (motion.matches) return true;
    transition.skipTransition();
    return false;
  }
  // Give the source and destination the same name just for the navigation.
  // The link keeps its normal browser behavior with or without view transitions.
  document.addEventListener('click', event => {
    pickedFrame = null;
    if (!motion.matches || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest('a[href]');
    if (!link || (link.target && link.target !== '_self') || link.hasAttribute('download')) return;
    const url = new URL(link.href);
    if (!isProject(url)) return;
    const frame = link.querySelector('.atlas-image, .next-image, .strip-frame, :scope > img');
    if (frame) pickedFrame = {path: url.pathname, frame};
  }, {capture: true});
  addEventListener('pageswap', event => {
    const from = pickedFrame;
    pickedFrame = null;
    if (!allowTransition(event.viewTransition)) return;
    const href = event.activation?.entry?.url;
    if (!href || !from?.frame.isConnected) return;
    const next = new URL(href);
    if (isProject(next) && from.path === next.pathname) share(from.frame, event.viewTransition);
  });
  addEventListener('pagereveal', event => {
    if (!allowTransition(event.viewTransition)) return;
    root.setAttribute('data-paper-moved', '');
    if (!isProject(new URL(location.href))) return;
    const frame = document.querySelector('.project > .project-hero :is(.lead-film, .opening-visual)');
    if (frame) share(frame, event.viewTransition);
  });
})();

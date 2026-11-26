(() => {
  'use strict';
  const mouse = matchMedia('(hover:hover) and (pointer:fine)');
  const lightbox = document.getElementById('lightbox');
  const play = '.atlas-preview,.playbtn,[data-film-start],.project-remote .opening-visual';
  const links = '.atlas-lead-link,.atlas-tile-link,.atlas-picks a,.next-project,.project-record .opening-visual,[data-work-hint]';
  const media = play + ',' + links + ',[data-lb]';
  let marker, active, frame = 0, point;

  function hide() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    point = null;
    active?.classList.remove('has-work-pointer');
    active = null;
    if (marker) marker.hidden = true;
  }
  function paint() {
    frame = 0;
    const { x, y, target } = point;
    const scope = target.closest('[data-work-cursor]');
    const mode = scope?.dataset.workCursor;
    const poster = target.closest('.poster-stage');
    const item = mode && mode !== 'off' && (target.closest(media) || (poster && !target.closest('a,button') && poster));
    if (!item || !scope.contains(item) || !item.isConnected || item.matches(':disabled,video[controls]') || lightbox?.open) {
      hide();
      return;
    }
    if (!marker) {
      marker = document.createElement('span');
      marker.className = 'work-pointer';
      marker.setAttribute('aria-hidden','true');
      marker.innerHTML = '<svg viewBox="0 0 28 28" fill="none"><path d="M3 9V3H9 M19 3h6v6 M25 19v6h-6 M9 25H3v-6" stroke="currentColor" stroke-width="1.18"/><circle cx="14" cy="14" r="1.25" fill="currentColor"/></svg>';
      document.body.append(marker);
    }
    if (item !== active) {
      active?.classList.remove('has-work-pointer');
      active = item;
      active.classList.add('has-work-pointer');
    }
    marker.dataset.cue = mode === 'action' ? item.matches(play) ? 'play' : item.matches(media) ? 'open' : 'still' : 'still';
    marker.style.transform = `translate3d(${x-14}px,${y-14}px,0)`;
    marker.hidden = false;
  }
  function move(event) {
    if (!mouse.matches || event.pointerType !== 'mouse' || event.buttons || !(event.target instanceof Element)) {
      hide();
      return;
    }
    point = { x:event.clientX, y:event.clientY, target:event.target };
    if (!frame) frame = requestAnimationFrame(paint);
  }
  document.addEventListener('pointermove',move,{passive:true});
  document.addEventListener('pointerup',move,{passive:true});
  document.addEventListener('pointerout',event => { if (!event.relatedTarget) hide(); },{passive:true});
  for (const event of ['pointerdown','pointercancel','keydown','visibilitychange']) document.addEventListener(event,hide);
  for (const event of ['blur','pageswap','resize','scroll']) addEventListener(event,hide,{capture:true,passive:true});
  mouse.addEventListener('change',hide);
})();

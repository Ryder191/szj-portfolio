(() => {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const lightbox = document.getElementById('lightbox');
  const canPlay = () => !reduced.matches && !document.hidden && !lightbox.open;
  const play = video => { if (video.paused) video.play().catch(() => {}); };
  function observe(node, threshold, update) {
    new IntersectionObserver(([entry]) => update(entry.intersectionRatio >= threshold), {threshold}).observe(node);
  }

  const screen = document.querySelector('[data-screening]');
  let syncScreen = () => {};
  if (screen) {
  const picture = screen.querySelector('.screening-image');
  const poster = picture.querySelector('img'), reel = picture.querySelector('video');
  const name = screen.querySelector('[data-screening-name]');
  const count = screen.querySelector('[data-screening-count]');
  const clips = JSON.parse(screen.querySelector('#reel-data').textContent);
  const pad = n => String(n).padStart(2,'0');
  let clip = 0, screenNear = false, missed = 0;
  syncScreen = () => {
    if (!screenNear || !canPlay() || missed >= clips.length) {
      reel.pause();
      return;
    }
    if (!reel.hasAttribute('src')) reel.src = clips[clip].video;
    play(reel);
  };
  function advance() {
    clip = (clip + 1) % clips.length;
    const next = clips[clip];
    picture.classList.remove('is-playing');
    picture.style.setProperty('--art-position',next.position);
    poster.src = next.poster;
    name.textContent = next.title;
    count.textContent = pad(clip + 1) + ' / ' + pad(clips.length);
    reel.removeAttribute('src');
    if (screenNear && canPlay()) {
      syncScreen();
    } else {
      // Clearing the source also clears a previously decoded frame.
      reel.load();
    }
  }
  reel.addEventListener('playing', () => {
    if (!screenNear || !canPlay()) { reel.pause(); return; }
    missed = 0;
    picture.classList.add('is-playing');
  });
  reel.addEventListener('ended', advance);
  reel.addEventListener('error', () => {
    if (++missed < clips.length) advance();
    else picture.classList.remove('is-playing');
  });
  observe(picture,.15,visible => { screenNear = visible; syncScreen(); });
  }

  const belt = document.querySelector('[data-study-belt]');
  const track = belt.querySelector('.study-track'), run = track.firstElementChild;
  const duplicate = run.cloneNode(true);
  duplicate.setAttribute('aria-hidden','true');
  track.append(duplicate);
  belt.classList.add('has-study-loop');
  const videos = Array.from(track.querySelectorAll('video'));
  const visibleVideos = new Set();
  let beltNear = false;
  const beltRunning = () => beltNear && canPlay();
  function syncShot(video) {
    if (beltRunning() && visibleVideos.has(video)) {
      if (!video.hasAttribute('src')) video.src = video.dataset.studySrc;
      play(video);
    } else {
      video.pause();
    }
  }
  function syncBelt() {
    belt.classList.toggle('is-moving',beltRunning());
    videos.forEach(syncShot);
  }
  const frameObserver = new IntersectionObserver(entries => {
    for (const entry of entries) {
      const video = entry.target;
      if (entry.intersectionRatio >= .22) visibleVideos.add(video);
      else visibleVideos.delete(video);
      syncShot(video);
    }
  }, {root:belt, threshold:.22});
  for (const video of videos) {
    video.addEventListener('playing', () => {
      if (beltRunning() && visibleVideos.has(video)) video.classList.add('is-playing');
      else video.pause();
    });
    frameObserver.observe(video);
  }
  // Both runs have the same width, including the gap at the seam.
  new ResizeObserver(([entry]) => {
    const width = entry.borderBoxSize?.[0]?.inlineSize || run.offsetWidth;
    track.style.setProperty('--study-period', Math.max(20, width / 49) + 's');
  }).observe(run);
  observe(belt,.15,visible => { beltNear = visible; syncBelt(); });
  function sync() { syncScreen(); syncBelt(); }
  document.addEventListener('visibilitychange', sync);
  reduced.addEventListener('change', sync);
  new MutationObserver(sync).observe(lightbox,{attributes:true,attributeFilter:['open']});
})();

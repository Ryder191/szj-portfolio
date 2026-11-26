(() => {
  'use strict';
  const en = document.documentElement.lang === 'en';
  const t = (zh, english) => en ? english : zh;
  const icons = {
    play:'<path d="M8 4.5 18 12 8 19.5Z"/>',pause:'<path d="M8 5.5v13M16 5.5v13"/>',
    sound:'<path d="M3 9h4l5-4v14l-5-4H3zm12.5-.8a6 6 0 0 1 0 7.6m2.7-10.4a10 10 0 0 1 0 13.2"/>',
    silent:'<path d="M3 9h4l5-4v14l-5-4H3zm12.5.5 5 5m0-5-5 5"/>',
    expand:'<path d="M4 9V4h5m6 0h5v5m0 6v5h-5M9 20H4v-5"/>',
    contract:'<path d="M9 4v5H4m11-5v5h5m0 6h-5v5M4 15h5v5"/>'
  };
  const svg = name => '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">'+icons[name]+'</svg>';
  const time = n => { n = Math.max(0,Math.floor(Number.isFinite(n) ? n : 0));return Math.floor(n/60)+':'+String(n%60).padStart(2,'0'); };
  document.addEventListener('contextmenu', e => {
    if (e.target instanceof Element && e.target.closest('video,.watch-player')) e.preventDefault();
  },true);

  window.makeFilmPlayer = (video, shell) => {
    const ctl = new AbortController(), signal = ctl.signal;
    const on = (el,type,fn) => el.addEventListener(type,fn,{signal});
    video.controls = false;video.playsInline = true;video.draggable = false;video.tabIndex = 0;
    video.setAttribute('controlslist','nodownload noremoteplayback');
    video.setAttribute('disablepictureinpicture','');video.setAttribute('disableremoteplayback','');
    shell.classList.add('watch-player');
    const bar = document.createElement('div');
    bar.className = 'film-tools';bar.setAttribute('role','group');bar.setAttribute('aria-label',t('视频播放控制','Video controls'));
    const button = id => {
      const b = document.createElement('button');b.type='button';b.dataset.control=id;return b;
    };
    function label(b,icon,name) {
      if (b.getAttribute('aria-label')!==name) { b.innerHTML=svg(icon);b.setAttribute('aria-label',name);b.title=name; }
    }
    const range = (id,name,max,step) => {
      const r = document.createElement('input');r.type='range';r.min='0';r.max=max;r.step=step;
      r.value='0';r.dataset.control=id;r.setAttribute('aria-label',name);return r;
    };
    const toggle=button('play'), mute=button('mute'), full=button('fullscreen');
    const seek=range('seek',t('播放进度','Playback position'),0,.01), vol=range('volume',t('音量','Volume'),1,.01);
    const stamp=document.createElement('span');stamp.className='film-time';stamp.setAttribute('aria-hidden','true');
    bar.append(toggle,seek,stamp,mute,vol,full);shell.append(bar);
    let idle=0, savedVolume=1, dragging=false, fallback=false;
    const awake = () => {
      clearTimeout(idle);shell.classList.remove('player-idle');
      if (!video.paused && !video.ended) idle=setTimeout(()=>shell.classList.add('player-idle'),2500);
    };
    const duration = () => Number.isFinite(video.duration) ? video.duration : 0;
    const inFull = () => fallback || document.fullscreenElement===shell || document.webkitFullscreenElement===shell;
    const fullscreenUI = () => label(full, inFull()?'contract':'expand',inFull()?t('退出全屏','Exit fullscreen'):t('全屏','Fullscreen'));
    function viewport(value) {
      fallback=value;shell.classList.toggle('film-viewport',value);
      document.documentElement.classList.toggle('has-film-viewport',value);fullscreenUI();awake();
    }
    async function fullscreen() {
      if (fallback) { viewport(false);return; }
      const exit=document.exitFullscreen || document.webkitExitFullscreen;
      const enter=shell.requestFullscreen || shell.webkitRequestFullscreen;
      try {
        if (inFull() && exit) await exit.call(document);
        else if (enter) await enter.call(shell);
        else viewport(true);
      } catch { viewport(!inFull()); }
    }
    const sync = () => {
      const d=duration(), pos=video.currentTime || 0;
      seek.disabled=!d;seek.max=d;
      if (!dragging) seek.value=pos;
      seek.style.setProperty('--fill',(d ? pos/d*100 : 0)+'%');
      seek.setAttribute('aria-valuetext',time(pos)+' / '+time(d));stamp.textContent=time(pos)+' / '+time(d);
    };
    const state = () => {
      const stop=video.paused || video.ended;
      label(toggle,stop?'play':'pause',stop?t('播放','Play'):t('暂停','Pause'));sync();awake();
    };
    const audio = () => {
      const quiet=video.muted || video.volume===0;
      label(mute,quiet?'silent':'sound',quiet?t('取消静音','Unmute'):t('静音','Mute'));
      vol.value=video.muted?0:video.volume;vol.style.setProperty('--fill',(Number(vol.value)*100)+'%');
      vol.setAttribute('aria-valuetext',Math.round(vol.value*100)+'%');
    };
    const togglePlay=() => { if (video.paused || video.ended) video.play().catch(()=>{}); else video.pause(); };
    const toggleMute=() => {
      if (video.volume===0) {video.volume=savedVolume || 1;video.muted=false;} else video.muted=!video.muted;
      audio();awake();
    };
    const jump=value=>{ if (duration()) video.currentTime=Math.max(0,Math.min(duration(),value)); };
    on(toggle,'click',togglePlay);on(video,'click',togglePlay);on(mute,'click',toggleMute);on(full,'click',fullscreen);
    on(seek,'pointerdown',()=>{dragging=true;awake();});
    for (const ev of ['pointerup','pointercancel','blur']) on(seek,ev,()=>{dragging=false;sync();});
    on(seek,'input',()=>{jump(Number(seek.value));awake();});
    on(vol,'input',()=>{ const n=Number(vol.value);if(n) savedVolume=n;video.volume=n;video.muted=!n;audio();awake(); });
    for (const ev of ['loadedmetadata','durationchange','timeupdate','seeked','emptied']) on(video,ev,sync);
    for (const ev of ['play','pause','ended']) on(video,ev,state);
    on(video,'volumechange',audio);
    for (const ev of ['pointermove','pointerdown','focusin']) on(shell,ev,awake);
    for (const ev of ['fullscreenchange','webkitfullscreenchange']) on(document,ev,fullscreenUI);
    on(document,'keydown',e=>{ if(fallback && e.key==='Escape'){e.preventDefault();viewport(false);} });
    on(shell,'keydown',e=>{
      if (e.target!==video || e.altKey || e.metaKey || e.ctrlKey) return;
      switch(e.key.toLowerCase()){
        case ' ': case 'k': case 'enter': togglePlay();break;
        case 'm':toggleMute();break;
        case 'f':fullscreen();break;
        case 'arrowleft':jump(video.currentTime-5);break;
        case 'arrowright':jump(video.currentTime+5);break;
        case 'home':jump(0);break;
        case 'end':jump(duration());break;
        default:return;
      }
      e.preventDefault();e.stopPropagation();awake();
    });
    state();audio();fullscreenUI();
    return { bar, destroy(){
      if(fallback)viewport(false);
      clearTimeout(idle);ctl.abort();video.pause();bar.remove();shell.classList.remove('watch-player','player-idle');
    }};
  };
})();

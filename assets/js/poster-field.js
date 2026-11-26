(() => {
  'use strict';
  const canvas = document.querySelector('[data-poster-field]');
  const ctx = canvas?.getContext('2d', {alpha:true});
  if (!ctx) return;
  const stage = canvas.closest('#poster'), dialog = document.getElementById('lightbox');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const atlas = document.createElement('canvas'), grain = document.createElement('canvas');
  const glyphs = '+:;=.·•∴×/0123456789abcdefghijklmnopqrstuvwxyz';
  const TAU = Math.PI * 2;
  const clamp = n => Math.max(0,Math.min(1,n));
  const smooth = (a,b,v) => { const n=clamp((v-a)/(b-a));return n*n*(3-2*n); };
  const fract = n => n-Math.floor(n);
  function random(i,j) {
    let h = Math.imul(i + 1267,1597334677) ^ Math.imul(j + 1871,3812015801);
    h=Math.imul(h ^ h>>>15,2246822507);return ((h ^ h>>>13)>>>0)/4294967296;
  }
  let width=0,height=0,ratio=1,cx,cy,sx,sy,tileW,tileH,glyphW,glyphH,baseSize,tail,sealX,sealY,invX,invY;
  let grains=[],tracks=[],near=true,frame=0,resizeFrame=0,last=0,time=0;
  const point={x:0,y:0};
  function typesetGlyphs(size) {
    tileW = Math.ceil(size * 1.64 * ratio);
    tileH = Math.ceil(size * 1.8 * ratio);
    glyphW = tileW / ratio;
    glyphH = tileH / ratio;
    atlas.width = glyphs.length * tileW;
    atlas.height = tileH;
    const ink = atlas.getContext('2d');
    ink.font = `400 ${size * ratio}px "IBM Plex Mono", monospace`;
    ink.textAlign = 'center';
    ink.textBaseline = 'middle';
    ink.fillStyle = '#f3f3f3';
    ink.shadowColor = '#ffffff62';
    ink.shadowBlur = Math.max(2, size * ratio * .26);
    [...glyphs].forEach((char, index) => ink.fillText(char, (index + .5) * tileW, tileH * .52));
  }

  // Three ribbons emerge under the seal. Each letter has its own lifetime and
  // moves from a small radius to a large one before dissolving and respawning.
  function project(r,arm,lane,shift,turn) {
    const theta=arm+4.98*Math.log1p(1.85*r)-.15*r+turn+lane*(.115+.093*r)+.096*Math.sin(4.3*r+arm);
    const d=r*(1+.044*Math.sin(theta*3-.55)) + lane*.041 + shift;
    const u=Math.cos(theta)*d, v=Math.sin(theta)*d;
    point.x=cx+sx*(u+.085*v);
    point.y=cy+sy*(v-.245*u+.042*u*u+.037*d*d);
  }
  function compose() {
    const rect=canvas.getBoundingClientRect();
    width=rect.width;height=rect.height;if(!width || !height) return;
    const seal=stage.querySelector('[data-seal]').getBoundingClientRect();
    sealX=seal.left+seal.width*.5-rect.left;sealY=seal.top+seal.height*.5-rect.top;
    invX=1/(seal.width*.315);invY=1/(seal.height*.31);
    ratio=Math.min(devicePixelRatio || 1,1.65,Math.sqrt(2200000/(width*height)));
    canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);
    ctx.setTransform(ratio,0,0,ratio,0,0);
    const narrow=width/height<.84;
    cx=width*.5;cy=height*(narrow?.40:.432);
    sx=width*(narrow?.585:.467);sy=height*(narrow?.325:.362);
    baseSize=narrow ? Math.max(9,Math.min(11,width/40)) : Math.max(10,Math.min(15.3,width/110));
    typesetGlyphs(baseSize);
    tail=ctx.createLinearGradient(0,0,0,height);
    for(const [k,c] of [[0,0],[.1,.24],[.22,1],[.62,1],[.76,.64],[.91,.19],[.993,0],[1,0]]) tail.addColorStop(k,'rgba(0,0,0,'+c+')');
    const n=Math.round(Math.max(1300,Math.min(4350,width*height/260)));
    grains=Array.from({length:n},(_,i)=>{
      const a=random(i,2), seed=random(i,3), clustered=(random(i,4)+random(i,5)+random(i,6)-1.5);
      const echo=seed>.73;
      return {arm:(i%3)*TAU/3-1.74+(echo?.52+random(i,13)*.35:0),life:random(i,7),speed:.056+.016*random(i,8),
        lane:clustered*(echo?3.3:1.65),shift:(a-.5)*(.043+(echo?.14:0)),
        weight:(.24+.67*random(i,9)**1.3)*(echo?.58:1),scale:.63+.73*random(i,10), seed,
        glyph:Math.floor(random(i,11)*glyphs.length),dust:random(i,12)<.27};
    });
    tracks=[];
    for(let arm=0;arm<3;arm++) for(let i=0;i<14;i++){
      tracks.push({arm:arm*TAU/3-1.74,lane:(i-6.5)*.14,off:.016*Math.sin(i*3.3+arm),
        alpha:(i%5===1?.265:.094)*(.7+random(arm,i)*.55),phase:random(i,arm)});
    }
    // A very fine, stationary film screen stays behind the moving type.
    grain.width=Math.ceil(width*.6);grain.height=Math.ceil(height*.6);
    const g=grain.getContext('2d');g.clearRect(0,0,grain.width,grain.height);
    g.strokeStyle='#b2b9bc';g.lineWidth=.45;
    for(let row=0,yy=2;yy<grain.height;row++,yy+=3.5){
      const q=yy/grain.height;g.globalAlpha=.045*(1-Math.abs(q-.39))*(.5+random(row,19));
      g.beginPath();g.moveTo(0,yy);g.quadraticCurveTo(grain.width*.5, yy+(q-.44)*9,grain.width,yy);g.stroke();
    }
    paint(reduced.matches?0:time);
  }
  function paint(t) {
    if (!width || !height) return;
    ctx.globalAlpha=1;ctx.clearRect(0,0,width,height);ctx.drawImage(grain,0,0,width,height);
    const turn=.030*t;
    // A finite exposure travels out along each etched strand. Overlapping
    // exposures keep the line continuous; their brighter ends carry direction.
    ctx.strokeStyle='#c2c7c8';ctx.lineWidth=.68;
    for (const line of tracks){
      const start=fract(line.phase+t*.060)*1.56;
      for(let part=0;part<2;part++){
        const lo=part?start:Math.max(.13,start-.46),hi=part?Math.min(1.59,start+.39):start;
        if(hi<lo+.017) continue;
        ctx.globalAlpha=line.alpha*(part?.64:1);ctx.beginPath();
        for(let i=0;i<=43;i++){
          const u=i/43,r=lo+(hi-lo)*u;
          project(r,line.arm,line.lane,line.off,turn);
          if(i)ctx.lineTo(point.x,point.y);else ctx.moveTo(point.x,point.y);
        }
        ctx.stroke();
      }
    }
    ctx.fillStyle='#d8dbdb';
    for(const g of grains){
      const age=fract(g.life+t*g.speed),r=.15+1.46*(.62*age+.38*age*age);
      project(r,g.arm,g.lane,g.shift,turn);
      const x=point.x,y=point.y;
      if(x < -14 || x > width+14 || y < 0 || y > height) continue;
      if(((x-sealX)*invX)**2+((y-sealY)*invY)**2<1) continue;
      const edge=smooth(0,.11,age)*(1-smooth(.76,1,age));
      const f=edge*g.weight*(.72+.28*Math.sin(age*8+g.arm)**2);
      if(f<.016) continue;
      if(g.dust) {
        const size=(.75+.75*age)*g.scale;
        ctx.globalAlpha=f*.70;ctx.fillRect(x,y,size,size);continue;
      }
      const size=g.scale*(.76+.40*age),w=glyphW*size,h=glyphH*size;
      const col=g.glyph*tileW;
      if(g.seed>.91){
        // An inward ghost traces a short tail behind the moving glyph.
        project(r-.009,g.arm,g.lane,g.shift,turn);
        ctx.globalAlpha=f*.21;ctx.drawImage(atlas,col,0,tileW,tileH,point.x-w/2,point.y-h/2,w,h);
      }
      ctx.globalAlpha=f;ctx.drawImage(atlas,col,0,tileW,tileH,x-w/2,y-h/2,w,h);
    }
    ctx.globalAlpha=1;ctx.globalCompositeOperation='destination-in';
    ctx.fillStyle=tail;ctx.fillRect(0,0,width,height);ctx.globalCompositeOperation='source-over';
  }
  const active=()=>near && !reduced.matches && !document.hidden && !dialog?.open;
  function loop(stamp) {
    frame=0;if(!active()){last=0;return;}
    if(!last || stamp-last>=32){
      if(last)time+=Math.min(stamp-last,100)/1000;
      last=stamp;paint(time);
    }
    frame=requestAnimationFrame(loop);
  }
  function sync() {
    if(!active()){
      cancelAnimationFrame(frame);frame=last=0;if(reduced.matches)paint(0);
    } else if(!frame)frame=requestAnimationFrame(loop);
  }
  function resize(){if(!resizeFrame)resizeFrame=requestAnimationFrame(()=>{resizeFrame=0;compose();});}
  new IntersectionObserver(([e])=>{near=e.isIntersecting && e.intersectionRatio>.045;sync();},{threshold:[0,.045]}).observe(stage);
  new ResizeObserver(resize).observe(stage);
  document.fonts.load('400 12px "IBM Plex Mono"').then(resize,resize);
  reduced.addEventListener('change',sync);document.addEventListener('visibilitychange',sync);
  if(dialog)new MutationObserver(sync).observe(dialog,{attributes:true,attributeFilter:['open']});
  sync();
})();

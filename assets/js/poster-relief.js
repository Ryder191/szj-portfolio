(() => {
  'use strict';
  const mount = document.querySelector('[data-seal]');
  if (!mount) return;
  const stage = mount.closest('#poster'), canvas = mount.querySelector('canvas');
  const copy = stage.querySelector('.poster-type'), lamp = stage.querySelector('[data-foil-lamp]');
  const title = copy.querySelector('#poster-title');
  const still = mount.querySelector('img'), dialog = document.getElementById('lightbox');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  let gx = 0, gy = 0, x = 0, y = 0, last = 0, frame = 0, near = false;
  let typeX = 0, typeY = 0;
  let gl, scene, material, pending = false, failed = false, lost = false, dirty = true;
  let lastLight = '', pixels = [0,0];
  const interactive = () => fine.matches && !reduced.matches;
  const awake = () => interactive() && near && !document.hidden && !dialog?.open;
  const vertex = `
    precision highp float;
    attribute vec2 uv; varying mediump vec2 tex;
    uniform sampler2D plate; uniform mediump vec2 pose; uniform mediump mat3 orient;
    void main() {
      tex = uv;
      float z = texture2D(plate,uv).r*.16-.062;
      vec3 p = orient*vec3(uv.x*2.-1.,(1.-2.*uv.y)*.808889,z);
      float lens=(3.8-z)/(3.8-p.z);
      gl_Position=vec4(p.x*lens+pose.x*.009,p.y*lens/.808889-pose.y*.008,-p.z,1.);
    }`;
  const fragment = `
    precision mediump float;
    varying mediump vec2 tex; uniform sampler2D plate; uniform mediump vec2 pose; uniform mediump mat3 orient;
    float box(float d,float w){ float t=d/w; return exp(-t*t); }
    void main() {
      vec4 m=texture2D(plate,tex);
      if(m.a<.025) discard;
      vec2 xy=m.gb*2.-1.;
      vec3 n=normalize(orient*vec3(xy,sqrt(max(.0001,1.-dot(xy,xy)))));
      vec2 r=2.*n.xy*n.z+pose*vec2(.080,-.055);
      float bank=box(r.x+.45*r.y+.58,.34)*box(r.y-.22,.97);
      float lip=box(r.x+.45*r.y+.64,.105)*box(r.y-.29,.70);
      float bounce=box(r.x-.41*r.y-.57,.085)*box(r.y+.20,.66);
      float metal=.027+.014*n.z+.026*max(0.,dot(n.xy,vec2(-.8,.4)))+.080*bank+.35*lip+.225*bounce+.035*box(r.y+.56,.20)+.121*(1.-n.z)*(1.-n.z);
      vec2 uv=(tex-.5)/vec2(.464,.458);
      metal+=.011*max(0.,dot(uv,vec2(-.55,-.8)))*(1.-smoothstep(.68,.88,length(uv)));
      gl_FragColor=vec4(metal*vec3(.98,1.,1.045),m.a);
    }`;

  function compile(type, source) {
    const s = gl.createShader(type);
    gl.shaderSource(s,source); gl.compileShader(s);
    if (!gl.getShaderParameter(s,gl.COMPILE_STATUS)) { gl.deleteShader(s); throw Error('shader'); }
    return s;
  }
  function createScene() {
    const shaders = [compile(gl.VERTEX_SHADER,vertex),compile(gl.FRAGMENT_SHADER,fragment)];
    const prog=gl.createProgram();
    shaders.forEach(s=>gl.attachShader(prog,s)); gl.linkProgram(prog);
    shaders.forEach(s=>gl.deleteShader(s));
    if (!gl.getProgramParameter(prog,gl.LINK_STATUS)) throw Error('program');
    gl.useProgram(prog);
    // The baked height lifts an indexed mesh; the normal map resolves the smaller engraved cuts.
    const u=144,v=116, verts=new Float32Array((u+1)*(v+1)*2), idx=new Uint16Array(u*v*6);
    for (let j=0,k=0; j<=v; j++) for (let i=0; i<=u; i++) { verts[k++]=i/u;verts[k++]=j/v; }
    for (let j=0,k=0;j<v;j++) for (let i=0;i<u;i++) {
      const a=j*(u+1)+i,b=a+u+1;
      idx[k++]=a;idx[k++]=b;idx[k++]=a+1;idx[k++]=a+1;idx[k++]=b;idx[k++]=b+1;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer());gl.bufferData(gl.ARRAY_BUFFER,verts,gl.STATIC_DRAW);
    const attr=gl.getAttribLocation(prog,'uv');gl.enableVertexAttribArray(attr);gl.vertexAttribPointer(attr,2,gl.FLOAT,false,0,0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,gl.createBuffer());gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,idx,gl.STATIC_DRAW);
    const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL,gl.NONE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,material);
    gl.uniform1i(gl.getUniformLocation(prog,'plate'),0);gl.enable(gl.DEPTH_TEST);gl.clearColor(0,0,0,0);
    return {n:idx.length,angle:gl.getUniformLocation(prog,'orient'),pose:gl.getUniformLocation(prog,'pose')};
  }
  async function prepare() {
    if (pending || failed || lost || scene || !awake()) return;
    pending=true;
    try {
      gl=gl || canvas.getContext('webgl',{alpha:true,antialias:true,premultipliedAlpha:false,powerPreference:'low-power'});
      if (!gl || !gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS)) { failed=true;return; }
      if (!material) { material=new Image();material.src=canvas.dataset.material;await material.decode(); }
      if (lost || gl.isContextLost()) return;
      scene=createScene();dirty=true;wake();
    } catch { if (!lost) failed=true; }
    finally { pending=false; }
  }
  function measure() {
    const r=Math.min(devicePixelRatio || 1,1.65);
    pixels=[Math.max(1,Math.round(mount.clientWidth*r)),Math.max(1,Math.round(mount.clientHeight*r))];
    dirty=true;wake();
  }
  function draw() {
    if (canvas.width!==pixels[0] || canvas.height!==pixels[1]) {
      canvas.width=pixels[0];canvas.height=pixels[1];
    }
    gl.viewport(0,0,canvas.width,canvas.height);
    const a=x*.135,b=-y*.095,c=Math.cos(a),s=Math.sin(a),k=Math.cos(b),h=Math.sin(b);
    gl.uniformMatrix3fv(scene.angle,false,[c,0,-s,s*h,k,c*h,s*k,-h,c*k]);
    gl.uniform2f(scene.pose,x,y);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    gl.drawElements(gl.TRIANGLES,scene.n,gl.UNSIGNED_SHORT,0);
    mount.setAttribute('data-live','');
  }
  function light() {
    const az=Math.round((228+x*27-y*10)*2)/2, el=Math.round((44+y*6)*2)/2;
    if (lastLight===az+'/'+el) return;
    lastLight=az+'/'+el;lamp.setAttribute('azimuth',az);lamp.setAttribute('elevation',el);
    copy.style.setProperty('--foil-angle',(111+x*12-y*4).toFixed(1)+'deg');
  }
  function placeTitle() {
    if (!(typeX || typeY || x || y)) { title.style.removeProperty('transform');return; }
    // The lettering trails the seal slightly. A change of direction banks the type,
    // then settles without a free-running wobble or any movement of the credit line.
    const roll=typeX*.17+(x-typeX)*1.12;
    title.style.transform='translate3d('+(typeX*10).toFixed(2)+'px,'+(typeY*5).toFixed(2)+'px,0) '+
      'perspective(1150px) rotateX('+(-typeY*.95).toFixed(2)+'deg) rotateY('+(typeX*1.4).toFixed(2)+
      'deg) rotateZ('+roll.toFixed(2)+'deg)';
  }
  function tick(t) {
    frame=0;
    if (!awake()) { last=0;return; }
    const dt=last?Math.min(65,t-last):16.7, ease=1-Math.exp(-dt/112);
    const prevX=x, prevY=y;
    last=t;x+=(gx-x)*ease;y+=(gy-y)*ease;
    const moving=Math.abs(x-gx)+Math.abs(y-gy)>.0012;
    if (!moving) { x=gx;y=gy; }
    const follow=1-Math.exp(-dt/72);
    typeX+=(x-typeX)*follow;typeY+=(y-typeY)*follow;
    const settling=Math.abs(typeX-x)+Math.abs(typeY-y)>.0012;
    if (!moving && !settling) { typeX=x;typeY=y; }
    placeTitle();
    if (dirty || x!==prevX || y!==prevY) {
      light();
      if (scene && !lost) draw();
      else still.style.transform='perspective(800px) rotateY('+(x*6)+'deg) rotateX('+(-y*4)+'deg)';
    }
    dirty=false;
    if (moving || settling) frame=requestAnimationFrame(tick);else last=0;
  }
  function wake() { if (!frame && awake()) frame=requestAnimationFrame(tick); }
  function sync() {
    if (awake()) { prepare();if (dirty || !frame) wake();return; }
    cancelAnimationFrame(frame);frame=0;last=0;dirty=true;
    if (!interactive()) {
      gx=gy=x=y=typeX=typeY=0;mount.removeAttribute('data-live');still.style.transform='';placeTitle();light();
    }
  }
  stage.addEventListener('pointermove',e=>{
    if (!awake() || e.pointerType!=='mouse') return;
    const r=stage.getBoundingClientRect();
    gx=Math.max(-1,Math.min(1,(e.clientX-r.left)/r.width*2-1));
    gy=Math.max(-1,Math.min(1,(e.clientY-r.top)/r.height*2-1));wake();
  },{passive:true});
  stage.addEventListener('pointerleave',()=>{ gx=gy=0;wake(); });
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();lost=true;scene=null;dirty=true;mount.removeAttribute('data-live');wake();});
  canvas.addEventListener('webglcontextrestored',()=>{lost=failed=false;dirty=true;sync();});
  new IntersectionObserver(([e])=>{near=e.isIntersecting;sync();}).observe(stage);
  new ResizeObserver(measure).observe(mount);
  for (const q of [fine,reduced]) q.addEventListener('change',sync);
  document.addEventListener('visibilitychange',sync);
  if (dialog) new MutationObserver(sync).observe(dialog,{attributes:true,attributeFilter:['open']});
  measure();
})();

// Bounded, demand-driven WebGL scene. No render loop survives off-screen.
let libraryPromise;
function loadThree() {
  if (window.THREE) return Promise.resolve(window.THREE);
  if (!libraryPromise) libraryPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = new URL('./vendor/three.min.js', import.meta.url).href;
    script.onload = () => window.THREE ? resolve(window.THREE) : reject(new Error('Three unavailable'));
    script.onerror = reject;
    document.head.appendChild(script);
  });
  return libraryPromise;
}

export async function initScene() {
  const wrap = document.querySelector('#sceneWrap');
  const canvas = document.querySelector('#heroCanvas');
  const control = document.querySelector('#sceneControl');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  if (navigator.connection?.saveData) return;
  const T = await loadThree();
  let renderer;
  try {
    renderer = new T.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'low-power'});
  } catch { return; }
  const mobile = matchMedia('(max-width: 759px)').matches;
  renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.35 : 1.75));
  renderer.outputEncoding = T.sRGBEncoding;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = .95;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(36,1,.1,40);
  camera.position.set(3.6,2.8,5.7);
  camera.lookAt(0,.1,0);
  const linear = hex => new T.Color(hex).convertSRGBToLinear();
  const gold = new T.MeshStandardMaterial({color:linear('#caa767'),metalness:.86,roughness:.3,envMapIntensity:.65});
  const forest = new T.MeshStandardMaterial({color:linear('#0b4837'),metalness:.04,roughness:.65,envMapIntensity:.45});
  const darkGreen = new T.MeshStandardMaterial({color:linear('#123b31'),metalness:.05,roughness:.75});
  const sage = new T.MeshStandardMaterial({color:linear('#8d9e7c'),metalness:.02,roughness:.85});
  const paper = new T.MeshStandardMaterial({color:linear('#e7dfc8'),roughness:.88});
  const stone = new T.MeshStandardMaterial({color:linear('#153c31'),roughness:.9,envMapIntensity:.4});

  // Small studio environment creates warm metal reflections without image requests.
  const studio = new T.Scene();
  studio.add(new T.Mesh(new T.BoxGeometry(20,20,20),new T.MeshBasicMaterial({color:linear('#314b3a'),side:T.BackSide})));
  const panel = (width,height,x,y,z,rx,ry,color) => {
    const mesh = new T.Mesh(new T.PlaneGeometry(width,height),new T.MeshBasicMaterial({color:new T.Color(color),side:T.DoubleSide}));
    mesh.position.set(x,y,z); mesh.rotation.set(rx,ry,0); studio.add(mesh);
  };
  panel(8,5,0,8,0,Math.PI/2,0,'#fff0d4');
  panel(5,7,-7,2,1,0,Math.PI/2,'#e3f5dc');
  panel(4,7,6,2,-3,0,-Math.PI/2,'#ffdc94');
  const pmrem = new T.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(studio,.03);
  scene.environment = environment.texture;
  pmrem.dispose();
  studio.traverse(object => { object.geometry?.dispose(); object.material?.dispose(); });
  scene.add(new T.HemisphereLight(0xfff1d2,0x133a2f,.65));
  const key = new T.DirectionalLight(0xfff0ca,1.7);
  key.position.set(-3,7,5); key.castShadow=true;
  key.shadow.mapSize.set(mobile ? 512 : 1024,mobile ? 512 : 1024);
  Object.assign(key.shadow.camera,{left:-4,right:4,top:4,bottom:-4,near:.1,far:20});
  key.shadow.bias=-.001; key.shadow.normalBias=.035;
  scene.add(key);
  const rim = new T.DirectionalLight(0xb4d4a7,.95);rim.position.set(4,3,-4);scene.add(rim);

  const sculpture = new T.Group();scene.add(sculpture);
  const add = (parent,geometry,material,x=0,y=0,z=0) => {
    const mesh = new T.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
  };
  // Bevels give the covers and mortarboard a finished edge without dense geometry.
  function bevelBox(width,height,depth,radius=.025) {
    const shape = new T.Shape();
    const x=-width/2,z=-depth/2,r=Math.min(radius,width/4,depth/4);
    shape.moveTo(x+r,z);shape.lineTo(x+width-r,z);shape.quadraticCurveTo(x+width,z,x+width,z+r);
    shape.lineTo(x+width,z+depth-r);shape.quadraticCurveTo(x+width,z+depth,x+width-r,z+depth);
    shape.lineTo(x+r,z+depth);shape.quadraticCurveTo(x,z+depth,x,z+depth-r);
    shape.lineTo(x,z+r);shape.quadraticCurveTo(x,z,x+r,z);
    const geometry = new T.ExtrudeGeometry(shape,{depth:height,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.012,bevelThickness:.01,curveSegments:3});
    geometry.rotateX(-Math.PI/2);geometry.translate(0,-height/2,0);return geometry;
  }
  const pedestal = add(sculpture,new T.CylinderGeometry(2.05,2.12,.18,64),stone,0,-1.35,0);
  add(sculpture,new T.TorusGeometry(2.065,.012,6,96),gold,0,-1.29,0).rotation.x=Math.PI/2;
  function book(y,width,depth,height,material,angle) {
    const group = new T.Group();group.position.y=y;group.rotation.y=angle;sculpture.add(group);
    add(group,bevelBox(width,.065,depth),material,0,-height/2,0);
    add(group,bevelBox(width,.065,depth),material,0,height/2,0);
    add(group,new T.BoxGeometry(width-.11,height-.07,depth-.12),paper,.025,0,0);
    add(group,new T.BoxGeometry(.08,height,depth-.02),material,-width/2+.025,0,0);
    for (let i=0;i<3;i++) add(group,new T.BoxGeometry(width-.11,.006,.012),new T.MeshStandardMaterial({color:linear('#b8b19c'),roughness:1}),.025,-height*.25+i*height*.22,depth/2-.052);
    add(group,new T.BoxGeometry(.09,.008,depth-.08),gold,width*.29,height/2+.04,0);
    return group;
  }
  book(-1.09,2.5,1.65,.22,darkGreen,-.13);
  book(-.79,2.25,1.52,.25,sage,.12);
  book(-.52,2.1,1.45,.17,forest,-.08);

  const cap = new T.Group();cap.position.set(.02,.84,0);cap.rotation.z=-.1;cap.rotation.y=.12;sculpture.add(cap);
  add(cap,new T.CylinderGeometry(.83,.91,.51,40,1,true),forest,0,-.31,0);
  add(cap,new T.TorusGeometry(.91,.024,8,56),gold,0,-.565,0).rotation.x=Math.PI/2;
  add(cap,bevelBox(2.55,.08,2.55,.045),gold,0,0,0);
  add(cap,bevelBox(2.49,.065,2.49,.04),forest,0,.055,0);
  add(cap,new T.SphereGeometry(.07,14,10),gold,0,.13,0).scale.y=.55;
  const cord = new T.CatmullRomCurve3([new T.Vector3(0,.14,0),new T.Vector3(.6,.15,.38),new T.Vector3(1.1,.13,.79),new T.Vector3(1.29,.04,.9)]);
  add(cap,new T.TubeGeometry(cord,16,.016,6,false),gold);
  const tassel = new T.Group();tassel.position.set(1.29,.035,.9);cap.add(tassel);
  add(tassel,new T.CylinderGeometry(.016,.016,.67,8),gold,0,-.33,0);
  add(tassel,new T.SphereGeometry(.048,12,8),gold,0,-.68,0);
  add(tassel,new T.ConeGeometry(.105,.37,18),gold,0,-.89,0).rotation.z=Math.PI;

  const arc = add(scene,new T.TorusGeometry(2.42,.008,5,96,Math.PI*1.6),new T.MeshStandardMaterial({color:linear('#a58a50'),metalness:.65,roughness:.5}),0,.2,-.7);
  arc.rotation.set(.45,.3,.15);arc.castShadow=false;
  // No particles or full-page canvas. A single quiet orbit frames the composition.
  let visible=true, frame=0, lastTime=0, autoUntil=reduce.matches ? 0 : performance.now()+6500;
  let targetY=0,currentY=0,targetX=0,currentX=0,drag=null,dirty=true,failed=false;
  const canRender = () => visible && !document.hidden && !document.body.classList.contains('dialog-open') && !failed;
  function syncControl() {
    const moving=autoUntil>performance.now()&&!reduce.matches;
    control.setAttribute('aria-pressed',String(moving));
    control.setAttribute('aria-label',moving ? 'إيقاف حركة المجسّم' : 'تشغيل حركة المجسّم');
    control.querySelector('span').textContent=moving ? 'إيقاف الحركة' : 'حرّكها بطريقتك';
  }
  function render(now) {
    frame=0;
    if (!canRender()) return;
    const moving=autoUntil>now&&!reduce.matches;
    // Cap the decorative animation on mobile. Input redraws remain immediate.
    if (mobile&&moving&&!dirty&&now-lastTime<32) { frame=requestAnimationFrame(render);return; }
    lastTime=now;
    const ease=reduce.matches?1:.12;
    currentY+=(targetY-currentY)*ease;currentX+=(targetX-currentX)*ease;
    sculpture.rotation.y=currentY+(moving?Math.sin(now*.00035)*.13:0);
    sculpture.rotation.x=currentX;
    cap.position.y=.84+(moving?Math.sin(now*.0008)*.055:0);
    tassel.rotation.z=moving?Math.sin(now*.001)*.045:0;
    renderer.render(scene,camera);dirty=false;
    if (!wrap.classList.contains('ready')) wrap.classList.add('ready');
    const settling=Math.abs(targetY-currentY)>.001||Math.abs(targetX-currentX)>.001;
    if (moving||settling) frame=requestAnimationFrame(render);
    else syncControl();
  }
  function schedule() { dirty=true;if(canRender()&&!frame)frame=requestAnimationFrame(render); }
  function resize() {
    const {width,height}=wrap.getBoundingClientRect();
    if(!width||!height)return;
    renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();schedule();
  }
  new ResizeObserver(resize).observe(wrap);
  new IntersectionObserver(entries => {
    visible=entries[0].isIntersecting;
    if(!visible){cancelAnimationFrame(frame);frame=0;}
    else schedule();
  },{threshold:.05}).observe(wrap);
  const onVisibility = () => {
    if(!canRender()){cancelAnimationFrame(frame);frame=0;}
    else schedule();
  };
  document.addEventListener('visibilitychange',onVisibility);
  document.addEventListener('scenevisibility',onVisibility);
  reduce.addEventListener('change',()=>{autoUntil=0;syncControl();schedule();});
  canvas.addEventListener('pointerdown',event=>{drag={x:event.clientX,y:event.clientY,id:event.pointerId,started:false};});
  canvas.addEventListener('pointermove',event=>{
    if(!drag)return;
    const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
    if(!drag.started){
      if(Math.abs(dy)>12&&Math.abs(dy)>Math.abs(dx)){drag=null;return;}
      if(Math.abs(dx)<8)return;
      drag.started=true;canvas.setPointerCapture(event.pointerId);autoUntil=0;syncControl();
    }
    targetY+=dx*.007;targetX=Math.max(-.14,Math.min(.14,targetX+dy*.002));
    drag.x=event.clientX;drag.y=event.clientY;schedule();
  });
  const release=()=>{drag=null;targetX=0;schedule();};
  canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);
  control.addEventListener('click',()=>{autoUntil=autoUntil>performance.now()?0:reduce.matches?0:performance.now()+6500;targetY+=reduce.matches?.35:0;syncControl();schedule();});
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();failed=true;cancelAnimationFrame(frame);frame=0;wrap.classList.remove('ready');control.hidden=true;});
  control.hidden=false;control.title='اسحب المجسّم أفقيًا لتدويره';syncControl();resize();
}

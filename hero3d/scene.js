import * as T from './vendor/three.module.min.js';

// Real geometry, local dependency, no image maps or downloaded 3D assets.
const host=document.querySelector('[data-hero3d]');
const $=id=>host.querySelector('[data-scene="'+id+'"]'), stage=$('stage'), reduced=matchMedia('(prefers-reduced-motion: reduce)');
const data={coffee:{name:'Кофемашина / устройство'},audio:{name:'Стереоусилитель / устройство'}};
let renderer,scene,camera,root,model,current='coffee',raf=0,visible=true,dirty=true,disposed=false,animation=null,opening=1,yaw=0,pitch=0,lastFrame=0,frameCount=0;
const mats={},geos=new Map();
function mat(name,color,metalness=0,roughness=.5){return mats[name]??=new T.MeshStandardMaterial({color,metalness,roughness});}
const M={cream:mat('cream','#f0f0ef',.08,.56),sage:mat('sage','#1c1d21',.12,.62),dark:mat('dark','#141518',.2,.58),rubber:mat('rubber','#0b0c0e',.02,.78),silver:mat('silver','#b8b8ba',.88,.34),chrome:mat('chrome','#dadada',.96,.21),copper:mat('copper','#b0aeab',.85,.33),brass:mat('brass','#c6c4c2',.78,.39),board:mat('board','#1c1d21',.05,.78),track:mat('track','#77787b',.38,.55),white:mat('white','#ffffff',0,.62),red:mat('red','#8e9093',.06,.6),blue:mat('blue','#3e4044',.2,.45),wood:mat('wood','#17181b',.0,.56),slot:mat('slot','#0b0c0e',.1,.8)};
M.meter=mat('meter','#d3d1cf',.03,.7);M.meter.emissive=new T.Color('#2a2b2f');M.meter.emissiveIntensity=.25;
M.screen=mat('screen','#0b0c0e',.3,.25);M.led=new T.MeshBasicMaterial({color:'#f0f0ef'});

// Subtle procedural finishes; no image textures or extra network requests.
function finish(material,kind){
 material.onBeforeCompile=shader=>{
  shader.vertexShader='varying vec3 finishPosition;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nfinishPosition = position;');
  shader.fragmentShader='varying vec3 finishPosition;\n'+shader.fragmentShader;
  const grain=kind==='wood'
   ? 'float g = sin(finishPosition.y * 105.0 + sin(finishPosition.z * 2.5 + finishPosition.y * 5.0) * 3.0); diffuseColor.rgb *= 0.93 + 0.07 * g;'
   : 'float g = sin(finishPosition.y * 190.0 + sin(finishPosition.x * 7.0)); diffuseColor.rgb *= 0.98 + 0.02 * g;';
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\n'+grain);
 };
 material.customProgramCacheKey=()=>kind;
}
finish(M.wood,'wood');finish(M.silver,'metal');

function group(parent){const g=new T.Group();parent.add(g);return g;}
function geo(key,fn){if(!geos.has(key))geos.set(key,fn());return geos.get(key);}
function mesh(g,geometry,material,x=0,y=0,z=0){const m=new T.Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;g.add(m);return m;}
function box(g,x,y,z,w,h,d,m,r=.025){r=Math.min(r,w/4,h/4,d/3);const k=`b${w},${h},${d},${r}`;return mesh(g,geo(k,()=>{if(!r)return new T.BoxGeometry(w,h,d);w-=2*r;h-=2*r;const s=new T.Shape(),a=-w/2,b=-h/2;s.moveTo(a+r,b);s.lineTo(a+w-r,b);s.quadraticCurveTo(a+w,b,a+w,b+r);s.lineTo(a+w,b+h-r);s.quadraticCurveTo(a+w,b+h,a+w-r,b+h);s.lineTo(a+r,b+h);s.quadraticCurveTo(a,b+h,a,b+h-r);s.lineTo(a,b+r);s.quadraticCurveTo(a,b,a+r,b);const q=new T.ExtrudeGeometry(s,{depth:d-2*r,bevelEnabled:true,bevelThickness:r,bevelSize:r,bevelSegments:2,steps:1,curveSegments:3});q.translate(0,0,-d/2+r);return q;}),m,x,y,z);}
function cyl(g,x,y,z,r,h,m,axis='y',n=32){const a=mesh(g,geo(`c${r},${h},${n}`,()=>new T.CylinderGeometry(r,r,h,n)),m,x,y,z);if(axis==='z')a.rotation.x=Math.PI/2;if(axis==='x')a.rotation.z=Math.PI/2;return a;}
function torus(g,x,y,z,r,t,m,axis='y'){const a=mesh(g,geo(`t${r},${t}`,()=>new T.TorusGeometry(r,t,8,40)),m,x,y,z);if(axis==='y')a.rotation.x=Math.PI/2;if(axis==='x')a.rotation.y=Math.PI/2;return a;}
function wire(g,points,r,m){const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));return mesh(g,new T.TubeGeometry(curve,Math.max(12,points.length*5),r,6,false),m);}
function screw(g,x,y,z,axis='y'){cyl(g,x,y,z,.028,.015,M.chrome,axis,12);const s=box(g,x,y+.009,z,.029,.002,.005,M.slot,0);if(axis==='z'){s.position.set(x,y,z+.01);s.rotation.x=Math.PI/2;}if(axis==='x'){s.position.set(x+.01,y,z);s.rotation.z=Math.PI/2;}}
function cap(g,x,y,z,r=.12,h=.34){cyl(g,x,y+h/2,z,r,h,M.dark);cyl(g,x,y+h+.003,z,r*.88,.009,M.silver);box(g,x,y+h+.009,z,r*1.35,.002,.008,M.slot,0);box(g,x,y+h+.009,z,.008,.002,r*1.35,M.slot,0);}
function pcb(g,x,y,z,w,d){box(g,x,y,z,w,.035,d,M.board,.01);for(let i=0;i<8;i++){const px=x-w*.4+i*w*.1;box(g,px,y+.023,z,.008,.003,d*.75,M.track,0);box(g,px+w*.035,y+.024,z+(i%3-1)*d*.2,w*.07,.003,.009,M.track,0);}for(const a of [-1,1])for(const b of [-1,1]){cyl(g,x+a*(w/2-.065),y-.04,z+b*(d/2-.065),.025,.08,M.brass);screw(g,x+a*(w/2-.065),y+.026,z+b*(d/2-.065));}}
function resistor(g,x,y,z){cyl(g,x,y,z,.024,.15,M.white,'x',10);for(const dx of [-.04,0,.035])cyl(g,x+dx,y,z,.025,.011,M.copper,'x',10);box(g,x,y-.012,z,.24,.009,.009,M.silver,0);}
function feet(g,w,d){for(const x of [-w/2,w/2])for(const z of [-d/2,d/2]){cyl(g,x,.08,z,.13,.15,M.rubber);cyl(g,x,.15,z,.125,.05,M.silver);}}
function vents(g,x,y,z,count,length,axis='top'){for(let i=0;i<count;i++){const v=box(g,x+(i-(count-1)/2)*.09,y,z,.028,.008,length,M.slot,.003);if(axis==='front')v.rotation.x=Math.PI/2;}}
function coffee(){const body=new T.Group(),fixed=group(body),lid=group(body),side=group(body);feet(fixed,1.4,1.35);
 // Cast base, rear frame and a distinctly recessed brewing bay.
 box(fixed,0,.22,0,1.84,.18,1.87,M.dark,.05);box(fixed,-.87,1.55,0,.09,2.62,1.76,M.sage,.026);box(fixed,0,1.57,-.86,1.75,2.6,.09,M.sage,.025);
 box(fixed,0,1.2,.35,1.65,1.65,.13,M.dark,.03);box(fixed,0,.37,.65,1.68,.12,.57,M.silver,.035);box(fixed,0,.46,.64,1.5,.035,.48,M.dark,.014);
 for(let i=0;i<14;i++)box(fixed,(i-6.5)*.095,.485,.66,.028,.015,.36,M.chrome,.005);
 // Front control console and coffee outlet.
 box(fixed,0,2.26,.87,1.79,1.13,.18,M.cream,.07);box(fixed,-.27,2.43,.979,.68,.33,.014,M.screen,.025);
 for(let i=0;i<4;i++)box(fixed,-.49+i*.095,2.425,.992,.042,.006,.003,M.led,0);
 cyl(fixed,.48,2.4,1.0,.165,.13,M.chrome,'z');cyl(fixed,.48,2.4,1.075,.136,.025,M.sage,'z');box(fixed,.48,2.475,1.091,.013,.045,.008,M.white,.003);
 for(let i=0;i<3;i++){cyl(fixed,-.46+i*.23,2.025,.977,.046,.03,M.dark,'z',20);cyl(fixed,-.46+i*.23,2.025,.996,.013,.01,i===0?M.led:M.chrome,'z',12);}
 box(fixed,-.06,1.73,.9,.53,.19,.35,M.chrome,.04);for(const x of [-.2,.08]){cyl(fixed,x,1.53,1,.043,.29,M.chrome);torus(fixed,x,1.395,1,.042,.012,M.dark);}
 wire(fixed,[[.66,1.91,.88],[.81,1.69,1.02],[.85,1.03,1.12],[.71,.89,1.16]],.031,M.chrome);cyl(fixed,.69,.91,1.16,.046,.14,M.rubber,'x');
 // Interior exposed on the right, rather than hidden under the cover.
 cyl(fixed,.36,1.1,-.16,.28,1.05,M.brass);torus(fixed,.36,1.47,-.16,.284,.02,M.chrome);torus(fixed,.36,.73,-.16,.284,.02,M.chrome);cyl(fixed,.36,1.65,-.16,.07,.18,M.brass);
 box(fixed,.51,.61,.32,.46,.29,.34,M.red,.045);cyl(fixed,.52,.63,.58,.11,.28,M.silver,'z');box(fixed,.46,1.97,-.33,.56,.43,.63,M.dark,.04);
 wire(fixed,[[.37,1.75,-.16],[.67,1.79,-.08],[.74,1.25,.24],[.65,.81,.36]],.027,M.copper);wire(fixed,[[.7,.56,.42],[.76,.5,-.35],[.54,.71,-.55],[.34,.79,-.41]],.025,M.white);
 wire(fixed,[[.49,1.9,-.52],[.74,1.84,-.59],[.78,1.14,-.61],[.74,.39,-.43]],.016,M.red);
 const board=group(fixed);board.position.set(.81,1.5,-.51);board.rotation.z=-Math.PI/2;pcb(board,0,0,0,.84,.55);for(let i=0;i<3;i++)cap(board,-.25+i*.24,.03,0,.055,.12);box(board,0,.055,.16,.24,.05,.16,M.dark,.01);for(let i=0;i<5;i++)resistor(board,-.31+i*.15,.056,-.17);
 for(const y of [.35,2.69])for(const z of [-.72,.7])screw(fixed,.874,y,z,'x');
 // Lifted hopper lid and displaced service panel.
 box(lid,0,2.88,0,1.85,.13,1.86,M.sage,.045);box(lid,-.06,2.97,-.18,1.32,.1,1.07,M.dark,.07);box(lid,-.06,3.025,-.18,1.19,.035,.94,M.sage,.065);box(lid,-.06,3.055,-.18,.33,.04,.08,M.chrome,.016);
 box(side,.925,1.57,0,.085,2.58,1.72,M.sage,.025);for(let i=0;i<11;i++)box(side,.974,2.4-i*.063,-.25,.01,.02,.64,M.slot,.004);for(const y of [.35,2.7])for(const z of [-.72,.7])screw(side,.974,y,z,'x');
 return {body,groups:[fixed,lid,side],set(t){const a=smooth(t/.7),b=smooth((t-.16)/.84);lid.position.set(0,.62*a,-.17*a);lid.rotation.x=-.10*a;side.position.set(1.18*b,.26*b,-.65*b);side.rotation.y=-.2*b;},target:new T.Vector3(.38,1.64,0),span:4.75};}
function audio(){const body=new T.Group(),fixed=group(body),lid=group(body);feet(fixed,3.24,1.87);
 box(fixed,0,.24,0,3.95,.11,2.66,M.silver,.03);box(fixed,0,.72,-1.29,3.87,.95,.075,M.dark,.02);
 for(const x of [-1.99,1.99]){box(fixed,x,.69,0,.17,.96,2.68,M.wood,.04);box(fixed,x*.96,.7,0,.025,.89,2.53,M.dark,.005);}
 box(fixed,0,.68,1.32,3.89,.98,.13,M.cream,.035);box(fixed,0,.25,1.4,3.8,.035,.018,M.chrome,.007);
 // Volume knob, selector controls and a restrained analogue meter.
 cyl(fixed,1.28,.76,1.46,.3,.19,M.chrome,'z',48);cyl(fixed,1.28,.76,1.565,.267,.028,M.silver,'z',48);box(fixed,1.28,.93,1.584,.016,.095,.008,M.dark,.003);
 for(let i=0;i<3;i++){cyl(fixed,-.05+i*.35,.51,1.44,.09,.13,M.chrome,'z');box(fixed,-.05+i*.35,.553,1.511,.008,.039,.006,M.dark,0);}
 box(fixed,-.85,.83,1.398,1.1,.37,.03,M.dark,.025);
 for(const x of [-1.12,-.59]){box(fixed,x,.83,1.42,.43,.25,.02,M.meter,.017);for(let i=0;i<7;i++){const a=(-65+i*20)*Math.PI/180;const tick=box(fixed,x+Math.sin(a)*.13,.77+Math.cos(a)*.13,1.435,.009,.025,.004,M.dark,0);tick.rotation.z=-a;}const needle=box(fixed,x-.03,.825,1.445,.009,.14,.006,M.red,0);needle.rotation.z=-.36;}
 cyl(fixed,-1.67,.53,1.419,.069,.045,M.chrome,'z');cyl(fixed,-1.67,.85,1.414,.022,.017,M.led,'z',12);for(const x of [-1.82,1.82])for(const y of [.32,1.04])screw(fixed,x,y,1.397,'z');
 // Toroid with individual copper windings, retaining washer and fixing bolt.
 torus(fixed,-1.03,.59,.05,.47,.205,M.copper);
 for(let i=0;i<40;i++){const a=i/40*Math.PI*2;const winding=mesh(fixed,geo('winding',()=>new T.TorusGeometry(.208,.012,5,16)),i%4?M.copper:M.brass,-1.03+Math.cos(a)*.47,.59,Math.sin(a)*.47);winding.rotation.y=-a;}
 cyl(fixed,-1.03,.78,.05,.38,.055,M.dark);cyl(fixed,-1.03,.816,.05,.065,.027,M.chrome);screw(fixed,-1.03,.836,.05);
 pcb(fixed,.65,.35,.03,1.78,2.15);
 for(const x of [.13,.55])for(const z of [-.63,-.12])cap(fixed,x,.39,z,.165,.53);
 for(const x of [.93,1.47]){box(fixed,x,.65,-.07,.34,.43,1.95,M.dark,.012);for(let i=0;i<13;i++)box(fixed,x,.82,-.93+i*.144,.5,.28,.027,M.dark,.008);for(const z of [-.68,-.13,.48]){box(fixed,x-.22,.59,z,.03,.19,.13,M.silver,.008);screw(fixed,x-.24,.63,z,'x');}}
 for(let i=0;i<7;i++){resistor(fixed,.08+i*.19,.414,.69);cap(fixed,-.01+i*.25,.39,.96,.045,.13);}
 for(const z of [-1.03,-.75]){box(fixed,-.35,.42,z,.29,.09,.12,M.white,.008);for(let i=0;i<4;i++)box(fixed,-.44+i*.06,.48,z,.015,.04,.04,M.brass,0);}
 wire(fixed,[[-.93,.39,.63],[-.63,.36,.9],[-.31,.39,.88],[-.15,.41,.5]],.025,M.red);wire(fixed,[[-.96,.4,.65],[-.65,.39,1.04],[-.19,.4,.99],[.1,.41,.5]],.024,M.dark);wire(fixed,[[-1.26,.44,-.39],[-1.28,.39,-.9],[-.8,.43,-1.03],[-.36,.47,-1.02]],.023,M.blue);
 for(let i=0;i<8;i++)cyl(fixed,-1.43+i*.38,.66,-1.37,.055,.08,i%2?M.red:M.chrome,'z',16);
 box(lid,0,1.2,0,3.91,.055,2.67,M.sage,.023);for(const x of [-1.925,1.925])box(lid,x,1.1,0,.045,.16,2.64,M.sage,.015);for(const z of [-.71,.69])vents(lid,0,1.232,z,26,.63);for(const x of [-1.78,1.78])for(const z of [-1.16,1.16])screw(lid,x,1.24,z);
 return {body,groups:[fixed,lid],set(t){lid.position.set(0,1.22*t,-1.04*t);lid.rotation.x=-.12*t;},target:new T.Vector3(0,.95,-.15),span:5.65};}

// Bake stationary parts into one draw call per material, retaining movable assemblies.
function batch(g){g.updateMatrixWorld(true);const buckets=new Map(),inverse=g.matrixWorld.clone().invert(),old=[];g.traverse(o=>{if(!o.isMesh)return;old.push(o);let a=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();a.applyMatrix4(new T.Matrix4().multiplyMatrices(inverse,o.matrixWorld));const list=buckets.get(o.material)??[];list.push(a);buckets.set(o.material,list);});for(const o of old)o.removeFromParent();for(const [m,list] of buckets){const merged=new T.BufferGeometry();for(const key of ['position','normal']){const arrays=list.map(g=>g.attributes[key].array);const all=new Float32Array(arrays.reduce((s,a)=>s+a.length,0));let offset=0;for(const a of arrays){all.set(a,offset);offset+=a.length;}merged.setAttribute(key,new T.BufferAttribute(all,3));}merged.computeBoundingSphere();mesh(g,merged,m);list.forEach(a=>a.dispose());}}
function environment(){const e=new T.Scene();e.background=new T.Color('#2a2b2f');for(const [x,y,z,w,h,d,c,i] of [[-5,5,3,3,6,3,'#ffffff',3.8],[4,3,1,2,6,4,'#f0f0ef',2.7],[0,5,-5,8,2,1,'#ffffff',3.2],[0,3,6,5,4,1,'#dadada',1.7]]){const m=new T.Mesh(new T.BoxGeometry(w,h,d),new T.MeshBasicMaterial({color:c}));m.material.color.multiplyScalar(i);m.position.set(x,y,z);e.add(m);}const pm=new T.PMREMGenerator(renderer);const env=pm.fromScene(e,.05,.1,50);scene.environment=env.texture;pm.dispose();e.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});return env;}
let env,ground,io,ro,lastShadowOpening=-1;const temp=new T.Vector3(),frameBox=new T.Box3(),frameCenter=new T.Vector3();
function init(){renderer=new T.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power',preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setClearColor(0,0);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.92;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.VSMShadowMap;renderer.shadowMap.autoUpdate=false;stage.append(renderer.domElement);renderer.domElement.setAttribute('aria-hidden','true');scene=new T.Scene();camera=new T.OrthographicCamera(-4,4,3,-3,.1,60);scene.add(new T.HemisphereLight('#f0f0ef','#8e9093',.95));const light=new T.DirectionalLight('#ffffff',2.7);light.position.set(-3,10,3);light.castShadow=true;light.shadow.mapSize.set(512,512);Object.assign(light.shadow.camera,{left:-6,right:6,top:6,bottom:-6,near:.5,far:22});light.shadow.normalBias=.025;light.shadow.bias=-.00012;light.shadow.radius=4;light.shadow.blurSamples=8;scene.add(light);const fill=new T.DirectionalLight('#d3d1cf',.95);fill.position.set(5,3,-4);scene.add(fill);env=environment();ground=new T.Mesh(new T.PlaneGeometry(200,200),new T.ShadowMaterial({opacity:.12}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);root=new T.Group();scene.add(root);ro=new ResizeObserver(resize);ro.observe(stage);io=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible)resumeClock();else suspendClock();},{threshold:.01});io.observe(stage);$('fallback').hidden=true;$('fallback').style.display='none';events();select(host.dataset.hero3d);}
function release(){if(!model)return;const gs=new Set();model.body.traverse(o=>{if(o.geometry)gs.add(o.geometry);});model.body.removeFromParent();gs.forEach(g=>g.dispose());}
function syncUI(kind){current=kind;$('model-name').textContent=data[kind].name;host.setAttribute('aria-label','3D-анимация: '+data[kind].name);}
function select(kind){lastShadowOpening=-1;syncUI(kind);release();model=kind==='coffee'?coffee():audio();for(const g of model.groups)batch(g);root.add(model.body);model.set(0);model.body.updateMatrixWorld(true);model.boundsClosed=new T.Box3().setFromObject(model.body);model.set(1);model.body.updateMatrixWorld(true);model.boundsOpen=new T.Box3().setFromObject(model.body);model.bounds=model.boundsOpen;model.target=model.boundsOpen.getCenter(new T.Vector3());yaw=0;pitch=0;opening=reduced.matches?1:0;animation=null;elapsed=0;clockStamp=null;userPaused=false;cancel();syncPause();resize();window.__hero3d.current=kind;resumeClock();}
function resize(){if(!renderer||!model)return;const w=stage.clientWidth,h=stage.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);const aspect=w/h;const width=Math.max(model.span,model.span*aspect*.76);camera.left=-width/2;camera.right=width/2;camera.top=width/aspect/2;camera.bottom=-width/aspect/2;camera.updateProjectionMatrix();invalidate();}
function update(){if(opening!==lastShadowOpening){renderer.shadowMap.needsUpdate=true;lastShadowOpening=opening;}model.set(opening);frameBox.min.lerpVectors(model.boundsClosed.min,model.boundsOpen.min,opening);frameBox.max.lerpVectors(model.boundsClosed.max,model.boundsOpen.max,opening);const target=frameBox.getCenter(frameCenter);const a=.66+yaw,e=.41+pitch,r=11;camera.position.set(target.x+Math.sin(a)*Math.cos(e)*r,target.y+Math.sin(e)*r,target.z+Math.cos(a)*Math.cos(e)*r);camera.lookAt(target);camera.updateMatrixWorld();const b=frameBox;let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z]){temp.set(x,y,z).applyMatrix4(camera.matrixWorldInverse);minX=Math.min(minX,temp.x);maxX=Math.max(maxX,temp.x);minY=Math.min(minY,temp.y);maxY=Math.max(maxY,temp.y);}const aspect=stage.clientWidth/stage.clientHeight;const w=Math.max(maxX-minX,(maxY-minY)*aspect)*1.045;camera.left=-w/2;camera.right=w/2;camera.top=w/aspect/2;camera.bottom=-w/aspect/2;camera.updateProjectionMatrix();}
// Seventeen-second cycle. Stationary holds sleep; no polling/rendering in pauses.
let wake=0,elapsed=0,clockStamp=null,userPaused=false,contextLost=false;
const cycleLength=17000;
const smooth=t=>{t=T.MathUtils.clamp(t,0,1);return t*t*t*(t*(t*6-15)+10);};
function cycleAt(ms){const t=ms%cycleLength;
 if(t<1400)return {open:0,yaw:0,pitch:0,phase:0,moving:false,next:1400-t};
 if(t<4200){const k=smooth((t-1400)/2800);return {open:k,yaw:.06*k,pitch:.04*k,phase:1,moving:true};}
 if(t<6200)return {open:1,yaw:.06,pitch:.04,phase:1,moving:false,next:6200-t};
 if(t<9300){const k=smooth((t-6200)/3100);return {open:1,yaw:.06+.21*k,pitch:.04+.13*k,phase:2,moving:true};}
 if(t<11500)return {open:1,yaw:.27,pitch:.17,phase:2,moving:false,next:11500-t};
 if(t<14300){const k=1-smooth((t-11500)/2800);return {open:k,yaw:.27*k,pitch:.17*k,phase:1,moving:true};}
 return {open:0,yaw:0,pitch:0,phase:0,moving:false,next:cycleLength-t+1400};
}
function running(){return visible&&!document.hidden&&!disposed&&!userPaused&&!reduced.matches&&!contextLost;}
function cancel(){if(raf)cancelAnimationFrame(raf);if(wake)clearTimeout(wake);raf=0;wake=0;}
function suspendClock(){if(clockStamp!==null){elapsed+=performance.now()-clockStamp;clockStamp=null;}cancel();}
function resumeClock(){if(running()&&clockStamp===null)clockStamp=performance.now();invalidate();}
function invalidate(){if(wake){clearTimeout(wake);wake=0;}dirty=true;if(!raf&&visible&&!document.hidden&&!disposed&&!contextLost)raf=requestAnimationFrame(tick);}
function tick(t){raf=0;if(!visible||document.hidden||disposed||contextLost)return;if(t-lastFrame<32){raf=requestAnimationFrame(tick);return;}lastFrame=t;
 if(clockStamp!==null){elapsed+=t-clockStamp;clockStamp=t;}
 const state=reduced.matches?{open:1,yaw:.08,pitch:.07,phase:2,moving:false}:cycleAt(elapsed);
 opening=state.open;yaw=state.yaw;pitch=state.pitch;
 $('phase').textContent=['Корпус в сборе','Разборка и сборка','Внутренние узлы'][state.phase];host.dataset.phase=state.phase;
 if(dirty||state.moving){update();renderer.render(scene,camera);frameCount++;dirty=false;}
 animation=running()&&state.moving;
 if(running()){if(state.moving)raf=requestAnimationFrame(tick);else wake=setTimeout(()=>{wake=0;invalidate();},state.next+5);}
}
function syncPause(){$('pause').hidden=reduced.matches;$('pause').textContent=userPaused?'▷':'Ⅱ';$('pause').setAttribute('aria-pressed',String(userPaused));$('pause').setAttribute('aria-label',userPaused?'Продолжить анимацию':'Приостановить анимацию');}
function events(){
 $('pause').onclick=()=>{suspendClock();userPaused=!userPaused;syncPause();resumeClock();};
 document.addEventListener('visibilitychange',()=>document.hidden?suspendClock():resumeClock());
 reduced.addEventListener('change',()=>{suspendClock();syncPause();resumeClock();});
 const canvas=renderer.domElement;
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();suspendClock();contextLost=true;$('fallback').hidden=false;$('fallback').style.display='grid';$('fallback').innerHTML='<img src="'+new URL(current+'-poster.webp',import.meta.url).href+'" alt="'+data[current].name+'">';});
 canvas.addEventListener('webglcontextrestored',()=>{contextLost=false;lastShadowOpening=-1;$('fallback').style.display='none';resumeClock();});
}
window.__hero3d={current,snapshot:()=>{update();renderer.render(scene,camera);return renderer.domElement.toDataURL('image/webp',.88);},stats:()=>({frames:frameCount,drawCalls:renderer?.info.render.calls,triangles:renderer?.info.render.triangles,geometries:renderer?.info.memory.geometries,textures:renderer?.info.memory.textures,pixelRatio:renderer?.getPixelRatio(),opening,visible,animating:running()&&!!animation,elapsed,paused:userPaused,scheduled:!!(raf||wake)}),dispose(){disposed=true;cancel();ro?.disconnect();io?.disconnect();release();geos.forEach(g=>g.dispose());Object.values(mats).forEach(m=>m.dispose());M.led.dispose();env?.dispose();ground?.geometry.dispose();ground?.material.dispose();renderer?.dispose();}};
try{init();}catch(error){console.error(error);$('fallback').hidden=false;$('fallback').style.display='grid';const kind=host.dataset.hero3d;syncUI(kind);$('fallback').innerHTML='<img src="'+new URL(kind+'-poster.webp',import.meta.url).href+'" alt="'+data[kind].name+'">';$('pause').hidden=true;}

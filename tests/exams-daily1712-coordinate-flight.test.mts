import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {advanceFlight,evaluateFlight,flightPoint,FLIGHT_MISSIONS,flightSegment} from '../src/migration/coordinate-flight';
import {routeMetadata} from '../src/migration/route-policy';
import {all,load,mount,React,require,root,text} from './daily19-ui-harness.mts';
import {suite} from './exams-harness.mts';
const {test,finish}=suite('D1712-FLIGHT-'),file='src/migration/CoordinateFlight.tsx';

test('Toàn bộ 147 tuyến chấm theo tọa độ và yêu cầu, không so cặp mẫu; đoạn bay nằm trong khung',()=>{
 let count=0;
 for(const m of FLIGHT_MISSIONS){let solutions=0;
  for(let a=-3;a<=3;a++)for(let b=-3;b<=3;b++){
   const line={a,b},expected=a*m.x+b===m.y&&(m.rule==='any'||(m.rule==='horizontal'?a===0:a<0));
   assert.equal(evaluateFlight(line,m).hit,expected);if(expected)solutions++;count++;
   const segment=flightSegment(line,m.x);assert.ok(segment.start<=segment.end);
   for(let i=0;i<=100;i++){const p=flightPoint(line,m.x,i/100);assert.ok(p.x>=-4-1e-12&&p.x<=4+1e-12);assert.ok(p.y>=-4-1e-12&&p.y<=4+1e-12);assert.ok(Math.abs(p.y-(a*p.x+b))<1e-12);}
   if(expected){const p=flightPoint(line,m.x,1);assert.deepEqual(p,{x:m.x,y:m.y});}
  }
  assert.ok(solutions>0);assert.equal(evaluateFlight(m.example,m).hit,true);
 }
 assert.equal(count,147);assert.equal(evaluateFlight({a:-1,b:3},FLIGHT_MISSIONS[0]).hit,true);
 assert.equal(evaluateFlight({a:4,b:-7},FLIGHT_MISSIONS[0]).hit,false);
 assert.match(evaluateFlight({a:-1,b:-2},FLIGHT_MISSIONS[2]).explanation,/\(−1\) × 2 \+ \(−2\) = -4/);
});
test('Tiến trình hữu hạn, chặn delta lớn và dữ liệu không hữu hạn, không làm nhảy qua màn khi quay lại tab',()=>{
 assert.equal(advanceFlight(.5,0),.5);assert.equal(advanceFlight(.5,-1),.5);assert.equal(advanceFlight(.5,Infinity),.5);
 assert.equal(advanceFlight(.5,10000),advanceFlight(.5,80));assert.equal(advanceFlight(NaN,0),0);
 let p=0;for(let i=0;i<176;i++)p=advanceFlight(p,16);assert.equal(p,1);assert.equal(advanceFlight(1,16),1);
});

function browserMock(reduced=false){
 const keys=['document','matchMedia','requestAnimationFrame','cancelAnimationFrame'] as const,previous=Object.fromEntries(keys.map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 const handlers=new Map<string,()=>void>(),frames=new Map<number,(n:number)=>void>();let counter=0;
 const doc={hidden:false,addEventListener:(key:string,fn:()=>void)=>handlers.set(key,fn),removeEventListener:(key:string)=>handlers.delete(key)};
 Object.defineProperty(globalThis,'document',{configurable:true,value:doc});
 Object.defineProperty(globalThis,'matchMedia',{configurable:true,value:()=>({matches:reduced,addEventListener(){},removeEventListener(){}})});
 Object.defineProperty(globalThis,'requestAnimationFrame',{configurable:true,value:(fn:(n:number)=>void)=>{frames.set(++counter,fn);return counter;}});
 Object.defineProperty(globalThis,'cancelAnimationFrame',{configurable:true,value:(n:number)=>frames.delete(n)});
 return {doc,handlers,frames,step(now:number){const current=[...frames.values()];frames.clear();current.forEach(fn=>fn(now));},restore(){for(const key of keys){if(previous[key])Object.defineProperty(globalThis,key,previous[key]!);else delete (globalThis as any)[key];}}};
}
const choose=(m:any,a:number,b:number)=>{let controls=all(m.tree,(n:any)=>n.type==='select');controls[0].props.onChange({target:{value:String(a)}});m.draw();controls=all(m.tree,(n:any)=>n.type==='select');controls[1].props.onChange({target:{value:String(b)}});m.draw();};

test('Giảm chuyển động dùng đối chiếu chủ động, 3 màn, khóa hệ số, chống callback cũ/bấm đúp, tổng kết thật',()=>{
 const env=browserMock(true),m=mount(file);try{
  const oldLaunch=all(m.tree,n=>n.type==='button'&&text(n)==='Phóng tàu theo tuyến này')[0].props.onClick;
  for(const mission of FLIGHT_MISSIONS){choose(m,mission.example.a,mission.example.b);m.click('Phóng tàu theo tuyến này');assert.equal(env.frames.size,0);assert.ok(all(m.tree,n=>n.type==='select').every(n=>n.props.disabled));
   m.click('Đưa tàu tới điểm đối chiếu');assert.match(text(m.tree),/Tới đèn rồi/);assert.equal(m.focused?.type,'div');
   const next=all(m.tree,n=>n.type==='button'&&/^(Màn tọa độ tiếp theo|Xem tổng kết tọa độ)$/.test(text(n)))[0].props.onClick;next();next();m.draw();oldLaunch();m.draw();
  }
  assert.match(text(m.tree),/Tuyến đúng: 3\/3/);m.click('Chơi lại 3 màn tọa độ');assert.match(text(m.tree),/Màn 1\/3/);
  choose(m,3,3);m.click('Phóng tàu theo tuyến này');m.click('Đưa tàu tới điểm đối chiếu');assert.match(text(m.tree),/Lệch tọa độ/);assert.match(text(m.tree),/y = 3 × 2 \+ 3 = 9/);
  m.click('Chỉnh tuyến màn này');choose(m,-1,3);m.click('Phóng tàu theo tuyến này');m.click('Đưa tàu tới điểm đối chiếu');assert.match(text(m.tree),/Tới đèn rồi/);m.click('Màn tọa độ tiếp theo');assert.match(text(m.tree),/Màn 2\/3/);
 }finally{m.unmount();assert.equal(env.handlers.size,0);env.restore();}
});

test('RAF có chuyển động thật, pause đóng băng và callback sau hủy không cập nhật màn',()=>{
 const env=browserMock(),m=mount(file);try{
  choose(m,1,-1);m.click('Phóng tàu theo tuyến này');const transform=()=>all(m.tree,n=>n.props?.className?.startsWith?.('coordinate-flight-ship'))[0].props.transform;
  env.step(0);env.step(16);m.draw();const moving=transform();env.step(32);m.draw();assert.notEqual(transform(),moving);
  const pause=all(m.tree,n=>n.type==='button'&&text(n)==='Tạm dừng chuyến bay')[0].props.onClick;pause();pause();m.draw();assert.match(text(m.tree),/Đã tạm dừng/);assert.equal(env.frames.size,0);
  m.click('Tiếp tục chuyến bay');env.doc.hidden=true;env.handlers.get('visibilitychange')!();m.draw();assert.match(text(m.tree),/Đã tạm dừng/);
  env.doc.hidden=false;m.click('Tiếp tục chuyến bay');const stale=[...env.frames.values()][0];m.click('Làm lại từ màn 1');const before=text(m.tree);stale(100000);m.draw();assert.equal(text(m.tree),before);
  m.click('Phóng tàu theo tuyến này');const afterUnmount=[...env.frames.values()][0];m.unmount();assert.equal(env.frames.size,0);afterUnmount(100001);
 }finally{m.unmount();env.restore();}
});

test('Tải lười, route Sân chơi là trang thật, SSR giữ chế độ khám phá v1 và chưa tải màn bay',()=>{
 const html=require('react-dom/server').renderToStaticMarkup(React.createElement(load('src/migration/GuideGraphGame.tsx').default));
 assert.equal((html.match(/<select/g)||[]).length,2);assert.match(html,/Mở màn tàu tọa độ/);assert.doesNotMatch(html,/coordinate-flight-scene/);
 const app=readFileSync(join(root,'src/App.tsx'),'utf8'),game=readFileSync(join(root,'src/migration/GuideGraphGame.tsx'),'utf8');
 assert.match(app,/const Playground=lazy/);assert.match(app,/path==='\/san-choi'\?<Playground\/>/);assert.match(game,/lazy\(\(\)=>import\('\.\/CoordinateFlight'\)\)/);
 const meta=routeMetadata('/san-choi','localhost');assert.equal(meta.known,true);assert.match(meta.title,/Sân chơi Toán/);assert.ok(meta.url.endsWith('/san-choi'));
 assert.doesNotMatch(readFileSync(join(root,file),'utf8')+readFileSync(join(root,'src/migration/coordinate-flight.ts'),'utf8'),/fetch\(|localStorage|sessionStorage|\u2014/);
 const m=mount('src/migration/GuideGraphGame.tsx');try{
  m.click('Mở màn tàu tọa độ');const boundary=()=>all(m.tree,n=>typeof n.type==='function'&&n.type.name==='FlightBoundary')[0],before=boundary(),view=before.props.children.props.children.type;
  before.props.onRetry();m.draw();assert.notEqual(boundary().key,before.key);assert.notEqual(boundary().props.children.props.children.type,view);
  const instance=new before.type({children:'nội dung',onRetry(){}});instance.state=before.type.getDerivedStateFromError();assert.match(text(instance.render()),/Thử mở lại chuyến bay/);
 }finally{m.unmount();}
});
finish({note:'5 nhóm: 147 tuyến, 14.847 vị trí bay, Toán, RAF/pause/hide/unmount, callbacks, SSR/route/lazy.'});

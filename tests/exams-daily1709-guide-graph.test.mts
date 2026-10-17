import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {GRAPH_COEFFICIENTS,compareGraphs,graphEquation,graphFraction,graphInfo,readGraphCoefficient,type GraphLine} from '../src/migration/guide-graph-game';
import {all,load,mount,React,require,root,text} from './daily19-ui-harness.mts';
import {suite} from './exams-harness.mts';
const {test,finish}=suite('D1709-GRAPH-LAB-'),game='src/migration/GuideGraphGame.tsx',launcher='src/migration/GuideGraphLauncher.tsx';
const lines:GraphLine[]=GRAPH_COEFFICIENTS.flatMap(a=>GRAPH_COEFFICIENTS.map(b=>({a,b})));
const selects=(m:any)=>all(m.tree,n=>n.type==='select');
const plot=(m:any)=>all(m.tree,n=>n.type?.name==='LineGraph')[0];
function choose(m:any,index:number,value:string){selects(m)[index].props.onChange({target:{value}});m.draw();}

test('49 cặp hệ số: bảng giá trị, tăng giảm/hằng và giao trục đúng bằng tính độc lập',()=>{
 assert.equal(lines.length,49);assert.deepEqual(GRAPH_COEFFICIENTS,[-3,-2,-1,0,1,2,3]);
 for(const line of lines){
  const info=graphInfo(line);assert.equal(info.equation,graphEquation(line));assert.deepEqual(info.values.map(p=>p.x),[-1,0,1]);
  assert.deepEqual(info.values.map(p=>p.y),[line.b-line.a,line.b,line.b+line.a]);
  assert.equal(info.values[2].y-info.values[1].y,line.a);assert.equal(info.values[1].y-info.values[0].y,line.a);
  if(line.a>0)assert.match(info.behaviour,/y tăng vì a > 0/);else if(line.a<0)assert.match(info.behaviour,/y giảm vì a < 0/);else assert.match(info.behaviour,/Hàm hằng.*không phải hàm bậc nhất/);
  assert.ok(info.oy.includes('(0; '+String(line.b).replace('-','−')+')'));
  if(line.a===0){assert.match(info.ox,line.b===0?/trùng trục Ox.*mọi điểm/:/không giao trục Ox/);}else{
   assert.equal(line.a*(-line.b)+line.b*line.a,0);const expected='('+graphFraction(-line.b,line.a)+'; 0)';assert.ok(info.ox.includes(expected));
  }
 }
 assert.equal(graphEquation({a:0,b:0}),'y = 0');assert.equal(graphEquation({a:1,b:0}),'y = x');assert.equal(graphEquation({a:-1,b:-2}),'y = −x − 2');assert.equal(graphEquation({a:2,b:3}),'y = 2x + 3');
 assert.match(graphInfo({a:3,b:1}).ox,/−1\/3; 0/);assert.equal(graphFraction(2,6),'1/3');assert.equal(graphFraction(-2,-6),'1/3');assert.equal(graphFraction(6,-4),'−3/2');assert.equal(graphFraction(0,-3),'0');assert.throws(()=>graphFraction(1,0));
});

test('2.401 cặp ghim: trùng/song song/cắt, tọa độ phân số chính xác và kiểm cả hai chiều khung',()=>{
 const count={same:0,parallel:0,intersect:0};
 for(const current of lines)for(const pinned of lines){
  const before=JSON.stringify({current,pinned}),comparison=compareGraphs(current,pinned);count[comparison.kind]++;assert.equal(JSON.stringify({current,pinned}),before);
  if(current.a===pinned.a){assert.equal(comparison.kind,current.b===pinned.b?'same':'parallel');continue;}
  assert.equal(comparison.kind,'intersect');if(comparison.kind!=='intersect')throw Error('Cần giao điểm');
  const p=comparison.point;assert.ok(p.denominator>0);
  // Nhân chéo độc lập, không thay tọa độ bằng số làm tròn.
  assert.ok(p.yNumerator===current.a*p.xNumerator+current.b*p.denominator);
  assert.ok(p.yNumerator===pinned.a*p.xNumerator+pinned.b*p.denominator);
  const expectedInside=Math.abs(p.xNumerator)<=4*p.denominator&&Math.abs(p.yNumerator)<=4*p.denominator;
  assert.equal(comparison.inside,expectedInside);assert.match(comparison.text,expectedInside?/nằm trong khung/:/nằm ngoài khung/);
 }
 assert.deepEqual(count,{same:49,parallel:294,intersect:2058});
 const fraction=compareGraphs({a:3,b:0},{a:0,b:1});assert.match(fraction.text,/\(1\/3; 1\)/);
 const outsideX=compareGraphs({a:1,b:-3},{a:0,b:3});assert.equal(outsideX.kind,'intersect');if(outsideX.kind==='intersect'){assert.equal(outsideX.point.x,6);assert.equal(outsideX.inside,false);}
 const outsideOnlyY=compareGraphs({a:2,b:3},{a:3,b:1});assert.equal(outsideOnlyY.kind,'intersect');if(outsideOnlyY.kind==='intersect'){assert.equal(outsideOnlyY.point.x,2);assert.equal(outsideOnlyY.point.y,7);assert.equal(outsideOnlyY.inside,false);}
});

test('49 trạng thái SVG: hai trục cùng đơn vị, clipping và mô tả khớp công thức, bảng giá trị',()=>{
 const {LineGraph}=load(game);
 for(const line of lines){
  const tree=LineGraph({line,pinned:{a:-1,b:1},id:'lab'}),current=all(tree,n=>n.props.className==='guide-graph-line')[0],pinned=all(tree,n=>n.props.className==='guide-graph-pinned')[0];
  assert.equal(current.props.x1,24);assert.equal(current.props.x2,264);assert.equal(current.props.y1,144-30*(-4*line.a+line.b));assert.equal(current.props.y2,144-30*(4*line.a+line.b));assert.equal(current.props.clipPath,'url(#lab-clip)');assert.equal(pinned.props.clipPath,'url(#lab-clip)');
  const description=text(all(tree,n=>n.type==='desc')[0]);assert.ok(description.includes(graphEquation(line)));assert.match(description,/hai trục cùng đơn vị.*mỗi ô là 1 đơn vị/);assert.match(description,/Trục Ox nằm ngang/);assert.match(description,/Đồ thị ghim y = −x \+ 1, nét đứt/);assert.ok(description.includes(graphInfo(line).values.map(p=>p.y).join(', ')));
  const html=require('react-dom/server').renderToStaticMarkup(React.createElement(LineGraph,{line,pinned:null,id:'lab'}));assert.match(html,/role="img"/);assert.match(html,/aria-labelledby="lab-graph-title lab-graph-desc"/);assert.match(html,/<clipPath/);assert.match(html,/>O<\/text>/);assert.match(html,/>x<\/text>/);assert.match(html,/>y<\/text>/);
 }
});

test('Đổi hệ số cập nhật đồ thị và bảng đồng thời, input sai bị bỏ, select giữ thao tác bàn phím gốc',()=>{
 const m=mount(game);try{
  assert.equal(selects(m).length,2);assert.deepEqual(selects(m).map(n=>n.props.value),[1,0]);assert.equal(all(m.tree,n=>n.type==='option').length,14);
  for(const s of selects(m)){assert.ok(all(m.tree,n=>n.type==='label'&&n.props.htmlFor===s.props.id).length===1);assert.equal(s.props.onKeyDown,undefined);assert.equal(s.props.tabIndex,undefined);}
  for(const line of lines){choose(m,0,String(line.a));choose(m,1,String(line.b));assert.equal(plot(m).props.line.a,line.a);assert.equal(plot(m).props.line.b,line.b);assert.deepEqual(all(m.tree,n=>n.type==='td').map(n=>n.props.children),[line.b-line.a,line.b,line.b+line.a]);assert.ok(text(m.tree).includes(graphEquation(line)));}
  const before=text(m.tree);for(const value of ['','4','-4','1.5','01','1e0','NaN','Infinity','__proto__','<script>']){choose(m,0,value);choose(m,1,value);assert.equal(text(m.tree),before);assert.equal(readGraphCoefficient(value),null);}
  assert.deepEqual(GRAPH_COEFFICIENTS.map(String).map(readGraphCoefficient),[...GRAPH_COEFFICIENTS]);assert.equal(all(m.tree,n=>n.props.role==='status').length,1);assert.equal(all(m.tree,n=>n.props['aria-live']==='polite').length,1);assert.equal(all(m.tree,n=>n.type==='table')[0].props['aria-live'],undefined);
 }finally{m.unmount();}
});

test('Ghim là snapshot RAM, đổi a/b nhận xét đúng, bỏ ghim/reset giữ focus ở điều khiển dùng được',()=>{
 const m=mount(game);try{
  m.click('Ghim để so sánh');assert.deepEqual(plot(m).props.pinned,{a:1,b:0});assert.match(text(m.tree),/Hai đồ thị trùng nhau/);
  choose(m,1,'2');assert.deepEqual(plot(m).props.pinned,{a:1,b:0});assert.match(text(m.tree),/Hai đồ thị song song/);assert.match(text(m.tree),/Nét đứt đã ghim: y = x/);
  choose(m,0,'-1');assert.match(text(m.tree),/Hai đồ thị cắt nhau tại \(1; 1\)/);m.click('Cập nhật đồ thị ghim');assert.deepEqual(plot(m).props.pinned,{a:-1,b:2});assert.match(text(m.tree),/Hai đồ thị trùng nhau/);
  m.click('Bỏ ghim');assert.equal(plot(m).props.pinned,null);assert.equal(m.focused?.type,'button');assert.match(text(m.tree),/Chưa ghim đồ thị so sánh/);assert.equal(all(m.tree,n=>n.props.className==='guide-graph-swatch guide-graph-swatch-pinned').length,0);
  choose(m,0,'0');choose(m,1,'0');assert.match(text(m.tree),/Hàm hằng/);assert.match(text(m.tree),/trùng trục Ox/);m.click('Ghim để so sánh');m.click('Đặt lại a = 1, b = 0');assert.equal(m.focused?.type,'select');assert.match(m.focused?.id,/-a$/);assert.deepEqual(selects(m).map(n=>n.props.value),[1,0]);assert.equal(plot(m).props.pinned,null);
 }finally{m.unmount();}
 const fresh=mount(game);try{assert.deepEqual(selects(fresh).map(n=>n.props.value),[1,0]);assert.equal(plot(fresh).props.pinned,null);}finally{fresh.unmount();}
});

test('Bấm ghim trùng không tạo lịch sử, callback cũ sau reset không làm bẩn phòng khám phá mới',()=>{
 const m=mount(game);try{
  const oldSelect=selects(m)[0].props.onChange,oldPin=all(m.tree,n=>n.type==='button'&&text(n)==='Ghim để so sánh')[0].props.onClick;
  oldPin();oldPin();m.draw();assert.deepEqual(plot(m).props.pinned,{a:1,b:0});choose(m,0,'3');choose(m,1,'-2');m.click('Đặt lại a = 1, b = 0');const before=text(m.tree);
  oldSelect({target:{value:'-3'}});oldPin();m.draw();assert.equal(text(m.tree),before);assert.equal(plot(m).props.pinned,null);
 }finally{m.unmount();}
});

test('SSR, launcher lazy cả mã/CSS, đóng gỡ trạng thái và ranh lỗi riêng, không quiz/network/storage',()=>{
 const m=mount(launcher);try{
  assert.equal(all(m.tree,n=>n.type===React.Suspense).length,0);m.click('Mở phòng khám phá');assert.equal(all(m.tree,n=>n.type===React.Suspense).length,1);assert.equal(all(m.tree,n=>n.type==='button')[0].props['aria-expanded'],true);m.click('Đóng phòng khám phá');assert.equal(all(m.tree,n=>n.type===React.Suspense).length,0);
 }finally{m.unmount();}
 const {GuideGraphBoundary}=load(launcher),b=new GuideGraphBoundary({children:React.createElement('span',null,'Lab')});assert.equal(text(b.render()),'Lab');b.state=GuideGraphBoundary.getDerivedStateFromError();assert.equal(b.render().props.role,'alert');assert.match(text(b.render()),/Các hướng dẫn bên dưới vẫn dùng được/);
 const ssr=require('react-dom/server').renderToStaticMarkup(React.createElement(load(game).default));assert.equal((ssr.match(/<select/g)||[]).length,2);assert.match(ssr,/<svg/);assert.match(ssr,/<table/);assert.match(ssr,/Bảng giá trị/);assert.doesNotMatch(ssr,/type="radio"/);
 const closed=require('react-dom/server').renderToStaticMarkup(React.createElement(load(launcher).default));assert.match(closed,/Khám phá đồ thị: tự đổi a, b/);assert.doesNotMatch(closed,/<svg|<select/);
 const code=readFileSync(join(root,launcher),'utf8'),gameCode=readFileSync(join(root,game),'utf8');assert.match(code,/lazy\(\(\)=>import\('\.\/GuideGraphGame'\)\)/);assert.doesNotMatch(code,/import ['"].*\.css/);assert.match(gameCode,/import '\.\/guide-graph-game\.css'/);
 const guide=readFileSync(join(root,'src/migration/Guide.tsx'),'utf8');assert.match(guide,/!parent&&<GuideGraphLauncher\/>/);
 const css=readFileSync(join(root,'src/migration/guide-graph-game.css'),'utf8');assert.match(css,/min-height:44px/);assert.match(css,/:focus-visible/);assert.match(css,/#213269/);assert.match(css,/#FFCF24/);assert.match(css,/stroke-dasharray/);assert.doesNotMatch(css,/100vw|min-width:[4-9]\d\dpx/);
 assert.doesNotMatch(code+gameCode+readFileSync(join(root,'src/migration/guide-graph-game.ts'),'utf8'),/fetch\(|localStorage|sessionStorage|setInterval|setTimeout|\u2014|GRAPH_QUESTIONS|type="radio"/);
});
finish({note:'7 nhóm kiểm phòng khám phá, 49 trạng thái, 2.401 cặp so sánh, hook/focus/SSR/lazy; chưa thay QA trình duyệt.'});

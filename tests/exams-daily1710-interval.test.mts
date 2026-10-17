import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {combineIntervals,createIntervalRound,intervalContains,intervalDescription,intervalSetText,type Interval} from '../src/native/chapters/interval-game';
import {suite} from './exams-harness.mts';
import {all,load,mount,React,require,root,text} from './daily19-ui-harness.mts';
const {test,finish}=suite('D1710-INTERVAL-');
const contains=(i:Interval,x:number)=>i.from<=x&&x<=i.to&&(x!==i.from||i.leftClosed)&&(x!==i.to||i.rightClosed);
const point=(x:number):Interval=>({from:x,to:x,leftClosed:true,rightClosed:true});
const file='src/native/chapters/IntervalGame.tsx';
const button=(m:any,label:string)=>all(m.tree,n=>n.type==='button'&&text(n)===label)[0].props.onClick;
const choose=(m:any,id:string)=>{all(m.tree,n=>n.type==='button'&&n.props['aria-pressed']!==undefined&&n.props.onClick)[Number(id.at(-1))].props.onClick();m.draw();};
test('Oracle độc lập toàn miền hữu hạn, mọi đầu mút đóng mở và nửa đơn vị giữa chúng',()=>{
  const intervals:Interval[]=[];
  for(let from=-2;from<=2;from++)for(let to=from;to<=2;to++)for(const leftClosed of [false,true])for(const rightClosed of [false,true])intervals.push({from,to,leftClosed,rightClosed});
  let checks=0;
  for(const a of intervals)for(const b of intervals)for(const op of ['intersection','union'] as const){
    const result=combineIntervals(a,b,op);
    for(let x=-3;x<=3;x+=.5){
      const expected=op==='intersection'?contains(a,x)&&contains(b,x):contains(a,x)||contains(b,x);
      assert.equal(result.some(i=>contains(i,x)),expected,JSON.stringify({a,b,op,x,result}));checks++;
    }
    assert.ok(result.length<=2);
    for(const i of result)assert.ok(i.from<i.to||i.from===i.to&&i.leftClosed&&i.rightClosed);
    if(result.length===2)assert.ok(result[0].to<result[1].from||result[0].to===result[1].from&&!result[0].rightClosed&&!result[1].leftClosed);
  }
  assert.equal(checks,93600);
  for(const i of intervals)for(let x=-3;x<=3;x+=.5)assert.equal(intervalContains(i,x),contains(i,x));
});
test('Tiếp xúc: giao là một điểm hoặc rỗng; hợp gộp khi có điểm tiếp xúc, giữ lỗ khi hai đầu mở',()=>{
  const a={from:-2,to:0,leftClosed:true,rightClosed:true},b={from:0,to:3,leftClosed:true,rightClosed:false};
  assert.deepEqual(combineIntervals(a,b,'intersection'),[point(0)]);
  assert.deepEqual(combineIntervals({...a,rightClosed:false},b,'intersection'),[]);
  assert.equal(intervalSetText(combineIntervals(a,{...b,leftClosed:false},'union')),'[-2; 3)');
  assert.equal(intervalSetText(combineIntervals({...a,rightClosed:false},{...b,leftClosed:false},'union')),'[-2; 0) ∪ (0; 3)');
  assert.equal(intervalSetText([point(0)]),'{0}');assert.equal(intervalSetText([]),'∅');
  assert.match(intervalDescription([point(-1)]),/chỉ gồm số -1/);assert.match(intervalDescription([]),/không có phần tử/);
});
test('Miền tham số từ chối vô hạn, thập phân, đảo đầu và phép toán sai',()=>{
  const a={from:0,to:2,leftClosed:true,rightClosed:false};
  for(const bad of [{...a,from:Infinity},{...a,from:.5},{...a,to:-1},{...a,leftClosed:1}])assert.throws(()=>combineIntervals(bad as Interval,a,'union'));
  assert.throws(()=>combineIntervals(a,a,'sum' as any));assert.equal(intervalContains(a,NaN),false);
});
test('6 bộ hữu hạn, mỗi bộ 5 câu và 3 lựa chọn phân biệt; đáp án duy nhất đúng theo membership độc lập',()=>{
  const seen=new Set<string>();
  for(let round=0;round<6;round++){
    const qs=createIntervalRound(round);assert.equal(qs.length,5);
    for(const q of qs){
      seen.add(q.id);assert.equal(new Set(q.choices.map(c=>c.text)).size,3);
      const correct=q.choices.filter(c=>{for(let x=-10;x<=10;x+=.5){const expected=q.operation==='intersection'?contains(q.a,x)&&contains(q.b,x):contains(q.a,x)||contains(q.b,x);if(c.value.some(i=>contains(i,x))!==expected)return false;}return true;});
      assert.deepEqual(correct.map(c=>c.id),[q.correctId]);assert.ok(q.steps.length>=6);assert.ok(q.steps.at(-1)!.includes(intervalSetText(q.result)));
    }
  }
  assert.equal(seen.size,30);assert.deepEqual(createIntervalRound(6),createIntervalRound(0));assert.deepEqual(createIntervalRound(NaN),createIntervalRound(0));
});
test('SVG hiển thị chấm kín, mở; một điểm một chấm; tập rỗng không vẽ đoạn và mô tả bằng chữ',()=>{
  const Axis=load(file).IntervalAxis,render=(parts:Interval[])=>require('react-dom/server').renderToStaticMarkup(React.createElement(Axis,{parts,min:-3,max:3,label:'Kết quả'}));
  const closed=render([{from:-2,to:2,leftClosed:true,rightClosed:false}]);
  assert.match(closed,/role="img"/);assert.match(closed,/<title[^>]*>Kết quả/);assert.match(closed,/<desc[^>]*>.*không lấy đầu 2/);assert.match(closed,/<figcaption>/);
  assert.equal((closed.match(/<circle/g)||[]).length,2);assert.match(closed,/fill="#fff"/);assert.match(closed,/fill="#213269"/);
  assert.equal((render([point(0)]).match(/<circle/g)||[]).length,1);
  const empty=render([]);assert.equal((empty.match(/<circle/g)||[]).length,0);assert.match(empty,/tập rỗng, không có phần tử/);assert.doesNotMatch(empty,/stroke-width="6"/);
});
test('Bắt đầu, chọn, khóa đáp án, focus phản hồi, next; callback cũ và bấm đúp không ghi lại',()=>{
  const m=mount(file),qs=createIntervalRound(0),oldStart=button(m,'Bắt đầu 5 câu tập nghiệm');oldStart();oldStart();m.draw();assert.equal(m.focused.type,'h4');
  const stale=all(m.tree,n=>n.type==='button'&&n.props['aria-pressed']!==undefined)[0].props.onClick;
  choose(m,qs[0].correctId);assert.match(text(m.tree),/Đúng rồi!/);assert.equal(m.focused.type,'div');
  assert.equal(all(m.tree,n=>n.type==='button'&&n.props['aria-pressed']!==undefined).filter(n=>n.props.disabled).length,3);
  const next=button(m,'Câu tập nghiệm tiếp theo');next();next();m.draw();assert.match(text(m.tree),/Câu 2\/5/);
  stale();oldStart();next();m.draw();assert.match(text(m.tree),/Câu 2\/5/);assert.doesNotMatch(text(m.tree),/Đúng rồi!/);assert.equal(m.focused.type,'h4');m.unmount();
});
test('Hoàn tất, ôn riêng câu sai, bộ mới, dừng; stale retry/new/stop không phá lượt mới',()=>{
  const m=mount(file),qs=createIntervalRound(0);m.click('Bắt đầu 5 câu tập nghiệm');
  for(let i=0;i<5;i++){choose(m,i===0?qs[i].choices.find(c=>c.id!==qs[i].correctId)!.id:qs[i].correctId);m.click(i===4?'Xem tổng kết tập nghiệm':'Câu tập nghiệm tiếp theo');}
  assert.match(text(m.tree),/Em chọn đúng 4\/5/);
  const oldRetry=button(m,'Ôn lại câu tập nghiệm đã chọn sai'),oldNew=button(m,'Thử bộ 5 câu tập nghiệm khác'),oldStop=button(m,'Kết thúc tập nghiệm');
  oldRetry();oldRetry();m.draw();assert.match(text(m.tree),/Ôn lại · Câu 1\/1/);
  oldNew();oldStop();m.draw();assert.match(text(m.tree),/Ôn lại · Câu 1\/1/);
  choose(m,qs[0].correctId);m.click('Xem tổng kết tập nghiệm');assert.match(text(m.tree),/Em chọn đúng 1\/1/);
  m.click('Thử bộ 5 câu tập nghiệm khác');assert.match(text(m.tree),/Câu 1\/5/);const stop=button(m,'Dừng lượt tập nghiệm');m.click('Dừng lượt tập nghiệm');assert.equal(m.focused.type,'h3');
  m.click('Bắt đầu 5 câu tập nghiệm');stop();oldRetry();oldNew();oldStop();m.draw();assert.match(text(m.tree),/Câu 1\/5/);m.unmount();
});
test('SSR và source: chỉ tự luyện, dữ kiện tự biên soạn, không timer/storage/mạng; tải lazy trong PracticeTool có key chương',()=>{
  const Component=load(file).default,html=require('react-dom/server').renderToStaticMarkup(React.createElement(Component));
  assert.match(html,/MTM sưu tầm và biên soạn/);assert.match(html,/Dữ kiện tự biên soạn, không thuộc đề gốc/);assert.match(html,/Không tính điểm thi/);assert.doesNotMatch(html,/role="timer"|<svg|<input/);
  const source=readFileSync(join(root,file),'utf8');assert.doesNotMatch(source,/localStorage|sessionStorage|fetch\(|setInterval|setTimeout/);
  const library=readFileSync(join(root,'src/native/chapters/PracticeLibrary.tsx'),'utf8');assert.match(library,/const IntervalGame=lazy\(\(\)=>import\('\.\/IntervalGame'\)\)/);assert.ok(library.includes("<PracticeTool key={'interval:'+selected.id+':'+chapter.id}"));
});
finish({note:'Oracle độc lập 93600 mẫu; hook và SSR chưa thay thế kiểm trình duyệt thật.'});

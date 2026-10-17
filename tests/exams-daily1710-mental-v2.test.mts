import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {createMentalRound,mentalInteger,mentalModes,type MentalQuestion} from '../src/native/chapters/mental-math';
import {suite} from './exams-harness.mts';
import {all,load,mount,React,require,root,text} from './daily19-ui-harness.mts';
const {test,finish}=suite('D1710-MENTAL-V2-');
const file='src/native/chapters/MentalMath.tsx';
const button=(m:any,label:string)=>all(m.tree,n=>n.type==='button'&&text(n)===label)[0].props.onClick;
const input=(m:any,value:string)=>{all(m.tree,n=>n.type==='input')[0].props.onChange({target:{value}});m.draw();};
const submit=(m:any)=>{all(m.tree,n=>n.type==='form')[0].props.onSubmit({preventDefault(){}});m.draw();};
const mode=(m:any,value:string)=>{all(m.tree,n=>n.type==='select')[0].props.onChange({target:{value}});m.draw();};
const finishRound=(m:any,qs:MentalQuestion[],helpFirst=false)=>{for(let i=0;i<qs.length;i++){if(helpFirst&&i===0)m.click('Xem cách giải câu này');else {input(m,String(qs[i].answer));submit(m);}m.click(i===qs.length-1?'Xem tổng kết lượt này':'Câu tiếp theo');}};
const independent=(q:MentalQuestion)=>{
  const [kind,first,second]=q.id.split(':'),a=Number(first),b=Number(second),add=(n:number,times:number)=>Array.from({length:times},()=>n).reduce((s,x)=>s+x,0),sq=(n:number)=>Array.from({length:n},(_,i)=>2*i+1).reduce((s,x)=>s+x,0);
  return kind==='nine'?add(a,9):kind==='ninety-nine'?add(a,99):kind==='square'?sq(a):kind==='product'?add(a-b,a+b):sq(a+b)-sq(a-b);
};
test('Giữ API v1 mặc định tổng hợp và tạo đủ 5 câu khác nhau đúng kỹ thuật ở mọi chế độ',()=>{
  assert.equal(mentalModes.length,6);
  for(let round=0;round<100;round++)for(const item of mentalModes){
    const qs=createMentalRound(round,item.id);assert.equal(qs.length,5);assert.equal(new Set(qs.map(q=>q.id)).size,5);
    if(item.id==='mixed'){assert.deepEqual(qs,createMentalRound(round));assert.deepEqual(qs.map(q=>q.kind),['nine','ninety-nine','square','product','difference']);}else assert.ok(qs.every(q=>q.kind===item.id));
    assert.deepEqual(qs,createMentalRound(round,item.id));for(const q of qs){assert.equal(q.answer,independent(q));assert.ok(q.steps.at(-1)!.endsWith(q.answer+'.'));}
  }
  assert.deepEqual(createMentalRound(NaN,'square'),createMentalRound(0,'square'));assert.throws(()=>createMentalRound(0,'invalid' as any));
});
test('Chọn kỹ thuật có nhãn đúng, không nhận chế độ giả, reset giữ mode; bộ khác cùng kỹ thuật',()=>{
  const m=mount(file);assert.equal(all(m.tree,n=>n.type==='select')[0].props.value,'mixed');assert.equal(all(m.tree,n=>n.type==='option').length,6);
  mode(m,'square');mode(m,'invalid');assert.equal(all(m.tree,n=>n.type==='select')[0].props.value,'square');m.click('Bắt đầu 5 câu tính nhẩm');assert.match(text(m.tree),/Bình phương số tận cùng là 5/);
  finishRound(m,createMentalRound(0,'square'));assert.match(text(m.tree),/Em tự làm đúng 5\/5/);m.click('Thử bộ 5 câu khác');assert.ok(text(m.tree).includes(createMentalRound(1,'square')[0].prompt));
  m.click('Dừng lượt tính nhẩm');assert.equal(all(m.tree,n=>n.type==='select')[0].props.value,'square');assert.equal(m.focused.type,'h3');m.unmount();
});
test('Input rỗng, chuỗi dở dang và biểu thức không thành số; số nguyên hợp lệ và focus phản hồi',()=>{
  for(const value of ['', ' ','12x','2+3','1.5','1e3','1,000','9007199254740992'])assert.equal(mentalInteger(value),null);
  const m=mount(file);m.click('Bắt đầu 5 câu tính nhẩm');submit(m);assert.equal(m.focused.type,'input');assert.equal(all(m.tree,n=>n.type==='input')[0].props['aria-invalid'],true);
  input(m,String(createMentalRound(0)[0].answer));submit(m);assert.match(text(m.tree),/Chính xác!/);assert.equal(m.focused.type,'div');assert.equal(all(m.tree,n=>n.type==='input')[0].props.readOnly,true);m.unmount();
});
test('Stale check/input/hint sau thay input và sau chuyển câu bị chặn, double check/next không làm mất câu',()=>{
  const m=mount(file),qs=createMentalRound(0);m.click('Bắt đầu 5 câu tính nhẩm');
  const oldSubmit=all(m.tree,n=>n.type==='form')[0].props.onSubmit,oldInput=all(m.tree,n=>n.type==='input')[0].props.onChange,oldHint=all(m.tree,n=>n.type==='details')[0].props.onToggle;
  input(m,String(qs[0].answer));oldSubmit({preventDefault(){}});oldInput({target:{value:'0'}});oldHint({currentTarget:{open:true}});m.draw();assert.equal(all(m.tree,n=>n.type==='input')[0].props.value,String(qs[0].answer));assert.doesNotMatch(text(m.tree),/Chính xác!/);
  const check=all(m.tree,n=>n.type==='form')[0].props.onSubmit;check({preventDefault(){}});check({preventDefault(){}});m.draw();assert.match(text(m.tree),/Chính xác!/);
  const next=button(m,'Câu tiếp theo');next();next();m.draw();assert.match(text(m.tree),/Câu 2\/5/);next();oldSubmit({preventDefault(){}});oldInput({target:{value:'5'}});m.draw();assert.match(text(m.tree),/Câu 2\/5/);assert.equal(all(m.tree,n=>n.type==='input')[0].props.value,'');m.unmount();
});
test('Hoàn tất hữu hạn, retry câu hỗ trợ; callback start/retry/new/end cũ không khởi động lại lượt',()=>{
  const m=mount(file),qs=createMentalRound(0),oldStart=button(m,'Bắt đầu 5 câu tính nhẩm');oldStart();oldStart();m.draw();
  finishRound(m,qs,true);assert.match(text(m.tree),/Em tự làm đúng 4\/5/);
  const retry=button(m,'Ôn lại câu cần luyện'),oldNew=button(m,'Thử bộ 5 câu khác'),oldEnd=button(m,'Kết thúc tự luyện');retry();retry();m.draw();assert.match(text(m.tree),/Ôn lại · Câu 1\/1/);
  oldStart();oldNew();oldEnd();m.draw();assert.match(text(m.tree),/Ôn lại · Câu 1\/1/);finishRound(m,[qs[0]]);assert.match(text(m.tree),/Em tự làm đúng 1\/1/);
  m.click('Kết thúc tự luyện');assert.equal(m.focused.type,'h3');m.click('Bắt đầu 5 câu tính nhẩm');retry();oldEnd();oldStart();m.draw();assert.match(text(m.tree),/Câu 1\/5/);m.unmount();
});
test('Dừng rồi bắt đầu: stop cũ không xóa lượt mới và giữ technique; không đẩy round khi bấm đúp bộ khác',()=>{
  const m=mount(file);mode(m,'product');m.click('Bắt đầu 5 câu tính nhẩm');const stop=button(m,'Dừng lượt tính nhẩm');stop();stop();m.draw();m.click('Bắt đầu 5 câu tính nhẩm');stop();m.draw();assert.match(text(m.tree),/Tích của tổng và hiệu/);
  finishRound(m,createMentalRound(0,'product'));const another=button(m,'Thử bộ 5 câu khác');another();another();m.draw();assert.ok(text(m.tree).includes(createMentalRound(1,'product')[0].prompt));m.unmount();
});
test('SSR có 6 option, nhãn select và nguồn; lazy boundary; CSS control 48px, không thêm storage/mạng/timer',()=>{
  const Component=load(file).default,html=require('react-dom/server').renderToStaticMarkup(React.createElement(Component));assert.equal((html.match(/<option/g)||[]).length,6);assert.match(html,/Chọn kỹ thuật muốn luyện/);assert.match(html,/MTM sưu tầm và biên soạn/);assert.doesNotMatch(html,/<input|role="timer"/);
  const source=readFileSync(join(root,file),'utf8');assert.doesNotMatch(source,/localStorage|sessionStorage|fetch\(|setInterval|setTimeout/);
  const css=readFileSync(join(root,'src/native/chapters/mental-math.css'),'utf8');assert.match(css,/\.ep-root \.cp-mental select\{[^}]*min-height:48px/);
  const library=readFileSync(join(root,'src/native/chapters/PracticeLibrary.tsx'),'utf8');assert.match(library,/const MentalMath=lazy\(\(\)=>import\('\.\/MentalMath'\)\)/);
});
finish({note:'API mặc định v1 tương thích; 3000 câu mode được đối chiếu độc lập; hook/SSR chưa thay QA trình duyệt.'});

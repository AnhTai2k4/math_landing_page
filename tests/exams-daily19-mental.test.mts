import assert from 'node:assert/strict';
import {mentalQuestion,createMentalRound,mentalInteger} from '../src/native/chapters/mental-math';
import {suite} from './exams-harness.mts';
import {all,load,mount,React,require,text} from './daily19-ui-harness.mts';
const {test,finish}=suite('D19-MENTAL-');
const sum=(n:number,count:number)=>Array.from({length:count},()=>n).reduce((s,x)=>s+x,0);
const square=(n:number)=>Array.from({length:n},(_,i)=>2*i+1).reduce((s,x)=>s+x,0);
test('Đối chiếu độc lập toàn miền 202 cấu hình bằng cộng lặp và tổng số lẻ',()=>{
  let count=0;
  for(const [kind,max,m] of [['nine',49,9],['ninety-nine',39,99]] as const)for(let n=12;n<=max;n++){assert.equal(mentalQuestion(kind,n).answer,sum(n,m));count++;}
  for(let n=25;n<=95;n+=10){assert.equal(mentalQuestion('square',n).answer,square(n));count++;}
  for(let a=20;a<=90;a+=10)for(let b=2;b<=9;b++){
    assert.equal(mentalQuestion('product',a,b).answer,sum(a+b,a-b));
    assert.equal(mentalQuestion('difference',a,b).answer,square(a+b)-square(a-b));count+=2;
  }
  assert.equal(count,202);
});
test('Miền tham số và chuỗi nhập không nhận mẫu mơ hồ hoặc chuỗi dở dang',()=>{
  for(const text of ['', ' ', '12.0','1,000','1e3','2+3','Infinity','NaN','12abc','1 000','9007199254740992','--2'])assert.equal(mentalInteger(text),null,text);
  for(const [text,n] of [['0',0],[' -12 ',-12],['+12',12],['0003',3]] as const)assert.equal(mentalInteger(text),n);
  for(const [kind,a,b] of [['nine',11,0],['nine',50,0],['ninety-nine',40,0],['square',30,0],['product',25,3],['difference',90,10]] as const)assert.throws(()=>mentalQuestion(kind,a,b));
});
test('Bộ 5 có thứ tự dạng ổn định, tham số thay đổi, mỗi lời giải kết thúc đúng đáp án',()=>{
  const ids=new Set<string>();
  for(let round=0;round<512;round++){
    const questions=createMentalRound(round);assert.deepEqual(questions.map(q=>q.kind),['nine','ninety-nine','square','product','difference']);
    assert.equal(new Set(questions.map(q=>q.id)).size,5);ids.add(questions.map(q=>q.id).join('|'));
    for(const q of questions){assert.ok(q.steps.at(-1)!.endsWith(q.answer+'.'));assert.ok(q.hint);assert.ok(q.spoken);}
  }
  assert.ok(ids.size>=32);assert.deepEqual(createMentalRound(NaN),createMentalRound(0));
  assert.equal(mentalQuestion('square',35).answer,1225);assert.equal(mentalQuestion('difference',50,3).answer,600);
});
test('10.000 bộ phủ đủ 64 cặp tham số cho mỗi dạng tích và hiệu bình phương',()=>{
  const product=new Set<string>(),difference=new Set<string>();
  for(let round=0;round<10000;round++){const questions=createMentalRound(round);product.add(questions[3].id);difference.add(questions[4].id);}
  assert.equal(product.size,64);assert.equal(difference.size,64);
});
const file='src/native/chapters/MentalMath.tsx';
const input=(m:any,value:string)=>{all(m.tree,n=>n.type==='input')[0].props.onChange({target:{value}});m.draw();};
const submit=(m:any)=>{all(m.tree,n=>n.type==='form')[0].props.onSubmit({preventDefault(){}});m.draw();};
test('Ô trống không chấm thành số 0, kiểm câu trả lời rồi focus lời giải, sang câu giữ focus',()=>{
  const m=mount(file);assert.equal(all(m.tree,n=>n.type==='input').length,0);m.click('Bắt đầu 5 câu tính nhẩm');assert.equal(m.focused.type,'h4');
  assert.equal(all(m.tree,n=>n.type==='input')[0].props.inputMode,'numeric');
  submit(m);assert.equal(all(m.tree,n=>n.type==='input')[0].props['aria-invalid'],true);assert.equal(m.focused.type,'input');
  input(m,String(createMentalRound(0)[0].answer));submit(m);assert.match(text(m.tree),/Chính xác!/);assert.equal(m.focused.type,'div');assert.equal(all(m.tree,n=>n.type==='input')[0].props.readOnly,true);
  m.click('Câu tiếp theo');assert.match(text(m.tree),/Câu 2\/5/);assert.equal(all(m.tree,n=>n.type==='input')[0].props.value,'');assert.equal(m.focused.type,'h4');m.unmount();
});
test('Gợi ý và câu sai được đưa vào ôn riêng; sự kiện gợi ý cũ không ảnh hưởng câu mới',()=>{
  const m=mount(file),questions=createMentalRound(0);m.click('Bắt đầu 5 câu tính nhẩm');
  const oldHint=all(m.tree,n=>n.type==='details')[0].props.onToggle;oldHint({currentTarget:{open:true}});m.draw();input(m,String(questions[0].answer));submit(m);m.click('Câu tiếp theo');
  oldHint({currentTarget:{open:true}});m.draw();
  for(let i=1;i<5;i++){input(m,String(questions[i].answer));submit(m);m.click(i===4?'Xem tổng kết lượt này':'Câu tiếp theo');}
  assert.match(text(m.tree),/Em tự làm đúng 4\/5/);m.click('Ôn lại câu cần luyện');assert.match(text(m.tree),/Ôn lại · Câu 1\/1/);
  input(m,String(questions[0].answer));submit(m);m.click('Xem tổng kết lượt này');assert.match(text(m.tree),/Em tự làm đúng 1\/1/);
  assert.equal(all(m.tree,n=>n.type==='button'&&text(n)==='Ôn lại câu cần luyện').length,0);m.unmount();
});
test('Có thể xem lời giải không trả lời, hoàn tất hữu hạn, bắt đầu bộ khác hoặc dừng',()=>{
  const m=mount(file);m.click('Bắt đầu 5 câu tính nhẩm');
  for(let i=0;i<5;i++){m.click('Xem cách giải câu này');assert.match(text(m.tree),/Cách tính nhanh/);m.click(i===4?'Xem tổng kết lượt này':'Câu tiếp theo');}
  assert.match(text(m.tree),/Em tự làm đúng 0\/5/);assert.equal(all(m.tree,n=>n.type==='details').length,5);
  m.click('Thử bộ 5 câu khác');assert.match(text(m.tree),new RegExp(createMentalRound(1)[0].prompt.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  for(let i=0;i<5;i++){m.click('Xem cách giải câu này');m.click(i===4?'Xem tổng kết lượt này':'Câu tiếp theo');}
  m.click('Kết thúc tự luyện');assert.equal(m.focused.type,'h3');assert.equal(all(m.tree,n=>n.type==='input').length,0);m.unmount();
});

test('Gợi ý từ lượt cũ không đánh dấu hỗ trợ khi ôn lại đúng câu có cùng ID',()=>{
  const m=mount(file),questions=createMentalRound(0);m.click('Bắt đầu 5 câu tính nhẩm');
  const oldHint=all(m.tree,n=>n.type==='details')[0].props.onToggle;
  m.click('Xem cách giải câu này');m.click('Câu tiếp theo');
  for(let i=1;i<5;i++){input(m,String(questions[i].answer));submit(m);m.click(i===4?'Xem tổng kết lượt này':'Câu tiếp theo');}
  m.click('Ôn lại câu cần luyện');assert.match(text(m.tree),/Ôn lại · Câu 1\/1/);
  oldHint({currentTarget:{open:true}});m.draw();input(m,String(questions[0].answer));submit(m);
  assert.match(text(m.tree),/Chính xác! Em đã tự tính đúng câu này/);
  m.click('Xem tổng kết lượt này');assert.match(text(m.tree),/Em tự làm đúng 1\/1/);m.unmount();
});
test('SSR công khai nói rõ tự luyện và không có điểm, đồng hồ, lịch sử hay yêu cầu đăng nhập',()=>{
  const Component=load(file).default,html=require('react-dom/server').renderToStaticMarkup(React.createElement(Component));
  assert.match(html,/Tính nhẩm 5 câu/);assert.match(html,/Không thuộc đề kiểm tra/);assert.match(html,/MTM sưu tầm và biên soạn/);
  assert.doesNotMatch(html,/<input|role="timer"/);
});
finish({note:'Đáp án kiểm độc lập; hook và SSR không thay thế QA trình duyệt thật.'});

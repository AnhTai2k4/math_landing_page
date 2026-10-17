import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {planHomeworkTime,type HomeworkTimeMode} from '../src/native/homework/time-plan';
import {all,load,mount,React,require,root,text} from './daily19-ui-harness.mts';
import {suite} from './exams-harness.mts';
const {test,finish}=suite('D1709-TIME-'),file='src/native/homework/HomeworkTimePlan.tsx';

test('Nhịp Cân bằng giữ nguyên kết quả v1, nhịp tăng soát bảo toàn tổng ở toàn bộ miền hợp lệ',()=>{
  assert.deepEqual(planHomeworkTime('30','10'),{minutes:30,questions:10,readMinutes:3,solveMinutes:21,reviewMinutes:6,secondsPerQuestion:126});
  assert.deepEqual(planHomeworkTime('30','10','review'),{minutes:30,questions:10,readMinutes:3,solveMinutes:18,reviewMinutes:9,secondsPerQuestion:108});
  for(let minutes=5;minutes<=180;minutes++)for(let questions=1;questions<=100;questions++){
    const balanced=planHomeworkTime(String(minutes),String(questions))!;
    assert.deepEqual(planHomeworkTime(String(minutes),String(questions),'balanced'),balanced);
    for(const mode of ['balanced','review'] as const){
      const plan=planHomeworkTime(String(minutes),String(questions),mode)!;
      assert.equal(plan.readMinutes+plan.solveMinutes+plan.reviewMinutes,minutes);
      assert.equal(plan.readMinutes,balanced.readMinutes);
      assert.ok(plan.solveMinutes>=2&&plan.reviewMinutes>=2&&plan.secondsPerQuestion>=1);
      assert.ok(Number.isSafeInteger(plan.secondsPerQuestion));
      assert.ok(plan.secondsPerQuestion*questions<=plan.solveMinutes*60);
      assert.ok((plan.secondsPerQuestion+1)*questions>plan.solveMinutes*60);
      if(mode==='review')assert.ok(minutes===5?plan.reviewMinutes===balanced.reviewMinutes:plan.reviewMinutes>balanced.reviewMinutes);
    }
  }
});

test('Hai nhịp từ chối dữ liệu không hợp lệ và mode lạ',()=>{
  for(const mode of ['balanced','review'] as const){
    for(const value of ['', ' ', '-1','4','181','1.5','Infinity','NaN','1e2','0x10','12a','<script>'])assert.equal(planHomeworkTime(value,'10',mode),null);
    for(const value of ['', ' ', '0','101','2.5','Infinity','1e1','0x10','<img>'])assert.equal(planHomeworkTime('30',value,mode),null);
    assert.ok(planHomeworkTime(' 180 ',' 100 ',mode));
  }
  for(const mode of ['other','',null,1] as unknown as HomeworkTimeMode[])assert.equal(planHomeworkTime('30','10',mode),null);
});

test('Đổi nhịp hoặc preset xóa kế hoạch cũ, tính nhịp mới và giữ số câu đã nhập',()=>{
  const previous=Object.getOwnPropertyDescriptor(globalThis,'requestAnimationFrame'),frames:FrameRequestCallback[]=[];
  Object.defineProperty(globalThis,'requestAnimationFrame',{configurable:true,value:(f:FrameRequestCallback)=>{frames.push(f);return frames.length;}});
  const m=mount(file);
  try{
    const radios=()=>all(m.tree,n=>n.type==='input'&&n.props.type==='radio');
    const submit=()=>{all(m.tree,n=>n.type==='form')[0].props.onSubmit({preventDefault(){}});m.draw();while(frames.length)frames.shift()!(0);};
    const result=()=>all(m.tree,n=>n.props?.role==='region');
    assert.deepEqual(radios().map(n=>n.props.checked),[true,false]);submit();assert.match(text(m.tree),/6 phút soát bài/);
    radios()[1].props.onChange();m.draw();assert.equal(result().length,0);assert.deepEqual(radios().map(n=>n.props.checked),[false,true]);
    submit();assert.match(text(m.tree),/9 phút soát bài/);assert.match(text(m.tree),/18 phút làm bài/);assert.equal(m.focused.type,'div');
    m.click('15 phút');assert.equal(result().length,0);assert.equal(all(m.tree,n=>n.type==='input'&&n.props.type==='text')[1].props.value,'10');
    assert.equal(all(m.tree,n=>n.type==='button'&&text(n)==='15 phút')[0].props['aria-pressed'],true);
    submit();assert.match(text(m.tree),/Kế hoạch 15 phút cho 10 câu/);assert.match(text(m.tree),/4 phút soát bài/);
    m.click('45 phút');assert.equal(result().length,0);submit();assert.match(text(m.tree),/13 phút soát bài/);
    radios()[0].props.onChange();m.draw();assert.equal(result().length,0);submit();assert.match(text(m.tree),/9 phút soát bài/);
  }finally{m.unmount();if(previous)Object.defineProperty(globalThis,'requestAnimationFrame',previous);else delete (globalThis as any).requestAnimationFrame;}
});

test('Sửa lỗi bằng nhịp hoặc preset xóa cảnh báo cũ và giữ nhãn truy cập',()=>{
  const m=mount(file);try{
    const invalid=()=>{all(m.tree,n=>n.type==='input'&&n.props.type==='text')[0].props.onChange({target:{value:'0'}});m.draw();all(m.tree,n=>n.type==='form')[0].props.onSubmit({preventDefault(){}});m.draw();};
    invalid();assert.equal(all(m.tree,n=>n.props?.role==='alert').length,1);
    all(m.tree,n=>n.type==='input'&&n.props.value==='review')[0].props.onChange();m.draw();assert.equal(all(m.tree,n=>n.props?.role==='alert').length,0);
    invalid();m.click('30 phút');assert.equal(all(m.tree,n=>n.props?.role==='alert').length,0);
    assert.equal(all(m.tree,n=>n.type==='fieldset')[0].props.children[0].type,'legend');
    assert.equal(new Set(all(m.tree,n=>n.type==='input'&&n.props.type==='radio').map(n=>n.props.name)).size,1);
  }finally{m.unmount();}
});

test('SSR, preset có phân biệt trạng thái và không thêm mạng, lưu trữ hay đồng hồ',()=>{
  const html=require('react-dom/server').renderToStaticMarkup(React.createElement(load(file).default));
  assert.match(html,/Cân bằng/);assert.match(html,/Tăng thời gian soát/);assert.match(html,/quỹ chỉ 5 phút/);assert.match(html,/15 phút/);
  const code=readFileSync(join(root,file),'utf8')+readFileSync(join(root,'src/native/homework/time-plan.ts'),'utf8');
  assert.doesNotMatch(code,/fetch\(|localStorage|sessionStorage|setInterval|setTimeout|gateway|\u2014/);
  const css=readFileSync(join(root,'src/native/homework/time-plan.css'),'utf8');
  assert.ok(css.lastIndexOf('.ep-root .btvn-time-presets button{')>css.indexOf('.ep-root .btvn-time-plan button{'));
  assert.match(css,/button\[aria-pressed=true\]\{background:#FFCF24/);assert.match(css,/min-height:44px/);
});
finish({note:'5 nhóm kiểm, 35.200 cấu hình hai nhịp, giữ API và kết quả mặc định v1.'});

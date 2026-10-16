import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {makeStudyPlan,studyGoals,studyDurations} from '../src/migration/study-compass';
import {all,load,mount,React,require,root,text} from './daily19-ui-harness.mts';
import {suite} from './exams-harness.mts';
const {test,finish}=suite('D1705-COMPASS-'),file='src/migration/StudyCompass.tsx';

test('Đủ 9 tổ hợp, ba bước tổng phút khớp và đi tới công cụ đang có',()=>{
  const routes=new Set(['/luyen-tap','/thi-thu','/so-tay']);
  for(const goal of studyGoals)for(const minutes of studyDurations){
    const p=makeStudyPlan(goal.id,minutes)!;assert.equal(p.goal,goal.label);assert.equal(p.steps.length,3);
    assert.equal(p.steps.reduce((total,step)=>total+step.minutes,0),minutes);
    for(const step of p.steps){assert.ok(step.minutes>0&&Number.isInteger(step.minutes));assert.ok(routes.has(step.href));assert.ok(step.title&&step.detail&&step.link);}
  }
  assert.match(makeStudyPlan('understand',20)!.steps[0].detail,/Ôn nhanh công thức/);
  assert.match(makeStudyPlan('mistakes',10)!.steps[0].detail,/Chưa có lịch sử/);
  assert.match(makeStudyPlan('challenge',30)!.steps[0].detail,/Tính nhẩm 5 câu/);
});

test('Không tạo kế hoạch cho mục tiêu hoặc thời gian không hợp lệ',()=>{
  for(const value of ['', 'wrong','__proto__','<script>'])assert.equal(makeStudyPlan(value,20),null);
  for(const value of [0,-10,5,15,20.5,NaN,Infinity,180])assert.equal(makeStudyPlan('understand',value),null);
});

test('Đổi mục tiêu/quỹ phút xóa đầu ra cũ, gửi lại tạo đúng ba bước và focus vùng có nhãn',()=>{
  const previous=Object.getOwnPropertyDescriptor(globalThis,'requestAnimationFrame'),frames:FrameRequestCallback[]=[];
  Object.defineProperty(globalThis,'requestAnimationFrame',{configurable:true,value:(f:FrameRequestCallback)=>{frames.push(f);return frames.length;}});
  const m=mount(file);try{
    const select=()=>all(m.tree,n=>n.type==='select');
    const submit=()=>{all(m.tree,n=>n.type==='form')[0].props.onSubmit({preventDefault(){}});m.draw();while(frames.length)frames.shift()!(0);};
    assert.equal(all(m.tree,n=>n.type==='li').length,0);submit();assert.match(text(m.tree),/Hiểu chắc bài đang học trong 20 phút/);assert.equal(m.focused.type,'div');
    select()[0].props.onChange({target:{value:'mistakes'}});m.draw();assert.equal(all(m.tree,n=>n.type==='li').length,0);
    select()[1].props.onChange({target:{value:'10'}});m.draw();submit();assert.match(text(m.tree),/Gỡ một câu từng làm sai trong 10 phút/);assert.equal(all(m.tree,n=>n.type==='li').length,3);
    const links=all(m.tree,n=>n.props?.href);assert.deepEqual(links.map(n=>n.props.href),['/thi-thu','/luyen-tap','/so-tay']);
    select()[0].props.onChange({target:{value:'bad'}});m.draw();submit();assert.equal(all(m.tree,n=>n.type==='li').length,0);assert.equal(all(m.tree,n=>n.props?.role==='alert').length,1);
    select()[0].props.onChange({target:{value:'challenge'}});m.draw();submit();assert.match(text(m.tree),/Thử sức một chút trong 10 phút/);assert.equal(all(m.tree,n=>n.props?.role==='alert').length,0);
    const region=all(m.tree,n=>n.props?.role==='region')[0];assert.equal(all(m.tree,n=>n.props?.id===region.props['aria-labelledby']).length,1);
  }finally{m.unmount();if(previous)Object.defineProperty(globalThis,'requestAnimationFrame',previous);else delete (globalThis as any).requestAnimationFrame;}
});

test('SSR có nhãn/hướng dẫn, chỉ tab học sinh, không lưu hoặc tự mở đề',()=>{
  const html=require('react-dom/server').renderToStaticMarkup(React.createElement(load(file).default));
  assert.match(html,/Hôm nay học gì/);assert.equal((html.match(/<select/g)||[]).length,2);assert.match(html,/không bấm giờ/);assert.doesNotMatch(html,/<ol/);
  const guide=readFileSync(join(root,'src/migration/Guide.tsx'),'utf8');assert.match(guide,/!parent&&<StudyCompass\/>/);
  const code=readFileSync(join(root,file),'utf8')+readFileSync(join(root,'src/migration/study-compass.ts'),'utf8');
  assert.doesNotMatch(code,/fetch\(|localStorage|sessionStorage|setInterval|setTimeout|window\.open|navigate\(|\u2014/);
  assert.match(code,/chưa ghi vào Sổ tay/);assert.match(code,/chưa xác nhận em đã học xong/);
  const css=readFileSync(join(root,'src/migration/study-compass.css'),'utf8');assert.match(css,/min-height:44px/);assert.match(css,/:focus-visible/);assert.match(css,/#213269/);assert.match(css,/#FFCF24/);
});
finish({note:'4 nhóm kiểm với dữ liệu giả và 9 kế hoạch; hook/SSR chưa thay QA trình duyệt.'});

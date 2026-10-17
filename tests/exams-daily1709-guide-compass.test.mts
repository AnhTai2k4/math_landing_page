import assert from 'node:assert/strict';
import {all,mount,text} from './daily19-ui-harness.mts';
import {suite} from './exams-harness.mts';
const {test,finish}=suite('D1709-COMPASS-'),file='src/migration/StudyCompass.tsx';
const checks=(m:any)=>all(m.tree,n=>n.type==='input'&&n.props.type==='checkbox');
function mark(m:any,index:number,checked:boolean){checks(m)[index].props.onChange({target:{checked}});m.draw();}
function submit(m:any){all(m.tree,n=>n.type==='form')[0].props.onSubmit({preventDefault(){}});m.draw();}
function setup(){const previous=Object.getOwnPropertyDescriptor(globalThis,'requestAnimationFrame');Object.defineProperty(globalThis,'requestAnimationFrame',{configurable:true,value:(f:FrameRequestCallback)=>{f(0);return 1;}});return()=>{if(previous)Object.defineProperty(globalThis,'requestAnimationFrame',previous);else delete (globalThis as any).requestAnimationFrame;};}

test('Ba bước tự đánh dấu, bỏ chọn và reset đúng số đếm, không tự xác nhận kết quả học',()=>{
 const restore=setup(),m=mount(file);try{
  assert.equal(checks(m).length,0);submit(m);assert.equal(checks(m).length,3);assert.match(text(m.tree),/Em tự đánh dấu: 0\/3/);
  const links=all(m.tree,n=>n.props.href);assert.equal(links.length,3);assert.ok(links.every(n=>n.props.target==='_blank'&&n.props.rel==='noopener noreferrer'&&text(n).includes('Mở ở thẻ mới')));assert.match(text(m.tree),/Giữ thẻ kế hoạch này để quay lại tự đánh dấu/);
  assert.ok(checks(m).every(n=>typeof n.props.onChange==='function'&&n.props.checked===false&&!n.props.onKeyDown));
  mark(m,0,true);mark(m,0,true);mark(m,2,true);assert.match(text(m.tree),/Em tự đánh dấu: 2\/3/);mark(m,0,false);assert.match(text(m.tree),/Em tự đánh dấu: 1\/3/);mark(m,1,true);mark(m,0,true);assert.match(text(m.tree),/Em tự đánh dấu: 3\/3/);
  m.click('Bỏ dấu hoàn thành');assert.ok(checks(m).every(n=>!n.props.checked));assert.match(text(m.tree),/0\/3/);assert.equal(m.focused?.type,'input');assert.equal(all(m.tree,n=>n.type==='button'&&text(n)==='Bỏ dấu hoàn thành')[0].props.disabled,true);assert.match(text(m.tree),/chưa xác nhận em đã học xong/);
 }finally{m.unmount();restore();}
});

test('Đổi mục tiêu, đổi phút hoặc tạo kế hoạch mới xóa dấu, callback kế hoạch cũ bị bỏ',()=>{
 const restore=setup(),m=mount(file);try{
  submit(m);mark(m,0,true);const oldMark=checks(m)[2].props.onChange;
  all(m.tree,n=>n.type==='select')[0].props.onChange({target:{value:'mistakes'}});m.draw();assert.equal(checks(m).length,0);oldMark({target:{checked:true}});m.draw();submit(m);assert.ok(checks(m).every(n=>!n.props.checked));assert.match(text(m.tree),/Gỡ một câu từng làm sai/);
  mark(m,1,true);all(m.tree,n=>n.type==='select')[1].props.onChange({target:{value:'10'}});m.draw();assert.equal(checks(m).length,0);submit(m);assert.match(text(m.tree),/trong 10 phút/);assert.ok(checks(m).every(n=>!n.props.checked));
  mark(m,2,true);const stale=checks(m)[0].props.onChange;submit(m);stale({target:{checked:true}});m.draw();assert.match(text(m.tree),/Em tự đánh dấu: 0\/3/);assert.ok(checks(m).every(n=>!n.props.checked));
 }finally{m.unmount();restore();}
 const clean=mount(file);try{assert.equal(checks(clean).length,0);}finally{clean.unmount();}
});
finish({note:'2 nhóm kiểm StudyCompass v2 và callback cũ; checkbox dùng tương tác bàn phím gốc.'});

import assert from 'node:assert/strict';
import {suite} from './exams-harness.mts';
import {all,mount,text} from './daily19-ui-harness.mts';
const {test,finish}=suite('D1715-PLAN-'),file='src/native/homework/HomeworkTimePlan.tsx';
function session(){
 const prior=(globalThis as any).requestAnimationFrame,frames:Function[]=[];
 (globalThis as any).requestAnimationFrame=(callback:Function)=>{frames.push(callback);return frames.length;};
 const m=mount(file);
 const submit=()=>{all(m.tree,n=>n.type==='form')[0].props.onSubmit({preventDefault(){}});m.draw();};
 const checks=()=>all(m.tree,n=>n.type==='input'&&n.props.type==='checkbox');
 const input=(index:number)=>all(m.tree,n=>n.type==='input'&&n.props.type==='text')[index];
 return{m,submit,checks,input,frames,close(){m.unmount();if(prior===undefined)delete (globalThis as any).requestAnimationFrame;else(globalThis as any).requestAnimationFrame=prior;}};
}
test('v3 đánh dấu từng chặng, bỏ dấu, tạo lại giữ dấu và không tự nộp bài',()=>{
 const s=session();try{
  s.submit();assert.equal(s.checks().length,3);assert.equal(s.m.tree.props['data-version'],'v3');
  s.checks()[0].props.onChange({target:{checked:true}});s.m.draw();assert.match(text(s.m.tree),/1\/3 chặng/);
  s.submit();assert.equal(s.checks()[0].props.checked,true);
  for(const index of [1,2]){s.checks()[index].props.onChange({target:{checked:true}});s.m.draw();}
  assert.match(text(s.m.tree),/3\/3 chặng/);assert.match(text(s.m.tree),/trước khi tự nộp bài/);
  s.checks()[1].props.onChange({target:{checked:false}});s.m.draw();assert.match(text(s.m.tree),/2\/3 chặng/);
  s.m.click('Bỏ dấu ba chặng');assert.match(text(s.m.tree),/0\/3 chặng/);assert.equal(all(s.m.tree,n=>n.type==='button'&&text(n)==='Bỏ dấu ba chặng')[0].props.disabled,true);
 }finally{s.close();}
});
test('Đổi cấu hình bỏ dấu cũ, callback cũ và RAF cũ không sửa hay giành focus kế hoạch mới',()=>{
 const s=session();try{
  s.submit();const stale=s.checks()[0].props.onChange,staleChange=s.input(0).props.onChange,staleSubmit=all(s.m.tree,n=>n.type==='form')[0].props.onSubmit;
  s.m.click('45 phút');assert.equal(s.checks().length,0);s.submit();
  stale({target:{checked:true}});staleChange({target:{value:'180'}});staleSubmit({preventDefault(){}});s.m.draw();
  assert.equal(s.input(0).props.value,'45');assert.match(text(s.m.tree),/0\/3 chặng/);assert.match(text(s.m.tree),/45 phút cho 10 câu/);
  s.frames[0]();assert.equal(s.m.focused,null);s.frames[1]();assert.equal(s.m.focused.type,'div');
  const staleAfterUnmount=s.checks()[1].props.onChange;s.m.unmount();staleAfterUnmount({target:{checked:true}});s.m.draw();assert.ok(s.checks().every(n=>!n.props.checked));
 }finally{s.close();}
});
test('UX BTVN: chỉ báo lỗi đúng ô, focus ô sai đầu tiên và bỏ lỗi khi sửa',()=>{
 const s=session();try{
  s.input(1).props.onChange({target:{value:'0'}});s.m.draw();s.submit();
  assert.equal(s.input(0).props['aria-invalid'],false);assert.equal(s.input(1).props['aria-invalid'],true);assert.equal(s.m.focused.id,s.input(1).props.id);
  s.input(0).props.onChange({target:{value:'4'}});s.m.draw();s.submit();assert.equal(s.m.focused.id,s.input(0).props.id);assert.equal(s.input(0).props['aria-invalid'],true);
  s.input(0).props.onChange({target:{value:'30'}});s.m.draw();assert.equal(all(s.m.tree,n=>n.props.role==='alert').length,0);
 }finally{s.close();}
});
finish();

import assert from 'node:assert/strict';
import {exam,draft} from './daily1707-fixture.mts';
import {REFLECTION_CAUSES} from '../src/native/exams/result-reflection';
import {all,mount,text} from './daily19-ui-harness.mts';
import {suite} from './exams-harness.mts';
const {test,finish}=suite('D1714-REFLECT-V2-'),file='src/native/exams/ResultReflection.tsx';
const select=(m:any,index:number,value:string)=>{all(m.tree,n=>n.type==='select')[index].props.onChange({target:{value}});m.draw();};
const submit=(m:any)=>{all(m.tree,n=>n.type==='form')[0].props.onSubmit({preventDefault(){}});m.draw();};
const check=(m:any,index:number,checked=true)=>{all(m.tree,n=>n.type==='input'&&n.props.type==='checkbox')[index].props.onChange({target:{checked}});m.draw();};
test('Mỗi nguyên nhân có ba bước tương tác; tự đánh giá chỉ sau khi thực hiện và không tự kết luận đã hiểu',()=>{
 const before=JSON.stringify({exam,draft}),m=mount(file,{exam,draft});select(m,0,'fake-wrong');
 for(const cause of REFLECTION_CAUSES){select(m,1,cause.id);submit(m);assert.equal(all(m.tree,n=>n.props['data-version']==='v2').length,1);assert.deepEqual(all(m.tree,n=>n.type==='li').map(text),[...cause.steps]);
  const assessment=()=>all(m.tree,n=>n.type==='fieldset')[0],radios=()=>all(m.tree,n=>n.type==='input'&&n.props.type==='radio');assert.equal(assessment().props.disabled,true);radios()[0].props.onChange();m.draw();assert.equal(radios()[0].props.checked,false);
  for(let i=0;i<3;i++)check(m,i);assert.match(text(m.tree),/đã thực hiện 3\/3 bước/);assert.equal(assessment().props.disabled,false);assert.equal(radios().some(n=>n.props.checked),false);assert.match(text(m.tree),/Phiếu không xác nhận em đã hiểu bài/);
  radios()[1].props.onChange();m.draw();assert.equal(radios()[1].props.checked,true);check(m,0,false);assert.equal(assessment().props.disabled,true);assert.equal(radios().some(n=>n.props.checked),false);
 }
 assert.equal(JSON.stringify({exam,draft}),before);m.unmount();
});
test('Giữ ghi chú/checklist/tự đánh giá riêng từng câu; đổi nguyên nhân đặt lại tiến độ, giữ ghi chú',()=>{
 const m=mount(file,{exam,draft});select(m,0,'fake-partial');select(m,1,'condition');all(m.tree,n=>n.type==='textarea')[0].props.onChange({target:{value:'Em bỏ sót điều kiện.'}});m.draw();submit(m);for(let i=0;i<3;i++)check(m,i);all(m.tree,n=>n.type==='input'&&n.props.type==='radio')[2].props.onChange();m.draw();
 select(m,0,'fake-wrong');select(m,1,'calculation');submit(m);assert.match(text(m.tree),/đã thực hiện 0\/3 bước/);assert.equal(all(m.tree,n=>n.type==='textarea')[0].props.value,'');check(m,1);
 select(m,0,'fake-partial');assert.equal(all(m.tree,n=>n.type==='textarea')[0].props.value,'Em bỏ sót điều kiện.');assert.match(text(m.tree),/đã thực hiện 3\/3 bước/);assert.equal(all(m.tree,n=>n.type==='input'&&n.props.type==='radio')[2].props.checked,true);
 select(m,1,'reading');submit(m);assert.equal(all(m.tree,n=>n.type==='textarea')[0].props.value,'Em bỏ sót điều kiện.');assert.match(text(m.tree),/đã thực hiện 0\/3 bước/);assert.equal(all(m.tree,n=>n.type==='input'&&n.props.type==='radio').some(n=>n.props.checked),false);m.unmount();
});
test('Thao tác từ phiếu cũ không đánh dấu sau đổi nguyên nhân hoặc phiên mới',()=>{
 const m=mount(file,{exam,draft});select(m,0,'fake-wrong');select(m,1,'calculation');submit(m);const stale=all(m.tree,n=>n.type==='input'&&n.props.type==='checkbox')[0].props.onChange;select(m,1,'condition');submit(m);stale({target:{checked:true}});m.draw();assert.match(text(m.tree),/đã thực hiện 0\/3 bước/);m.unmount();
 const fresh=mount(file,{exam,draft});assert.equal(all(fresh.tree,n=>n.type==='select')[0].props.value,'');fresh.unmount();
});
finish();

import assert from 'node:assert/strict';
import {HOMEWORK_CHECKS,homeworkChecksForFocus,summarizeHomeworkChecks,type HomeworkCheckFocus} from '../src/native/homework/self-check';
import {all,mount,text} from './daily19-ui-harness.mts';
import {suite} from './exams-harness.mts';
const {test,finish}=suite('D1712-CHECK-V2-');
test('Mọi trọng tâm ưu tiên đúng mục, không mất tiêu chí hoặc thay tổng 5, đủ 192 tổ hợp',()=>{
  for(const focus of ['all',...HOMEWORK_CHECKS.map(item=>item.id)] as HomeworkCheckFocus[]){
    const ordered=homeworkChecksForFocus(focus);assert.equal(ordered.length,5);assert.equal(new Set(ordered.map(item=>item.id)).size,5);if(focus!=='all')assert.equal(ordered[0].id,focus);else assert.deepEqual(ordered,HOMEWORK_CHECKS);
    for(let mask=0;mask<32;mask++){
      const selected=HOMEWORK_CHECKS.filter((_,i)=>mask&(1<<i)).map(item=>item.id),result=summarizeHomeworkChecks(selected,focus);
      assert.equal(result.done,selected.length);assert.equal(result.total,5);assert.deepEqual(result.remaining,ordered.filter(item=>!selected.includes(item.id)));assert.equal(result.next,result.remaining[0]??null);
      assert.deepEqual(summarizeHomeworkChecks([...selected,'sai',...selected],focus),result);
    }
  }
});
test('Chọn ưu tiên đổi thứ tự và gợi ý, giữ dấu tự kiểm, mục xong nhường gợi ý cho mục còn thiếu',()=>{
  const m=mount('src/native/homework/HomeworkSelfCheck.tsx'),boxes=()=>all(m.tree,n=>n.type==='input'&&n.props.type==='checkbox');
  try{
    assert.equal(all(m.tree,n=>n.props?.['data-version']==='v2').length,1);boxes()[0].props.onChange();m.draw();
    all(m.tree,n=>n.type==='select')[0].props.onChange({target:{value:'units'}});m.draw();assert.match(text(all(m.tree,n=>n.type==='label'&&all(n,c=>c.type==='input').length===1)[0]),/Đơn vị và làm tròn/);
    assert.equal(all(m.tree,n=>n.type==='progress')[0].props.value,1);assert.equal(boxes().find(n=>n.props.checked)?.props.checked,true);assert.match(text(m.tree),/Bước tiếp theo: đơn vị và làm tròn/);
    boxes()[0].props.onChange();m.draw();assert.equal(all(m.tree,n=>n.type==='progress')[0].props.value,2);assert.match(text(m.tree),/Bước tiếp theo: dấu và phép biến đổi/);
    all(m.tree,n=>n.type==='select')[0].props.onChange({target:{value:'conditions'}});m.draw();assert.equal(boxes()[0].props.checked,true);assert.match(text(m.tree),/Bước tiếp theo: dấu và phép biến đổi/);
    all(m.tree,n=>n.type==='select')[0].props.onChange({target:{value:'khong-hop-le'}});m.draw();assert.equal(all(m.tree,n=>n.type==='select')[0].props.value,'all');assert.equal(all(m.tree,n=>n.type==='progress')[0].props.value,2);
    m.click('Bỏ đánh dấu để tự kiểm lại');assert.equal(all(m.tree,n=>n.type==='progress')[0].props.value,0);assert.equal(m.focused.type,'input');assert.match(text(m.tree),/không tự xác minh/);
  }finally{m.unmount();}
});
finish({note:'2 nhóm nâng v1 -> v2: 192 tổ hợp trọng tâm/đánh dấu và luồng giữ dấu, đổi ưu tiên, reset. Hồi quy ownership giữ test vòng09.'});

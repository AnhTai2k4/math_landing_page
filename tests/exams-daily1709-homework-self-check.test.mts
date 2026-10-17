import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {HOMEWORK_CHECKS,summarizeHomeworkChecks} from '../src/native/homework/self-check';
import {all,load,mount,React,require,root,text} from './daily19-ui-harness.mts';
import {suite} from './exams-harness.mts';
const {test,finish}=suite('D1709-CHECK-'),file='src/native/homework/HomeworkSelfCheck.tsx',toolFile='src/native/homework/HomeworkSelfCheckTool.tsx';

test('5 tiêu chí cụ thể, mọi tổ hợp tính đúng tiến độ và gợi ý mục còn thiếu đầu tiên',()=>{
  assert.equal(HOMEWORK_CHECKS.length,5);assert.equal(new Set(HOMEWORK_CHECKS.map(item=>item.id)).size,5);
  for(let mask=0;mask<32;mask++){
    const selected=HOMEWORK_CHECKS.filter((_,index)=>mask&(1<<index)).map(item=>item.id),before=JSON.stringify(selected);
    const result=summarizeHomeworkChecks(selected);
    assert.equal(result.done,selected.length);assert.equal(result.total,5);
    assert.deepEqual(result.remaining,HOMEWORK_CHECKS.filter(item=>!selected.includes(item.id)));
    assert.equal(result.next,result.remaining[0]??null);assert.equal(JSON.stringify(selected),before);
    assert.deepEqual(summarizeHomeworkChecks([...selected,...selected,'khong-hop-le']),result);
  }
  for(const item of HOMEWORK_CHECKS)assert.ok(item.detail.length>35&&item.hint.length>60);
});

test('Tự đánh dấu, bỏ từng dấu, gợi ý đổi theo mục thiếu; reset và mở phiên mới đều về trống',()=>{
  const m=mount(file);try{
    const boxes=()=>all(m.tree,n=>n.type==='input'&&n.props.type==='checkbox');
    const progress=()=>all(m.tree,n=>n.type==='progress')[0];
    assert.equal(progress().props.value,0);assert.match(text(m.tree),/Bước tiếp theo: điều kiện và nghiệm/);
    assert.equal(all(m.tree,n=>n.type==='button')[0].props.disabled,true);
    for(let index=0;index<5;index++){boxes()[index].props.onChange();m.draw();assert.equal(progress().props.value,index+1);}
    assert.equal(all(m.tree,n=>n.type==='aside').length,0);assert.match(text(m.tree),/Nếu sửa đáp án, hãy kiểm lại/);
    assert.doesNotMatch(text(m.tree),/đã nộp thành công|đáp án đúng|đã xác minh/i);
    boxes()[2].props.onChange();m.draw();assert.equal(progress().props.value,4);assert.match(text(m.tree),/Bước tiếp theo: đơn vị và làm tròn/);
    m.click('Bỏ đánh dấu để tự kiểm lại');assert.equal(progress().props.value,0);assert.ok(boxes().every(n=>n.props.checked===false));assert.equal(m.focused.type,'input');
  }finally{m.unmount();}
  const fresh=mount(file);assert.equal(all(fresh.tree,n=>n.type==='progress')[0].props.value,0);fresh.unmount();
});

test('SSR có nhãn, hướng dẫn tự đánh dấu và không chạm dữ liệu bài, điểm, storage, mạng',()=>{
  const html=require('react-dom/server').renderToStaticMarkup(React.createElement(load(file).default));
  assert.equal((html.match(/type="checkbox"/g)??[]).length,5);assert.match(html,/không tự xác minh/);assert.match(html,/không đọc nội dung hoặc đáp án/);assert.match(html,/không chặn nộp/);assert.match(html,/không phải biên nhận đã nộp bài/);
  const m=mount(file);try{assert.equal(all(m.tree,n=>n.type==='label'&&all(n,c=>c.type==='input').length===1).length,5);assert.equal(all(m.tree,n=>n.type==='form').length,0);assert.equal(all(m.tree,n=>n.type==='button'&&n.props.type==='submit').length,0);assert.equal(all(m.tree,n=>n.props?.role==='status')[0].props['aria-live'],'polite');}finally{m.unmount();}
  const code=[file,toolFile,'src/native/homework/self-check.ts'].map(path=>readFileSync(join(root,path),'utf8')).join('\n');
  assert.doesNotMatch(code,/fetch\(|localStorage|sessionStorage|setInterval|setTimeout|gateway|submittedAt|\.answers\b|dangerouslySetInnerHTML|\u2014/);
});

test('Nút chỉ tải lười sau khi mở, thu gọn giữ nội dung và boundary cho phép thử lại độc lập',()=>{
  const m=mount(toolFile);try{
    assert.equal(all(m.tree,n=>n.type===React.Suspense).length,0);
    assert.equal(all(m.tree,n=>n.props?.role==='region')[0].props.hidden,true);
    m.click('Mở phiếu tự kiểm');assert.equal(all(m.tree,n=>n.type===React.Suspense).length,1);assert.equal(m.focused.type,'div');
    const region=all(m.tree,n=>n.props?.role==='region')[0],button=all(m.tree,n=>n.type==='button')[0];
    assert.equal(button.props['aria-controls'],region.props.id);assert.equal(button.props['aria-expanded'],true);assert.equal(region.props.hidden,false);
    const first=all(m.tree,n=>n.type===React.Suspense)[0].props.children;
    m.click('Thu gọn phiếu tự kiểm');assert.equal(all(m.tree,n=>n.props?.role==='region')[0].props.hidden,true);
    assert.equal(all(m.tree,n=>n.type===React.Suspense)[0].props.children.type,first.type,'Thu gọn giữ cây nội dung và dấu kiểm trong RAM');
    m.click('Mở phiếu tự kiểm');assert.equal(all(m.tree,n=>n.type===React.Suspense)[0].props.children.type,first.type);
    all(m.tree,n=>n.type?.name==='HomeworkSelfCheckBoundary')[0].props.onRetry();m.draw();assert.notEqual(all(m.tree,n=>n.type===React.Suspense)[0].props.children.type,first.type);
  }finally{m.unmount();}
  const {HomeworkSelfCheckBoundary}=load(toolFile);let retries=0;const boundary=new HomeworkSelfCheckBoundary({onRetry:()=>retries++});
  boundary.state=HomeworkSelfCheckBoundary.getDerivedStateFromError();const fallback=boundary.render();assert.match(text(fallback),/Các phần BTVN khác vẫn dùng được/);all(fallback,n=>n.type==='button')[0].props.onClick();assert.equal(retries,1);
  const source=readFileSync(join(root,toolFile),'utf8');assert.match(source,/lazy\(\(\)=>import\('\.\/HomeworkSelfCheck'\)\)/);
});

test('Tích hợp JSX thật: dùng được ngoài cổng, trong lượt đang làm; đổi lượt hoặc rời lượt xóa danh tính phiếu',()=>{
  const render=(state:any,room:boolean,checking=false)=>{
    let index=0;
    const View=load('src/native/homework/HomeworkSession.tsx',{
      useState:(initial:any)=>{const at=index++;return [at===0?state:at===6?room:at===10?checking:typeof initial==='function'?initial():initial,()=>{}];},
      useRef:(initial:any)=>({current:initial}),useMemo:(fn:()=>unknown)=>fn(),useEffect:()=>{},
    }).default;
    const before=JSON.stringify(state),tree=View({pathname:'/btvn'});assert.equal(JSON.stringify(state),before);assert.equal(index,12);
    return {tree,tools:all(tree,n=>n.type?.name==='HomeworkSelfCheckTool'),plans:all(tree,n=>n.type?.name==='HomeworkTimePlan')};
  };
  assert.equal(render(null,false,true).tools.length,0);
  const entry=render(null,false);assert.equal(entry.tools.length,1);assert.equal(entry.plans.length,1);assert.equal(entry.tools[0].key,'entry:');
  const before={lessonCode:'buoi-gia',fullName:'Dữ liệu giả',className:'LỚP GIẢ',lessons:[],draft:null};
  assert.equal(render(before,false).tools.length,1);
  const active={...before,exam:{questions:[]},draft:{attemptId:'luot-gia-1',submittedAt:null}};
  const room=render(active,true);assert.equal(room.tools.length,1);assert.equal(room.plans.length,0);assert.equal(room.tools[0].key,'attempt:luot-gia-1');
  const leftRoom=render(active,false);assert.equal(leftRoom.tools.length,1);assert.equal(leftRoom.tools[0].key,'entry:buoi-gia');assert.notEqual(leftRoom.tools[0].key,room.tools[0].key,'Rời lượt về các buổi học bỏ dấu tự kiểm của lượt');
  assert.deepEqual(Object.keys(room.tools[0].props),[],'Không đưa bài làm hoặc dữ liệu người học vào phiếu');
  const next=render({...active,draft:{...active.draft,attemptId:'luot-gia-2'}},true);assert.notEqual(room.tools[0].key,next.tools[0].key);
  assert.equal(render({...active,draft:{...active.draft,submittedAt:123}},true).tools.length,0,'Kết quả đã nộp không mang dấu tự kiểm của lượt cũ');
  assert.notEqual(render(before,false).tools[0].key,render({...before,lessonCode:'buoi-gia-khac'},false).tools[0].key);
});

test('CSS riêng navy vàng, mục và nút đủ 44px, có focus và không sửa bố cục trang chủ',()=>{
  const css=readFileSync(join(root,'src/native/homework/self-check.css'),'utf8');
  assert.match(css,/#213269/);assert.match(css,/#FFCF24/);assert.match(css,/min-height:44px/);assert.match(css,/:focus-visible/);assert.match(css,/\[hidden\]\{display:none\}/);
  assert.doesNotMatch(css,/\.mig-home|\.home-hero|body\s*\{|:root\s*\{/);
});
finish({note:'6 nhóm kiểm, 32 tổ hợp checklist; hook/SSR và tích hợp JSX ngoại tuyến, chưa thay QA trình duyệt.'});

import assert from 'node:assert/strict';
import {all,mount,text} from './daily19-ui-harness.mts';
import {suite} from './exams-harness.mts';
const {test,finish}=suite('D1712-PLAYGROUND-UX-');
const file='src/native/playground/Playground.tsx';
const boundary=(m:any)=>all(m.tree,n=>n.type?.name==='RiverBoundary')[0];

test('Mở game chuyển focus vào khu vực; thoát về đúng nút mở, mở lại được',()=>{
  const m=mount(file);
  try{
    assert.equal(m.focused,null,'Không giành focus lúc mới vào trang');
    for(let i=0;i<2;i++){
      m.click('Xuống sông chơi thử →');
      assert.equal(m.focused.type,'div');
      assert.equal(all(m.tree,n=>n.props.role==='region')[0].props['aria-label'],'Khu vực Đua thuyền Toán');
      boundary(m).props.children.props.children.props.onExit();m.draw();
      assert.equal(m.focused.type,'button');assert.equal(m.focused.text,'Xuống sông chơi thử →');
      assert.equal(all(m.tree,n=>n.props.role==='region').length,0);
    }
  }finally{m.unmount();}
});

test('Khi tải chậm có status và hủy được, trở lại nút mở mà không đợi chunk',()=>{
  const m=mount(file);
  try{
    m.click('Xuống sông chơi thử →');
    const fallback=boundary(m).props.children.props.fallback;
    assert.match(text(all(fallback,n=>n.props.role==='status')[0]),/Đang đưa thuyền xuống sông/);
    all(fallback,n=>n.type==='button'&&text(n)==='Hủy mở game')[0].props.onClick();m.draw();
    assert.equal(m.focused.text,'Xuống sông chơi thử →');
    assert.equal(text(all(m.tree,n=>n.type==='h2'&&n.props.id==='river-card-heading')[0]),'Đua thuyền Toán');
    assert.equal(all(m.tree,n=>n.type==='button'&&text(n)==='Xuống sông chơi thử →').length,1);
    assert.equal(all(m.tree,n=>n.props.role==='region').length,0);
  }finally{m.unmount();}
});

test('Lỗi tải đưa focus về thử lại; retry tạo chunk mới và vẫn có đường thoát',()=>{
  const m=mount(file);
  try{
    m.click('Xuống sông chơi thử →');
    const prior=boundary(m),view=prior.props.children.props.children.type;
    const error=new prior.type(prior.props);error.state=prior.type.getDerivedStateFromError();
    const failed=error.render(),retry=all(failed,n=>n.type==='button')[0];let focused=0;
    const retryRef=Object.getOwnPropertyDescriptor(retry.props,'ref')?.value??retry.ref;
    retryRef.current={focus(){focused++;}};error.componentDidCatch();assert.equal(focused,1);
    retry.props.onClick();m.draw();
    assert.notEqual(boundary(m).key,prior.key);assert.notEqual(boundary(m).props.children.props.children.type,view);
    const next=boundary(m),nextError=new next.type(next.props);nextError.state=next.type.getDerivedStateFromError();
    all(nextError.render(),n=>n.type==='button'&&text(n)==='Về sân chơi')[0].props.onClick();m.draw();
    assert.equal(m.focused.text,'Xuống sông chơi thử →');
  }finally{m.unmount();}
});
test('Chơi lượt mới chờ stage dựng lại rồi mới focus; chunk tải muộn không kéo focus ngoài khu vực',()=>{
  const names=['window','document','requestAnimationFrame','cancelAnimationFrame'] as const;
  const previous=Object.fromEntries(names.map(name=>[name,(globalThis as any)[name]]));
  (globalThis as any).window={matchMedia:()=>({matches:false})};
  (globalThis as any).document={hidden:false,addEventListener(){},removeEventListener(){}};
  (globalThis as any).requestAnimationFrame=()=>1;(globalThis as any).cancelAnimationFrame=()=>{};
  const m=mount('src/native/playground/RiverRace.tsx',{onExit(){}});
  try{
    assert.equal(m.focused,null,'Không giành focus ngoài khu vực lúc chunk vừa tải');
    m.click('Bắt đầu đua thuyền');assert.equal(m.focused.type,'div');
    const stage=all(m.tree,n=>n.props.className?.startsWith('river-stage'))[0];
    const stageRef=Object.getOwnPropertyDescriptor(stage.props,'ref')?.value??stage.ref;
    m.click('Ⅱ Tạm dừng');m.click('Kết thúc và xem lời giải');assert.equal(m.focused.type,'h2');
    assert.equal(all(m.tree,n=>n.props.className?.startsWith('river-stage')).length,0);
    stageRef.current=null; // React thật xóa ref khi stage rời DOM, hook giả cần mô phỏng bước này.
    m.click('Chèo một lượt mới');assert.equal(m.focused.type,'div');
    assert.match(text(m.tree),/Nhìn câu hỏi, chọn làn, giữ tay lái!/);
  }finally{m.unmount();for(const name of names){if(previous[name]===undefined)delete (globalThis as any)[name];else(globalThis as any)[name]=previous[name];}}
});
finish({note:'Bốn nhóm hành vi focus, tải chậm/hủy, lỗi/retry/thoát và DOM stage khi chơi lại. Hook không thay QA trình duyệt.'});

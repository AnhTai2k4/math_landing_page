import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {counterexampleCards,checkCounterexample,COUNTEREXAMPLE_VERSION} from '../src/native/exams/result-counterexample';
import {all,load,mount,React,require,root,text} from './daily19-ui-harness.mts';
import {suite} from './exams-harness.mts';
const {test,finish}=suite('D1711-COUNTEREXAMPLE-'),file='src/native/exams/ResultCounterexample.tsx';
const button=(m:any,label:string)=>all(m.tree,n=>n.type==='button'&&text(n)===label)[0];
const input=(m:any,value:string)=>{all(m.tree,n=>n.type==='input')[0].props.onChange({target:{value}});m.draw();};
const submit=(m:any)=>{all(m.tree,n=>n.type==='form')[0].props.onSubmit({preventDefault(){}});m.draw();};

test('Oracle độc lập: liệt kê chính xác phản ví dụ và P/Q trên toàn miền số nguyên nhỏ',()=>{
  assert.equal(COUNTEREXAMPLE_VERSION,'v1');
  // Các tập dưới suy ra bằng lập luận trên giấy: số âm; x=2; bội 4 lẻ lần; đầu mút trái.
  const expected=[[-8,-7,-6,-5,-4,-3,-2,-1],[2],[4,12,20],[-2]];
  for(const [i,card] of counterexampleCards.entries()){
    const found:number[]=[];
    for(let n=card.min;n<=card.max;n++){
      const checked=checkCounterexample(card,String(n));assert.equal(checked.ok,true);if(!checked.ok)continue;
      if(checked.counterexample)found.push(n);
      const oracle=[{p:n!==0,q:n>=1},{p:n>=2,q:n<=-2||n>=3},{p:[4,8,12,16,20,24].includes(n),q:[8,16,24].includes(n)},{p:[-2,-1,0,1,2].includes(n),q:[-1,0,1,2].includes(n)}][i];
      assert.equal(checked.premise,oracle.p,card.id+' P '+n);assert.equal(checked.conclusion,oracle.q,card.id+' Q '+n);
    }
    assert.deepEqual(found,expected[i],card.id);
    const sample=checkCounterexample(card,String(card.example));assert.ok(sample.ok&&sample.counterexample);
  }
  const negative=checkCounterexample(counterexampleCards[0],'-3');assert.ok(negative.ok);if(negative.ok)assert.match(negative.detail,/\(-3\)² = 9/);
});

test('Nhập chỉ số nguyên trong miền, nhận dấu trừ chuẩn, không nhận phép tính và giá trị ngoài miền',()=>{
  const card=counterexampleCards[0];
  for(const value of ['', ' ', '1/2','0.5','1,5','1e2','0x10','2+2','Infinity','NaN','-9','9','9999','2<script>'])assert.equal(checkCounterexample(card,value).ok,false,value);
  assert.deepEqual(checkCounterexample(card,' −2 '),checkCounterexample(card,'-2'));
  assert.equal(checkCounterexample(counterexampleCards[2],'0').ok,false);
});

test('Tương tác: thử sai, gợi ý, tự tìm, xem mẫu và tổng kết phân biệt mức trợ giúp',()=>{
  const m=mount(file);try{
    m.click('Bắt đầu tìm phản ví dụ');assert.equal(m.focused.type,'h3');
    input(m,'');submit(m);assert.match(text(m.tree),/Em nhập một số nguyên/);assert.equal(m.focused.type,'div');
    input(m,'0');submit(m);assert.match(text(m.tree),/điều kiện P đang sai/);
    input(m,'2');submit(m);assert.match(text(m.tree),/kết luận Q vẫn đúng/);
    m.click('Cần một gợi ý');assert.match(text(m.tree),/số âm khác 0/);
    input(m,'-2');submit(m);assert.match(text(m.tree),/Em đã tìm được một phản ví dụ/);assert.match(text(m.tree),/\(-2\)² = 4/);
    assert.equal(all(m.tree,n=>n.type==='input')[0].props.readOnly,true);
    m.click('Sang mệnh đề tiếp theo');input(m,'2');submit(m);assert.match(text(m.tree),/4 > 4 là sai/);
    m.click('Sang mệnh đề tiếp theo');m.click('Xem một phản ví dụ mẫu');assert.match(text(m.tree),/Đây là một phản ví dụ mẫu/);assert.match(text(m.tree),/n = 8k = 4 · \(2k\)/);
    m.click('Sang mệnh đề tiếp theo');input(m,'-2');submit(m);m.click('Xem tổng kết phản ví dụ');
    assert.match(text(m.tree),/Tự tìm được trước khi xem mẫu: 3\/4/);assert.equal(m.focused.type,'h3');
    m.click('Kết thúc mini game');assert.equal(m.focused.type,'h2');assert.ok(button(m,'Bắt đầu tìm phản ví dụ'));
  }finally{m.unmount();}
});

test('Callback cũ và bấm đúp không reset lượt, cộng thẻ hoặc giành focus sau chuyển thẻ',()=>{
  const m=mount(file);try{
    const oldStart=button(m,'Bắt đầu tìm phản ví dụ').props.onClick;m.click('Bắt đầu tìm phản ví dụ');
    input(m,'-1');submit(m);
    const oldNext=button(m,'Sang mệnh đề tiếp theo').props.onClick,oldStop=button(m,'Dừng mini game').props.onClick;
    oldNext();oldNext();m.draw();assert.match(text(m.tree),/Thẻ 2\/4/);
    const priorFocus=m.focused;oldStart();oldNext();oldStop();m.draw();assert.match(text(m.tree),/Thẻ 2\/4/);assert.equal(m.focused,priorFocus);
    for(let i=1;i<4;i++){m.click('Xem một phản ví dụ mẫu');m.click(i===3?'Xem tổng kết phản ví dụ':'Sang mệnh đề tiếp theo');}
    const oldReplay=button(m,'Tự luyện lại 4 thẻ').props.onClick;m.click('Tự luyện lại 4 thẻ');
    input(m,'-3');submit(m);m.click('Sang mệnh đề tiếp theo');const before=text(m.tree),focus=m.focused;
    oldReplay();oldStart();oldStop();oldNext();m.draw();assert.equal(text(m.tree),before);assert.equal(m.focused,focus);
  }finally{m.unmount();}
});

test('Gõ nhiều ký tự không kéo focus về tiêu đề; đổi lượt xóa nháp và phản hồi cũ',()=>{
  const m=mount(file);try{
    m.click('Bắt đầu tìm phản ví dụ');const heading=m.focused;input(m,'-');assert.equal(m.focused,heading);input(m,'-1');assert.equal(m.focused,heading);
    submit(m);m.click('Sang mệnh đề tiếp theo');assert.equal(all(m.tree,n=>n.type==='input')[0].props.value,'');assert.doesNotMatch(text(m.tree),/Em đã tìm được/);
    m.click('Dừng mini game');m.click('Bắt đầu tìm phản ví dụ');assert.match(text(m.tree),/Thẻ 1\/4/);assert.equal(all(m.tree,n=>n.type==='input')[0].props.value,'');
  }finally{m.unmount();}
});

test('Chỉ hiển thị sau nộp Thi thử, tải lười, có khôi phục lỗi, không lưu dữ liệu hoặc gọi mạng',()=>{
  const state={draft:{attemptId:'synthetic-only',submittedAt:2000},resultHeading:{current:null},score:{ok:true},unsaved:false,conflict:{current:false},pdfReady:true,retake(){}};
  const exam={id:'synthetic-only',versionHash:'fake',questions:[]};
  for(const [kind,isHomework,submittedAt,expected]of [['exam',false,2000,1],['practice',false,2000,0],['exam',true,2000,0],['exam',false,null,0]]as const){
    const m=mount('src/native/exams/AttemptResult.tsx',{props:{exam,catalogUrl:'/thi-thu',kind,isHomework},state:{...state,draft:{...state.draft,submittedAt}}});
    try{assert.equal(all(m.tree,n=>n.type?.name==='ResultCounterexampleTool').length,expected);}finally{m.unmount();}
  }
  const tool=mount('src/native/exams/ResultCounterexampleTool.tsx'),{CounterexampleBoundary}=load('src/native/exams/ResultCounterexampleTool.tsx');
  try{const first=tool.tree,boundary=new CounterexampleBoundary(first.props);boundary.state=CounterexampleBoundary.getDerivedStateFromError();const failed=boundary.render();assert.match(text(failed),/Kết quả và phần đối chiếu bài thi vẫn dùng được/);all(failed,n=>n.type==='button')[0].props.onClick();tool.draw();assert.notEqual(tool.tree.key,first.key);assert.notEqual(tool.tree.props.children.props.children.type,first.props.children.props.children.type);}finally{tool.unmount();}
  const html=require('react-dom/server').renderToStaticMarkup(React.createElement(load(file).default));assert.match(html,/Phòng thử phản ví dụ/);assert.match(html,/data-version="v1"/);
  for(const source of [file,'src/native/exams/result-counterexample.ts','src/native/exams/ResultCounterexampleTool.tsx'])assert.doesNotMatch(readFileSync(join(root,source),'utf8'),/fetch\(|localStorage|sessionStorage|setInterval|saveDraft|submitDraft|\u2014/);
  assert.match(readFileSync(join(root,'src/native/exams/ResultCounterexampleTool.tsx'),'utf8'),/lazy\(\(\)=>import\('\.\/ResultCounterexample'\)\)/);
  const css=readFileSync(join(root,'src/native/exams/result-counterexample.css'),'utf8');assert.match(css,/min-height:48px/);assert.match(css,/:focus-visible/);assert.match(css,/@media\(max-width:600px\)/);
});
finish({note:'6 nhóm ca, toàn bộ đề/lượt GIẢ ở RAM; oracle độc lập, hook và SSR chưa thay trình duyệt thật.'});

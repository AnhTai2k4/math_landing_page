import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {graphRound,graphQuestion,graphExplanation,lineKey,lineFormula,lineSegment} from '../src/native/chapters/line-graph';
import {all,load,mount,React,require,text,root} from './daily19-ui-harness.mts';
import {suite} from './exams-harness.mts';
const {test,finish}=suite('D20-R3-'),file='src/native/chapters/LineGraphGame.tsx';

test('Toàn bộ miền 20 đường: đúng một đáp án từ hai điểm, đoạn vẽ đúng biên và cùng hàm số',()=>{
  for(const a of [-2,-1,1,2])for(const b of [-2,-1,0,1,2])for(let offset=0;offset<3;offset++){
    const q=graphQuestion(a,b,offset),[p,r]=lineSegment(q.line);
    assert.equal(q.id,lineKey(q.line));assert.equal(new Set(q.choices.map(lineKey)).size,3);
    const matches=q.choices.filter(line=>line.b===b&&line.a+line.b===a+b);
    assert.equal(matches.length,1);assert.equal(lineKey(matches[0]),q.id);
    assert.ok(Math.abs(a+b)<=4);
    assert.ok(p.x<r.x);for(const point of [p,r]){assert.ok(Math.abs(point.x)<=5&&Math.abs(point.y)<=5);assert.equal(point.y,a*point.x+b);assert.ok(Math.abs(point.x)===5||Math.abs(point.y)===5);}
    const steps=graphExplanation(q.line).join(' ');assert.ok(steps.includes('P(0; '+b+')'));assert.ok(steps.includes('Q(1; '+(a+b)+')'));assert.ok(steps.includes(lineFormula(q.line)));
  }
  for(const args of [[0,0],[3,0],[1,3],[1,0.5],[NaN,1]])assert.throws(()=>graphQuestion(...args as [number,number]));
  assert.equal(lineFormula({a:-1,b:0}),'y = −x');assert.equal(lineFormula({a:1,b:-2}),'y = x − 2');
});

test('Mỗi lượt đúng 5 câu khác nhau, hữu hạn, lựa chọn phủ đủ vị trí, tham số sai có fallback',()=>{
  const positions=new Set(),seen=new Set();
  for(let round=0;round<200;round++){
    const questions=graphRound(round);assert.equal(questions.length,5);assert.equal(new Set(questions.map(q=>q.id)).size,5);
    for(const q of questions){seen.add(q.id);positions.add(q.choices.findIndex(line=>lineKey(line)===q.id));}
  }
  assert.deepEqual([...positions].sort(),[0,1,2]);assert.equal(seen.size,20);
  for(const invalid of [NaN,-1,Infinity,1.5])assert.deepEqual(graphRound(invalid),graphRound(0));
});

const select=(m:any,q:ReturnType<typeof graphQuestion>,correct=true)=>{
  const i=q.choices.findIndex(line=>(lineKey(line)===q.id)===correct),label=String.fromCharCode(65+i)+'. '+lineFormula(q.choices[i]);
  const button=all(m.tree,n=>n.type==='button'&&text(n)===label)[0];assert.ok(button);button.props.onClick();m.draw();return button.props.onClick;
};
test('Chọn một lần, khóa sự kiện cũ, phản hồi đúng và ôn riêng câu sai không đổi điểm lượt trước',()=>{
  const m=mount(file),questions=graphRound(0);m.click('Bắt đầu đọc 5 đồ thị');assert.equal(m.focused.type,'h4');
  const stale=select(m,questions[0],false);assert.equal(m.focused.type,'div');
  const rightButton=all(m.tree,n=>n.type==='button'&&text(n).endsWith(lineFormula(questions[0].line)))[0];rightButton.props.onClick();m.draw();assert.doesNotMatch(text(m.tree),/Chính xác!/);
  assert.ok(all(m.tree,n=>n.type==='button'&&n.props['aria-pressed']!==undefined).every(n=>n.props.disabled));
  const oldNext=all(m.tree,n=>n.type==='button'&&text(n)==='Đồ thị tiếp theo')[0].props.onClick;
  m.click('Đồ thị tiếp theo');stale();oldNext();m.draw();assert.match(text(m.tree),/Câu 2\/5/);assert.doesNotMatch(text(m.tree),/Chính xác!/);
  for(let i=1;i<5;i++){select(m,questions[i]);m.click(i===4?'Xem tổng kết đồ thị':'Đồ thị tiếp theo');}
  assert.match(text(m.tree),/Em chọn đúng 4\/5/);m.click('Ôn lại đồ thị đã chọn sai');assert.match(text(m.tree),/Ôn lại · Câu 1\/1/);
  stale();m.draw();assert.doesNotMatch(text(m.tree),/Chính xác!/);select(m,questions[0]);m.click('Xem tổng kết đồ thị');assert.match(text(m.tree),/Em chọn đúng 1\/1/);
  m.click('Kết thúc tự luyện đồ thị');assert.equal(m.focused.type,'h3');assert.match(text(m.tree),/Bắt đầu đọc 5 đồ thị/);m.unmount();
});

test('Lượt đúng toàn bộ có tổng kết, không có ôn câu sai; lượt tiếp đổi câu và không giữ đáp án',()=>{
  const m=mount(file);m.click('Bắt đầu đọc 5 đồ thị');
  for(let i=0;i<5;i++){select(m,graphRound()[i]);m.click(i===4?'Xem tổng kết đồ thị':'Đồ thị tiếp theo');}
  assert.match(text(m.tree),/Em chọn đúng 5\/5/);assert.doesNotMatch(text(m.tree),/Ôn lại đồ thị đã chọn sai/);assert.equal(all(m.tree,n=>n.type==='details').length,5);
  m.click('Thử lượt 5 câu tiếp');assert.match(text(m.tree),/Câu 1\/5/);assert.doesNotMatch(text(m.tree),/Chính xác!/);assert.ok(all(m.tree,n=>n.props?.line)[0].props.line.a===graphRound(1)[0].line.a);m.unmount();
});

test('SVG giữ thang đo vuông, hai điểm, mô tả tương đương hình và ký hiệu trục',()=>{
  const mod=load(file,undefined,'export {LinePlot};');
  for(const a of [-2,-1,1,2])for(const b of [-2,-1,0,1,2]){
    const html=require('react-dom/server').renderToStaticMarkup(React.createElement(mod.LinePlot,{line:{a,b}}));
    assert.match(html,/viewBox="0 0 300 300"/);assert.match(html,/role="img"/);assert.ok(html.includes('P(0; '+b+')'));assert.ok(html.includes('Q(1; '+(a+b)+')'));
    assert.match(html,/>x<\/text>/);assert.match(html,/>y<\/text>/);assert.equal((html.match(/<circle /g)||[]).length,2);assert.doesNotMatch(html,/NaN|Infinity/);
  }
  const html=require('react-dom/server').renderToStaticMarkup(React.createElement(mod.default));assert.match(html,/không thuộc đề kiểm tra/i);assert.match(html,/MTM sưu tầm và biên soạn/);
});

test('Tiện ích chỉ tạo nội dung sau mở, đóng mở giữ cùng phiên; fallback lỗi có hành động đóng riêng',()=>{
  const tool='src/native/chapters/PracticeTool.tsx',m=mount(tool,{label:'Trò thử',loading:'Đang tải',children:React.createElement('p',null,'Nội dung')});
  assert.equal(all(m.tree,n=>n.type?.name==='ToolErrorBoundary').length,0);
  const details=all(m.tree,n=>n.type==='details')[0];details.props.onToggle({currentTarget:{open:true}});m.draw();
  const boundary=all(m.tree,n=>n.type?.name==='ToolErrorBoundary')[0];assert.ok(boundary);
  const ref=details.ref??details.props.ref;let focused=false;ref.current.querySelector=()=>({focus:()=>focused=true});
  boundary.props.onClose();assert.equal(ref.current.open,false);assert.equal(focused,true);
  details.props.onToggle({currentTarget:{open:false}});m.draw();assert.ok(all(m.tree,n=>n.type?.name==='ToolErrorBoundary').length);
  let closed=0;const {ToolErrorBoundary}=load(tool),instance=new ToolErrorBoundary({children:'GOOD',onClose:()=>closed++});assert.equal(instance.render(),'GOOD');
  instance.state=ToolErrorBoundary.getDerivedStateFromError(Error('Chunk failed'));
  assert.match(text(instance.render()),/vẫn có thể chọn bài luyện/);assert.doesNotMatch(text(instance.render()),/Chunk failed/);
  all(instance.render(),n=>n.type==='button')[0].props.onClick();assert.equal(closed,1);m.unmount();
});

test('Sáu tiện ích có boundary độc lập theo khối/chương; danh sách bài nằm ngoài wrapper',()=>{
  const source=readFileSync(join(root,'src/native/chapters/PracticeLibrary.tsx'),'utf8');
  assert.equal((source.match(/<PracticeTool key=/g)||[]).length,6);assert.ok(source.includes("const LineGraphGame=lazy(()=>import('./LineGraphGame'))"));
  assert.ok(source.includes("const ErrorHunt=lazy(()=>import('./ErrorHunt'))"));
  assert.ok(source.includes("const StepSolver=lazy(()=>import('./StepSolver'))"));
  for(const kind of ['recall','mental','formula','graph','error','solver'])assert.ok(source.includes("key={'"+kind+":'+selected.id+':'+chapter.id}"));
  assert.ok(source.indexOf('<ChapterShelf')>source.lastIndexOf('</PracticeTool>'));assert.doesNotMatch(source,/setRecallReady|setFormulaReady|setMentalReady/);
});

test('Trợ giúp Zalo không nhận dữ liệu phiên, không tự điều hướng và luôn nhắc bài chưa lưu',()=>{
  const help='src/native/homework/HomeworkBrowserHelp.tsx',mod=load(help);
  const html=require('react-dom/server').renderToStaticMarkup(React.createElement(mod.default));
  assert.match(html,/<details/);assert.match(html,/<summary/);assert.match(html,/minhthanhmath.vn\/btvn/);assert.match(html,/chưa được máy chủ nhận/);assert.match(html,/Đăng nhập lại/);assert.doesNotMatch(html,/<a |<button|<input|<form/);
  const source=readFileSync(join(root,help),'utf8');assert.doesNotMatch(source,/window|navigator|location|fetch|localStorage|sessionStorage/);
  const session=readFileSync(join(root,'src/native/homework/HomeworkSession.tsx'),'utf8');assert.ok(session.indexOf('<HomeworkBrowserHelp/>')>session.indexOf('<header className="btvn-top"'));
});

test('Phòng tập trung BTVN có hướng dẫn trong portal; phòng luyện tập thường không nhận trợ giúp đăng nhập',()=>{
  const path='src/native/exams/FocusRoom.tsx',code=require('esbuild').buildSync({stdin:{contents:readFileSync(join(root,path),'utf8'),sourcefile:path,resolveDir:join(root,'src/native/exams'),loader:'tsx'},bundle:true,write:false,platform:'node',format:'cjs',jsx:'automatic',packages:'external',loader:{'.css':'empty'},logLevel:'silent'}).outputFiles[0].text;
  const previous=globalThis.document;(globalThis as any).document={body:{},compatMode:'CSS1Compat'};
  try{for(const isHomework of [false,true]){
    let stateIndex=0;const mod={exports:{} as any};
    new Function('require','module','exports',code)((id:string)=>id==='react'?{...React,useState:(init:any)=>{const value=stateIndex++===5?true:typeof init==='function'?init():init;return[value,()=>{}];},useRef:(value:any)=>({current:value}),useEffect(){},useLayoutEffect(){}}:id==='react-dom'?{...require(id),createPortal:(tree:any)=>tree}:id.endsWith('.css')?{}:require(id),mod,mod.exports);
    const tree=mod.exports.default({props:{isHomework,exam:{id:'synthetic-graph-help',title:'Đề tổng hợp',rubricVersion:'MTM-FLEX-10-v1',sections:[{label:'I',kind:'mc',count:1}],questions:[{id:'q',kind:'mc',text:'Câu tổng hợp',sourceRef:'Câu tổng hợp',choices:['A','B','C','D'],answer:'A',maxMillipoints:10000}]},storeOverride:{getItem:()=>null,setItem(){},removeItem(){}}},state:{draft:{attemptId:'fixture-help',answers:{}},sections:[{name:'I',from:0,to:1}],activeQuestion:0,seconds:600,answered:0,states:['blank'],pdfReady:true},onExit(){}});
    const panel=all(tree,n=>n.type==='section'&&n.props['aria-label']==='Phím tắt')[0];assert.ok(panel);
    assert.equal(all(panel,n=>n.type?.name==='HomeworkBrowserHelp').length,isHomework?1:0);
    if(isHomework)assert.match(text(tree),/Hướng dẫn \/ Zalo/);else assert.doesNotMatch(text(tree),/Hướng dẫn \/ Zalo/);
  }}finally{if(previous===undefined)delete (globalThis as any).document;else globalThis.document=previous;}
});
finish();

import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {domainQuestions} from '../src/native/chapters/domain-check';
import {all,load,mount,React,require,root,text} from './daily19-ui-harness.mts';
import {suite,FakeStore} from './exams-harness.mts';
import {createDraft,draftKey} from '../src/native/exams/store';
import {validatePracticeExam,type PracticeExam} from '../src/native/exams/data';
const {test,finish}=suite('D22-R3-'),file='src/native/chapters/DomainCheck.tsx';
const label=(q:any,correct=true)=>{const i=q.choices.findIndex((c:any)=>(c.id===q.correctId)===correct);return String.fromCharCode(65+i)+'. '+q.choices[i].text;};

test('Điều kiện: đối chiếu độc lập cả miền, biên và chỉ một đáp án; lời giải đủ điều kiện căn/mẫu',()=>{
  assert.equal(domainQuestions.length,4);assert.deepEqual(domainQuestions.map(q=>q.correctId),['except-two','at-least-minus-three','above-one','inside']);
  const actual=[(x:number)=>Number.isFinite((x+1)/(x-2)),(x:number)=>Number.isFinite(Math.sqrt(x+3)),(x:number)=>Number.isFinite(1/Math.sqrt(x-1)),(x:number)=>Number.isFinite(1/Math.sqrt(4-x*x))];
  const expected=[(x:number)=>x!==2,(x:number)=>x>=-3,(x:number)=>x>1,(x:number)=>-2<x&&x<2];
  const points=[-100,-4,-3.001,-3,-2.999,-2.001,-2,-1.999,-1,0,0.999,1,1.001,1.999,2,2.001,3,100];
  for(let i=0;i<4;i++){
    const q=domainQuestions[i];assert.equal(new Set(q.choices.map(c=>c.id)).size,3);assert.equal(q.choices.filter(c=>c.id===q.correctId).length,1);
    assert.ok(q.choices.every(c=>c.reason.length>30));assert.ok(q.solution.length>=3);
    for(const x of points)assert.equal(actual[i](x),expected[i](x),q.id+' tại x='+x);
  }
  assert.match(domainQuestions[1].solution.join(' '),/x ≥ −3/);assert.match(domainQuestions[2].solution.join(' '),/x − 1 > 0/);assert.match(domainQuestions[3].solution.join(' '),/\|x\| < 2 ⇔ −2 < x < 2/);
});

test('Mini game: khóa lựa chọn, chống callback cũ, tổng kết, ôn riêng câu sai và kết thúc',()=>{
  const m=mount(file);try{
    m.click('Bắt đầu soi 4 điều kiện');assert.equal(m.focused.type,'h4');
    const chooseOld=all(m.tree,n=>n.type==='button'&&n.props['aria-pressed']!==undefined)[0].props.onClick;
    m.click(label(domainQuestions[0],false));assert.equal(m.focused.type,'div');
    const fb=all(m.tree,n=>n.props['aria-label']==='Giải thích điều kiện đã chọn')[0];
    for(const id of fb.props['aria-describedby'].split(' '))assert.equal(all(fb,n=>n.props.id===id).length,1);
    assert.ok(all(m.tree,n=>n.type==='button'&&n.props['aria-pressed']!==undefined).every(n=>n.props.disabled));
    assert.equal(all(m.tree,n=>n.type==='li').length,3);
    const nextOld=all(m.tree,n=>n.type==='button'&&text(n)==='Điều kiện tiếp theo')[0].props.onClick;
    m.click('Điều kiện tiếp theo');chooseOld();nextOld();m.draw();assert.match(text(m.tree),/Câu 2\/4/);assert.doesNotMatch(text(m.tree),/Đúng rồi/);
    for(let i=1;i<4;i++){m.click(label(domainQuestions[i]));m.click(i===3?'Xem tổng kết điều kiện':'Điều kiện tiếp theo');}
    assert.match(text(m.tree),/Em chọn đúng 3\/4/);assert.equal(all(m.tree,n=>n.type==='details').length,4);
    m.click('Ôn riêng điều kiện đã chọn sai');assert.match(text(m.tree),/Ôn lại · Câu 1\/1/);
    chooseOld();m.draw();assert.equal(all(m.tree,n=>n.props['aria-label']==='Giải thích điều kiện đã chọn').length,0);
    m.click(label(domainQuestions[0]));m.click('Xem tổng kết điều kiện');assert.match(text(m.tree),/Em chọn đúng 1\/1/);assert.doesNotMatch(text(m.tree),/Ôn riêng điều kiện/);
    m.click('Luyện lại cả 4 câu');assert.match(text(m.tree),/Câu 1\/4/);m.click('Dừng soi điều kiện');assert.equal(m.focused.type,'h3');
    m.click('Bắt đầu soi 4 điều kiện');for(let i=0;i<4;i++){m.click(label(domainQuestions[i]));m.click(i===3?'Xem tổng kết điều kiện':'Điều kiện tiếp theo');}
    assert.match(text(m.tree),/Em chọn đúng 4\/4/);m.click('Kết thúc soi điều kiện');assert.equal(m.focused.type,'h3');
  }finally{m.unmount();}
});

test('SSR, RAM và tải lười: không điểm/mạng/timer, riêng nguồn, key theo chương và CSS riêng',()=>{
  const html=require('react-dom/server').renderToStaticMarkup(React.createElement(load(file).default));
  assert.match(html,/đã học căn bậc hai/);assert.match(html,/MTM sưu tầm và biên soạn/);assert.match(html,/không tính điểm thi hoặc xếp hạng/);
  const code=readFileSync(join(root,file),'utf8');assert.doesNotMatch(code,/fetch\(|localStorage|sessionStorage|setInterval|setTimeout/);
  assert.match(readFileSync(join(root,'src/native/chapters/PracticeLibrary.tsx'),'utf8'),/key=\{'domain:'\+selected.id\+':'\+chapter.id\}/);
  assert.match(readFileSync(join(root,'src/native/chapters/domain-check.css'),'utf8'),/min-height:48px/);
});

test('Nhãn hết hạn: trước, bằng, sau deadline; vẫn giữ href và thời hạn thật',()=>{
  const items=[{id:'synthetic',title:'Bài tổng hợp giả',href:'/luyen-tap?nhom=10&chuong=1&id=synthetic',updatedAt:1000,deadline:2000}],before=JSON.stringify(items);
  const m=mount('src/native/chapters/PracticeSavedWork.tsx',{items,incomplete:false,snapshotAt:1999},'PracticeResume');try{
    assert.match(text(m.tree),/Chưa hết hạn tại lần đọc danh sách/);
    for(const snapshotAt of [2000,2001]){m.draw({items,incomplete:false,snapshotAt});assert.match(text(m.tree),/Đã hết thời gian làm bài/);assert.doesNotMatch(text(m.tree),/Chưa hết hạn tại/);}
    assert.equal(all(m.tree,n=>n.type?.name==='Link')[0].props.href,items[0].href);assert.equal(JSON.stringify(items),before);
  }finally{m.unmount();}
});

// Chỉ thay bộ nạp ngân hàng bằng một đề tổng hợp; dùng readDraft/readHistory và validator thật.
// Không tạo window hoặc đọc bộ nhớ trình duyệt: local-store được thay bằng FakeStore RAM ở require.
test('Đọc lại: RAM đổi từ tab khác, lịch sử và bản dở cập nhật, không ghi/xóa; lỗi đọc lần 2 có cảnh báo',()=>{
  const exam:PracticeExam={id:'mtm-custom-synthetic-refresh',title:'Đề tổng hợp GIẢ',versionHash:'a'.repeat(64),sourceHash:'b'.repeat(64),rubricVersion:'MTM-FLEX-10-v1',grade:10,period:'GK1',durationMinutes:10,
    sourceRef:'Dữ liệu tổng hợp GIẢ',sourceUrl:'https://source.invalid/synthetic',sourceMaterial:{title:'Đề GIẢ',publisher:'Kiểm thử local',version:'fake-v1',locator:'1 câu GIẢ'},publicationVerified:true,questionDisplayVerified:true,answerKeyVerified:true,rubricVerified:true,questionCount:1,
    sections:[{label:'I',kind:'mc',count:1}],questions:[{id:'q',kind:'mc',text:'1 + 1 bằng mấy?',sourceRef:'Câu tổng hợp GIẢ',choices:['1','2','3','4'],answer:'B',maxMillipoints:10000}]};
  const validated=validatePracticeExam(exam);assert.equal(validated.valid,true,validated.errors.join('; '));
  const item={exam,track:'10',chapter:'1',order:1,coverage:'Bài tổng hợp',limits:[]};
  const fixture={readItems:()=>[item],chapterIds:()=>[exam.id],metadata:{[exam.id]:{archived:false}},sequences:{},sequenceNumber:new Map()};
  const source=readFileSync(join(root,'src/native/chapters/PracticeShelf.tsx'),'utf8').replace("from './practice-loader'","from '__fixture-loader'").replace("from '../exams/local-store'","from '__fixture-store'");
  const code=require('esbuild').buildSync({stdin:{contents:source,sourcefile:'PracticeShelf.tsx',resolveDir:join(root,'src/native/chapters'),loader:'tsx'},bundle:true,write:false,platform:'node',format:'cjs',jsx:'automatic',packages:'external',external:['__fixture-loader','__fixture-store'],loader:{'.css':'empty'},logLevel:'silent'}).outputFiles[0].text;
  const storage=new FakeStore();let state:any,tree:any,scope='1';
  const mod={exports:{} as any};
  new Function('require','module','exports',code)((id:string)=>id==='react'?{...React,useState:(initial:any)=>{state??=initial;return[state,(next:any)=>state=typeof next==='function'?next(state):next];}}:id==='__fixture-loader'?fixture:id==='__fixture-store'?{localStore:()=>storage}:id.endsWith('.css')?{}:require(id),mod,mod.exports);
  const draw=()=>tree=mod.exports.ChapterShelf({selected:{id:'10'},chapter:{id:scope}});
  const resume=()=>all(tree,n=>n.type?.name==='PracticeResume')[0].props;
  const history=()=>all(tree,n=>n.type?.name==='PracticeHistory')[0].props;
  const click=()=>{all(tree,n=>n.type==='button'&&text(n)==='Đọc lại bài đã lưu')[0].props.onClick();draw();};
  const made=createDraft(exam,'fixture-attempt',1000);assert.ok(made.ok);if(!made.ok)throw Error('fixture');
  draw();assert.equal(resume().items.length,0);assert.equal(history().items.length,0);
  storage.data.set(draftKey(exam.id),JSON.stringify(made.value));click();assert.equal(resume().items.length,1);assert.match(text(tree),/lần 1/);assert.equal(history().items.length,0);
  storage.data.set(draftKey(exam.id),JSON.stringify({...made.value,submittedAt:2000,updatedAt:2000}));click();assert.equal(resume().items.length,0);assert.equal(history().items.length,1);assert.match(text(tree),/lần 2/);assert.ok(history().items[0].href.endsWith('luot=fixture-attempt'));
  storage.data.set(draftKey(exam.id),'{broken');const before=storage.snapshot();click();assert.equal(resume().incomplete,true);assert.ok(history().messages.length);assert.equal(storage.snapshot(),before);
  // readHistory đọc thành công; riêng lần đọc draft kế tiếp lỗi. Không làm mất cảnh báo.
  storage.data.set(draftKey(exam.id),JSON.stringify(made.value));let draftGets=0;
  storage.getHook=(key,value)=>{if(key===draftKey(exam.id)&&++draftGets===2)throw Error('read second');return value;};click();assert.equal(resume().incomplete,true);assert.equal(history().messages.length,0);
  storage.getHook=null;click();assert.equal(resume().incomplete,false);assert.equal(resume().items.length,1);assert.equal(storage.sets,0);
  const selected=all(tree,n=>n.type?.name==='PracticeHistory')[0];assert.equal(selected.key,'history:10:1');
  scope='2';draw();assert.doesNotMatch(text(tree),/Đã đọc lại phần lưu truy cập được/);
});
finish({note:'Dữ liệu tổng hợp RAM, kiểm hook và SSR; chưa thay QA browser hoặc chứng minh toàn miền bằng vét số.'});

// Đề và bộ nhớ tổng hợp. Kiểm component thật qua cây JSX, không coi là QA trình duyệt.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {join} from 'node:path';
import {readFileSync} from 'node:fs';
import {canonicalNumeric,canonicalRational} from '../src/native/exams/assessment';
import {shortInterpretationMessage} from '../src/native/exams/attempt-ui';
import {examSections} from '../src/native/exams/flexible-profile';
import {createDraft} from '../src/native/exams/store';
import {syntheticExam} from './fixtures/de-tong-hop.mts';
import {FakeStore,suite} from './exams-harness.mts';

const {test,finish}=suite('SHORT-READ');
const root=process.env.MTM_ROOT!,require=createRequire(join(root,'package.json')),{buildSync}=require('esbuild');
const fixture=join(root,'tests/fixtures/room-react.mts');
function load(file:string){
  const output=buildSync({stdin:{contents:`export {default} from './${file}'; export {RoomQuestionContext} from './src/native/exams/RoomQuestionContext';`,resolveDir:root,loader:'tsx'},bundle:true,write:false,platform:'node',format:'cjs',jsx:'automatic',packages:'external',alias:{react:fixture,'react/jsx-runtime':fixture,'react-dom':fixture},loader:{'.css':'empty'},logLevel:'silent'});
  const module={exports:{} as any};new Function('require','module','exports',output.outputFiles[0].text)((id:string)=>id.endsWith('.css')?{}:require(id),module,module.exports);return module.exports;
}
const FocusRoom=load('src/native/exams/FocusRoom.tsx').default,AnswerSheet=load('src/native/exams/AttemptAnswerSheet.tsx').default,Retry=load('src/native/homework/HomeworkRetry.tsx').default;
const SourceContent=load('src/native/exams/MtmSourceContent.tsx'),SourceQuestion=load('src/native/exams/MtmSourceQuestion.tsx');
class Runtime{
  slots:any[]=[];index=0;
  state(initial:any){const i=this.index++;if(!(i in this.slots))this.slots[i]=typeof initial==='function'?initial():initial;return[this.slots[i],(value:any)=>{this.slots[i]=typeof value==='function'?value(this.slots[i]):value;}];}
  ref(value:any){const i=this.index++;return this.slots[i]??(this.slots[i]={current:value});}
  effect(){this.index++;}
  draw(fn:()=>any){(globalThis as any).__mtmRoomRuntime=this;this.index=0;return fn();}
}
const all=(tree:any,predicate:(node:any)=>boolean):any[]=>!tree||typeof tree!=='object'?[]:Array.isArray(tree)?tree.flatMap(node=>all(node,predicate)):[...(predicate(tree)?[tree]:[]),...all(tree.props?.children,predicate)];
const find=(tree:any,predicate:(node:any)=>boolean)=>all(tree,predicate)[0];
const text=(tree:any):string=>tree==null||typeof tree==='boolean'?'':Array.isArray(tree)?tree.map(text).join(''):typeof tree==='object'?text(tree.props?.children):String(tree);
const exam=syntheticExam(),index=exam.questions.findIndex(q=>q.kind==='short'),question=exam.questions[index];question.solution='Lời giải giả dùng kiểm thử.';
const made=createDraft(exam,'short-read-fixture',1000);assert.ok(made.ok);const draft=made.value;
const storage=new FakeStore(),calls:any[]=[];
const state:any={draft,activeQuestion:index,setActiveQuestion(){},setQuestionFocus(){},seconds:5400,answered:0,states:exam.questions.map(()=> 'blank'),unsaved:false,notice:'',changeAnswer(...args:any[]){calls.push(args);},pdfReady:true,setPdfReady(){},finish(){},confirmation:null,sections:examSections(exam),failedQuestions:new Set()};
const props:any={exam,catalogUrl:'/luyen-tap',storeOverride:storage};
const globals=new Map(['document','window','__mtmRoomRuntime'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
Object.assign(globalThis,{document:{body:{}}});

try{
  test('Khóa cách chuẩn hóa hiện tại, không đổi điểm qua cách viết dấu hàng nghìn',()=>{
    for(const [input,want] of [['1.000','1'],['1,000','1'],['2.025','2.025'],['10.000','10'],['-0.000','0'],['9007199254740993.005','9007199254740993.005']] as const)assert.equal(canonicalNumeric(input),want,input);
    assert.equal(canonicalRational('1.000'),'1/1');assert.equal(canonicalRational('2.025'),'81/40');assert.equal(canonicalNumeric('1.000,5'),null);assert.equal(canonicalNumeric('1 000'),null);
  });
  test('Thông báo nói đúng số máy hiểu, giữ nguyên độ chính xác và giải thích dấu thập phân',()=>{
    for(const input of ['1.000','1,000']){assert.match(shortInterpretationMessage('numeric',input),/^Máy đang hiểu là 1\./);assert.match(shortInterpretationMessage('rational',input),/^Máy đang hiểu là 1\./);}
    assert.match(shortInterpretationMessage('numeric','2.025'),/2,025 \(số thập phân\)/);
    assert.match(shortInterpretationMessage('numeric','2.025'),/không tách hàng nghìn/);
    assert.match(shortInterpretationMessage('rational','2.025'),/81\/40 \(số thập phân 2,025\)/);
    assert.match(shortInterpretationMessage('rational','2/4'),/^Máy đang hiểu là 1\/2\./);
    assert.match(shortInterpretationMessage('numeric','9007199254740993.005'),/9007199254740993,005/);
    for(const [mode,value] of [['numeric','12'],['numeric','1,5'],['numeric',' 1,5 '],['numeric','-2,75'],['numeric','1/2'],['rational','1/0'],['rational','1/2'],['exact','1.000'],['numeric',''],['numeric',null],['numeric',[true]]])assert.equal(shortInterpretationMessage(mode as string,value),'');
  });
  test('Phòng tập trung và phiếu cạnh ô có mô tả máy hiểu, không thay chuỗi đang nhập',()=>{
    const runtime=new Runtime();
    for(const value of ['1.000','1,000','2.025']){
      (draft.answers as Record<string,string>)[question.id]=value;
      for(const [render,inputId,messageId] of [[()=>FocusRoom({props,state,onExit(){}}),'fr-quick-short','fr-quick-interpretation'],[()=>AnswerSheet({props,state}),`ep-short-${index}`,`ep-interpretation-${index}`]] as const){
        const tree=runtime.draw(render),input=find(tree,n=>n.props?.id===inputId),message=find(tree,n=>n.props?.id===messageId);
        const feedback=find(tree,n=>n.props?.className==='ep-short-feedback');
        assert.equal(input.props.value,value);assert.ok(input.props['aria-describedby'].split(' ').includes(messageId));assert.equal(feedback.props['aria-live'],'polite');assert.equal(feedback.props['aria-atomic'],'true');assert.equal(all(feedback,n=>n.props?.['aria-live']).length,1);assert.equal(message.props['aria-live'],undefined);assert.match(message.props.className,/ep-short-interpretation is-ambiguous/);assert.equal(text(message),shortInterpretationMessage('numeric',value));
        input.props.onChange({target:{value}});assert.deepEqual(calls.pop(),[question.id,value]);assert.equal(draft.answers[question.id],value);
      }
    }
  });
  test('Ô số Việt đúng không báo nhắc, sai định dạng vẫn đọc một vùng phản hồi',()=>{
    for(const value of ['1,5','1/2']){
      (draft.answers as Record<string,string>)[question.id]=value;
      for(const render of [()=>FocusRoom({props,state,onExit(){}}),()=>AnswerSheet({props,state})]){
        const tree=new Runtime().draw(render),feedback=find(tree,n=>n.props?.className==='ep-short-feedback'),input=find(tree,n=>n.type==='input'&&n.props?.className==='ep-short');
        assert.equal(all(feedback,n=>n.props?.['aria-live']).length,1);assert.equal(input.props.value,value);
        assert.equal(text(find(feedback,n=>n.props?.className?.includes('ep-short-interpretation'))),'');
        if(value==='1,5'){assert.equal(text(feedback),'');assert.equal(input.props['aria-invalid'],undefined);}
        else{assert.match(text(feedback),/Chưa đúng định dạng/);assert.equal(input.props['aria-invalid'],true);}
      }
    }
  });
  test('Phiếu trả lời khóa đúng câu có ảnh lỗi, mở lại câu khác và không khóa nút nộp',()=>{
    const runtime=new Runtime();state.failedQuestions.add(question.id);
    let tree=runtime.draw(()=>AnswerSheet({props,state}));assert.equal(find(tree,n=>n.props?.id===`ep-short-${index}`).props.disabled,true);assert.equal(find(tree,n=>n.type==='button'&&text(n)==='Nộp bài').props.disabled,false);
    state.failedQuestions.clear();tree=runtime.draw(()=>AnswerSheet({props,state}));assert.equal(find(tree,n=>n.props?.id===`ep-short-${index}`).props.disabled,false);
    for(const kind of ['mc','tf']){state.activeQuestion=exam.questions.findIndex(q=>q.kind===kind);state.failedQuestions.add(exam.questions[state.activeQuestion].id);tree=runtime.draw(()=>AnswerSheet({props,state}));assert.ok(all(tree,n=>n.type==='fieldset').every(n=>n.props.disabled===true));state.failedQuestions.clear();}
    state.activeQuestion=index;
  });
  test('Ô ôn BTVN giải thích giá trị ngay sau gõ, không sửa bản nộp hoặc biên nhận',()=>{
    const submitted={...draft,submittedAt:2000,updatedAt:2000,answers:{[question.id]:'1.000'}},homework={exam,draft:submitted,solutionsAvailable:true,receipts:[{attemptId:draft.attemptId,submittedAt:2000,score:0}]};
    const before=JSON.stringify(homework),parent=new Runtime();let tree=parent.draw(()=>Retry({state:homework}));find(tree,n=>n.type==='button'&&text(n)==='Ôn một câu của lượt này').props.onClick();tree=parent.draw(()=>Retry({state:homework}));
    const exercise=find(tree,n=>typeof n.type==='function'&&n.type.name==='RetryExercise');assert.ok(exercise);const child=new Runtime();let answerTree=child.draw(()=>exercise.type(exercise.props));find(answerTree,n=>n.type==='input').props.onChange({target:{value:'1.000'}});answerTree=child.draw(()=>exercise.type(exercise.props));
    const input=find(answerTree,n=>n.type==='input'),message=find(answerTree,n=>n.props?.id?.endsWith('-interpretation'));assert.equal(input.props.value,'1.000');assert.ok(input.props['aria-describedby'].includes(message.props.id));assert.match(text(message),/^Máy đang hiểu là 1\./);assert.equal(JSON.stringify(homework),before);
  });
  test('Lỗi lưu máy chủ có vùng trạng thái riêng, lý do và nút sibling, không lặp alert',()=>{
    const runtime=new Runtime();let retries=0,accepts=0;const remoteProps={...props,isHomework:true,saveStatus:'Mạng thử bị ngắt. Bài đang giữ trên trang.',onRetrySave(){retries++;},onAcceptClosed(){accepts++;}};
    const tree=runtime.draw(()=>FocusRoom({props:remoteProps,state:{...state,notice:remoteProps.saveStatus},onExit(){}})),region=find(tree,n=>n.props?.className==='fr-save-status is-error');assert.ok(region);
    assert.match(text(find(region,n=>n.props?.role==='status')),/Mạng thử bị ngắt/);assert.equal(find(region,n=>n.props?.role==='status').props['aria-live'],'polite');assert.equal(all(tree,n=>n.props?.role==='alert').length,0);
    const buttons=all(region,n=>n.type==='button');assert.equal(buttons.length,2);buttons.forEach(button=>button.props.onClick());assert.equal(retries,1);assert.equal(accepts,1);assert.equal(all(find(tree,n=>n.props?.className==='fr-warning'),n=>n.type==='button').length,0);
    assert.ok(!find(new Runtime().draw(()=>FocusRoom({props,state,onExit(){}})),n=>n.props?.className?.includes('fr-save-status')));
  });
  test('Đang chờ lưu vẫn hiển thị trạng thái trong portal, không tạo nút gửi lại giả',()=>{
    const remoteProps={...props,isHomework:true,savePending:true,saveStatus:'Chờ máy chủ lưu. Bài đang giữ trên trang.'};
    const tree=new Runtime().draw(()=>FocusRoom({props:remoteProps,state:{...state,notice:remoteProps.saveStatus},onExit(){}})),region=find(tree,n=>n.props?.className==='fr-save-status');
    assert.ok(region);assert.equal(text(find(region,n=>n.props?.role==='status')),remoteProps.saveStatus);assert.equal(all(region,n=>n.type==='button').length,0);assert.equal(all(tree,n=>n.props?.className==='fr-notice').length,0);
  });
  test('Ảnh câu đang mở tải eager, nút thử lại thật xóa lỗi và phát một yêu cầu gia hạn',()=>{
    let renewals=0;Object.assign(globalThis,{window:{dispatchEvent(event:Event){assert.equal(event.type,'mtm:retry-assets');renewals++;}}});
    const segment={path:'fake.png',sha256:'a'.repeat(64),width:100,height:100,sourcePage:1,privateUrl:'https://storage.invalid/old'},runtime=new Runtime();
    const render=()=>runtime.draw(()=>SourceContent.default({segments:[segment],assetBase:'/fake',label:'Đề giả',kind:'question'}));
    SourceContent.RoomQuestionContext.value=null;let tree=render();assert.equal(find(tree,n=>n.props?.src===segment.privateUrl).props.loading,'lazy');
    SourceContent.RoomQuestionContext.value=0;tree=render();const image=find(tree,n=>n.props?.src===segment.privateUrl);assert.equal(image.props.loading,'eager');image.props.onError();
    tree=render();const alert=find(tree,n=>n.props?.role==='alert');assert.equal(alert.props.className,'mtm-source-error');find(alert,n=>n.type==='button').props.onClick();
    tree=render();assert.equal(renewals,1);assert.ok(!find(tree,n=>n.props?.role==='alert'));assert.equal(find(tree,n=>n.props?.src===segment.privateUrl).props.loading,'eager');SourceContent.RoomQuestionContext.value=null;
  });
  test('Hình chép lại trong phòng tải eager và nút thử lại khôi phục hình sau lỗi',()=>{
    const entries=JSON.parse(readFileSync(join(root,'src/native/chapters/exact-source-display.json'),'utf8')),entry=entries.find((row:any)=>row.figureRef&&!row.questionTables?.length);assert.ok(entry);
    const question={id:entry.questionId,sourceRef:'Đề giả',sourceContent:{questions:[{path:'fake.png',sha256:entry.sourceDisplayCropSha256,width:100,height:100,sourcePage:1}]}},runtime=new Runtime();
    SourceQuestion.RoomQuestionContext.value=0;const render=()=>runtime.draw(()=>SourceQuestion.default({question}));
    let tree=render(),image=find(tree,n=>n.props?.src===`/practice-media/source-crops/${entry.figureRef.path}`);assert.ok(image);assert.equal(image.props.loading,'eager');image.props.onError();tree=render();
    const alert=find(tree,n=>n.props?.role==='alert');assert.equal(alert.props.className,'mtm-source-error');find(alert,n=>n.type==='button').props.onClick();tree=render();assert.ok(find(tree,n=>n.props?.src===image.props.src));assert.ok(!find(tree,n=>n.props?.role==='alert'));SourceQuestion.RoomQuestionContext.value=null;
  });
}finally{for(const [key,descriptor] of globals){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete (globalThis as any)[key];}}
finish({environment:'Component thật qua cây JSX tổng hợp, không phải trình duyệt'});

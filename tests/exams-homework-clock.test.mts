// Chạy hook thật bằng runtime tổng hợp và đồng hồ giả. Không phải QA trình duyệt.
// Dữ liệu đề, lượt làm và bộ nhớ đều tổng hợp, không có thông tin học sinh.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {join} from 'node:path';
import type {PracticeExam} from '../src/native/exams/data';
import type {PracticeAttemptProps} from '../src/native/exams/attempt-types';
import {createDraft,saveDraft,readDraft,draftKey,type Draft} from '../src/native/exams/store';
import {syntheticExam} from './fixtures/de-tong-hop.mts';
import {FakeStore,suite} from './exams-harness.mts';

const root=process.env.MTM_ROOT!,require=createRequire(join(root,'package.json')),{build}=require('esbuild');
const fixture=join(root,'tests/fixtures/attempt-react.mts');
let localScoreCalls=0;
// Chỉ thay dependency chấm bằng bẫy. Mã hook, effect và bộ ghi bản nháp là mã thật.
const output=await build({entryPoints:[join(root,'src/native/exams/usePracticeAttempt.ts')],bundle:true,write:false,platform:'node',format:'cjs',jsx:'automatic',packages:'external',alias:{react:fixture,'react/jsx-runtime':fixture},logLevel:'silent',plugins:[{
  name:'btvn-local-score-trap',setup(builder:any){builder.onLoad({filter:/[/\\]src[/\\]native[/\\]exams[/\\]result\.ts$/},()=>({contents:'export function resultFor(){globalThis.__mtmLocalScoreTrap();throw new Error("Client score trap");}',loader:'ts'}));},
}]});
const module={exports:{} as any};new Function('require','module','exports',output.outputFiles[0].text)(require,module,module.exports);
const {usePracticeAttempt}=module.exports;
const T0=Date.UTC(2026,9,16,1),originalNow=Date.now;let clock=T0;
const options={allowQuestionOnly:true};
const must=<T,>(result:{ok:true;value:T}|{ok:false;message:string}):T=>{if(!result.ok)throw Error(result.message);return result.value;};
class Events extends EventTarget {removeEventListener(type:string,listener:any,options?:boolean|EventListenerOptions){super.removeEventListener(type,listener,typeof options==='boolean'?{capture:options}:options);}}
const windows=new Events(),documents=new Events(),intervals=new Map<number,()=>void>();let serial=0;
const savedGlobals=new Map(['window','document','location','history','clearInterval','__mtmHookRuntime','__mtmLocalScoreTrap'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
Object.assign(globalThis,{window:Object.assign(windows,{setInterval(fn:()=>void){intervals.set(++serial,fn);return serial;}}),document:Object.assign(documents,{getElementById:()=>null,querySelector:()=>null}),location:new URL('https://mtm.test/btvn/lop-gia/buoi-gia'),history:{pushState(){}},clearInterval(id:number){intervals.delete(id);},__mtmLocalScoreTrap(){localScoreCalls++;}});
Date.now=()=>clock;
class Runtime {
  slots:any[]=[];index=0;changed=false;effects:(()=>void)[]=[];value:any;
  constructor(public fn:()=>any){}
  state(initial:any){const i=this.index++;if(!this.slots[i])this.slots[i]={value:typeof initial==='function'?initial():initial};return[this.slots[i].value,(value:any)=>{const next=typeof value==='function'?value(this.slots[i].value):value;if(!Object.is(next,this.slots[i].value)){this.slots[i].value=next;this.changed=true;}}];}
  ref(value:any){const i=this.index++;return this.slots[i]??(this.slots[i]={current:value});}
  same(a:any,b:any){return a&&b&&a.length===b.length&&a.every((value:any,i:number)=>Object.is(value,b[i]));}
  memo(value:any,deps:any){const i=this.index++;if(!this.slots[i]||!this.same(this.slots[i].deps,deps))this.slots[i]={value,deps};return this.slots[i].value;}
  effect(fn:any,deps:any){const i=this.index++,old=this.slots[i];if(!old||!this.same(old.deps,deps)){this.slots[i]={deps,cleanup:old?.cleanup};this.effects.push(()=>{old?.cleanup?.();this.slots[i].cleanup=fn();});}}
  flush(){for(let round=0;round<30;round++){(globalThis as any).__mtmHookRuntime=this;this.index=0;this.changed=false;this.value=this.fn();this.effects.splice(0).forEach(fn=>fn());if(!this.changed)return this.value;}throw Error('Hook không ổn định');}
  dispose(){this.slots.forEach(slot=>slot?.cleanup?.());}
}
function publicExam():PracticeExam {
  return {
    id:'mtm-practice-homework-hook-fixture',responseMode:'questions-only',title:'Bài tập giả kiểm thử hook',grade:10,period:'GK1',durationMinutes:30,
    sourceHash:'a'.repeat(64),versionHash:'b'.repeat(64),sourceRef:'Nguồn giả kiểm thử',questionCount:4,
    answerKeyVerified:true,rubricVerified:true,rubricVersion:'MTM-BTVN-10-v1',publicationVerified:true,questionDisplayVerified:true,
    sourceUrl:'https://www.minhthanhmath.vn/luyen-tap',sourceMaterial:{title:'Nguồn giả',publisher:'MTM test',version:'fixture v1',locator:'Kiểm thử'},
    sections:[{label:'Trắc nghiệm',kind:'mc',count:1},{label:'Đúng sai',kind:'tf',count:1},{label:'Trả lời ngắn',kind:'short',count:1},{label:'Tự đối chiếu',kind:'self',count:1}],
    questions:[
      {id:'mc-1',kind:'mc',sourceRef:'Nguồn giả 1',maxMillipoints:1000,prompt:'Câu trắc nghiệm giả.',choices:['Một','Hai','Ba','Bốn']},
      {id:'tf-1',kind:'tf',sourceRef:'Nguồn giả 2',maxMillipoints:1000,prompt:'Câu đúng sai giả.',statements:['Ý a','Ý b','Ý c','Ý d'],pointsByCorrectCount:[0,100,250,500,1000]},
      {id:'short-1',kind:'short',sourceRef:'Nguồn giả 3',maxMillipoints:1000,prompt:'Câu ngắn giả.',mode:'numeric'},
      {id:'self-1',kind:'self',sourceRef:'Nguồn giả 4',maxMillipoints:0,prompt:'Câu tự đối chiếu giả.'},
    ],
  } as unknown as PracticeExam;
}
function mount(storage:FakeStore,extra:Partial<PracticeAttemptProps>={},exam=publicExam()){
  const props:PracticeAttemptProps={exam,catalogUrl:'/btvn/lop-gia/buoi-gia',storeOverride:storage,isHomework:true,...extra};
  const runtime=new Runtime(()=>usePracticeAttempt(props));runtime.flush();return {runtime,props};
}
function tick(runtime:Runtime){for(const fn of [...intervals.values()])fn();return runtime.flush();}
function persisted(storage:FakeStore,exam:PracticeExam){return must(readDraft(storage,exam,options))!;}
function seed(storage:FakeStore,exam:PracticeExam,startedAt=T0,answers:Draft['answers']={}){
  const draft={...must(createDraft(exam,'synthetic-homework-attempt',startedAt,options)),answers};return must(saveDraft(storage,exam,draft,null,options));
}
const {test,finish}=suite('BTVN-CLOCK');

try {
  test('Question-only tiếp tục lượt máy chủ, sửa đủ kiểu và nộp mà không gọi chấm client',()=>{
    clock=T0;const exam=publicExam(),storage=new FakeStore(),old=seed(storage,exam,T0-60000,{'mc-1':'A'}),{runtime}=mount(storage,{},exam);
    try{
      assert.equal(runtime.value.draft,null);assert.equal(runtime.value.startLabel,'Tiếp tục làm bài');runtime.value.begin();runtime.flush();
      assert.equal(runtime.value.draft.attemptId,old.attemptId);assert.equal(runtime.value.draft.deadline,old.deadline);assert.equal(runtime.value.draft.answers['mc-1'],'A');
      for(const [id,answer] of [['mc-1','C'],['tf-1',[true,false,true,false]],['short-1','-0,25'],['self-1','Đã tự làm']] as const){clock+=100;runtime.value.changeAnswer(id,answer);runtime.flush();}
      assert.deepEqual(persisted(storage,exam).answers,{'mc-1':'C','tf-1':[true,false,true,false],'short-1':'-0,25','self-1':'Đã tự làm'});
      assert.equal(runtime.value.answered,3);runtime.value.finish(false);runtime.flush();assert.equal(runtime.value.submitted,true);assert.equal(runtime.value.score,undefined);assert.equal(localScoreCalls,0);
      const bytes=storage.getItem(draftKey(exam.id));runtime.value.changeAnswer('mc-1','D');runtime.value.finish(true);runtime.flush();assert.equal(storage.getItem(draftKey(exam.id)),bytes);
    }finally{runtime.dispose();}
    const reload=mount(storage,{},exam);try{assert.equal(reload.runtime.value.submitted,true);assert.equal(reload.runtime.value.score,undefined);assert.equal(localScoreCalls,0);}finally{reload.runtime.dispose();}
  });

  test('Nộp thiếu câu có xác nhận và không giả lập điểm',()=>{
    clock=T0;const storage=new FakeStore(),{runtime}=mount(storage);
    try{runtime.value.begin();runtime.flush();runtime.value.changeAnswer('mc-1','B');runtime.flush();runtime.value.finish(false);runtime.flush();assert.equal(runtime.value.confirmation,'submit');assert.equal(runtime.value.submitted,false);runtime.value.finish(false,true);runtime.flush();assert.equal(runtime.value.submitted,true);assert.equal(runtime.value.score,undefined);assert.equal(localScoreCalls,0);}finally{runtime.dispose();}
  });

  test('Đóng tháng dùng đồng hồ máy chủ khi máy khách chậm hoặc nhanh, tự nộp đúng hạn một lần',()=>{
    for(const offset of [15*60000,-15*60000]){
      clock=T0;const exam=publicExam(),storage=new FakeStore(),serverNow=T0+offset,close=serverNow+10000;seed(storage,exam,serverNow-60000);
      const {runtime}=mount(storage,{deadlineAt:close,clockOffsetMs:offset},exam);
      try{
        runtime.value.begin();runtime.flush();assert.equal(runtime.value.seconds,10);assert.ok(runtime.value.draft.deadline>close);
        clock=T0+9000;tick(runtime);assert.equal(runtime.value.seconds,1);assert.equal(runtime.value.submitted,false);
        clock=T0+10000;tick(runtime);assert.equal(runtime.value.submitted,true);assert.equal(runtime.value.draft.submittedAt,close);assert.equal(runtime.value.seconds,0);
        const bytes=storage.getItem(draftKey(exam.id)),writes=storage.sets;clock+=3000;tick(runtime);runtime.value.finish(true);runtime.flush();assert.equal(storage.getItem(draftKey(exam.id)),bytes);assert.equal(storage.sets,writes);assert.equal(localScoreCalls,0);
      }finally{runtime.dispose();}
    }
  });

  test('Tại hạn đóng tháng, đổi đáp án trước tick bị chặn và nộp giữ bản trước đó',()=>{
    clock=T0;const offset=4*60000,exam=publicExam(),storage=new FakeStore(),close=T0+offset+5000;seed(storage,exam,T0+offset-60000,{'mc-1':'A'});
    const {runtime}=mount(storage,{deadlineAt:close,clockOffsetMs:offset},exam);
    try{
      runtime.value.begin();runtime.flush();clock=T0+4999;runtime.value.changeAnswer('mc-1','B');runtime.flush();assert.equal(runtime.value.submitted,false);assert.equal(persisted(storage,exam).answers['mc-1'],'B');
      clock=T0+5000;runtime.value.changeAnswer('mc-1','D');runtime.flush();assert.equal(runtime.value.submitted,true);assert.equal(runtime.value.draft.submittedAt,close);assert.equal(persisted(storage,exam).answers['mc-1'],'B');assert.equal(runtime.value.score,undefined);
    }finally{runtime.dispose();}
  });

  test('Hạn lượt làm sớm hơn hạn đóng tháng vẫn có hiệu lực',()=>{
    clock=T0;const offset=-60000,serverNow=T0+offset,exam=publicExam(),storage=new FakeStore(),old=seed(storage,exam,serverNow-exam.durationMinutes*60000+5000);
    const {runtime}=mount(storage,{deadlineAt:serverNow+60000,clockOffsetMs:offset},exam);
    try{runtime.value.begin();runtime.flush();assert.equal(runtime.value.seconds,5);clock+=5000;tick(runtime);assert.equal(runtime.value.submitted,true);assert.equal(runtime.value.draft.submittedAt,old.deadline);}finally{runtime.dispose();}
  });

  test('Lượt máy chủ mở lại sau hạn tháng tự nộp ngay khi tiếp tục',()=>{
    clock=T0;const offset=60000,exam=publicExam(),storage=new FakeStore(),serverNow=T0+offset;seed(storage,exam,serverNow-60000,{'mc-1':'B'});
    const {runtime}=mount(storage,{deadlineAt:serverNow-1,clockOffsetMs:offset},exam);
    try{runtime.value.begin();runtime.flush();assert.equal(runtime.value.submitted,true);assert.equal(runtime.value.seconds,0);assert.equal(runtime.value.draft.answers['mc-1'],'B');assert.equal(runtime.value.draft.submittedAt,serverNow);assert.equal(localScoreCalls,0);}finally{runtime.dispose();}
  });

  test('Đổi offset máy chủ khi đang làm cập nhật đếm giờ và khóa ngay khi focus',()=>{
    clock=T0;const exam=publicExam(),storage=new FakeStore();seed(storage,exam,T0-60000);const {runtime,props}=mount(storage,{deadlineAt:T0+20000},exam);
    try{
      runtime.value.begin();runtime.flush();assert.equal(runtime.value.seconds,20);props.clockOffsetMs=15000;runtime.flush();assert.equal(runtime.value.seconds,5);
      clock+=5000;windows.dispatchEvent(new Event('focus'));runtime.flush();assert.equal(runtime.value.submitted,true);assert.equal(runtime.value.draft.submittedAt,T0+20000);assert.equal(localScoreCalls,0);
    }finally{runtime.dispose();}
  });

  test('Cờ homework vẫn bắt buộc: transport chỉ có câu hỏi không mở qua tuyến luyện tập',()=>{
    clock=T0;const exam=publicExam(),storage=new FakeStore();seed(storage,exam);const before=storage.snapshot(),{runtime}=mount(storage,{isHomework:false},exam);
    try{assert.match(runtime.value.notice,/chưa đủ điều kiện/);runtime.value.begin();runtime.flush();assert.equal(runtime.value.draft,null);assert.equal(storage.snapshot(),before);assert.equal(localScoreCalls,0);}finally{runtime.dispose();}
  });

  test('Gia hạn bỏ marker thiếu ảnh mở lại đúng câu mà không cần sự kiện load',()=>{
    clock=T0;const exam=publicExam(),storage=new FakeStore();
    const segment={path:'fake.png',width:100,height:100,sha256:'c'.repeat(64),sourcePage:1,privateUnavailable:true};
    exam.questions[0].sourceContent={questions:[segment]};seed(storage,exam);
    const {runtime,props}=mount(storage,{},exam);
    try{
      runtime.value.begin();runtime.flush();assert.ok(runtime.value.failedQuestions.has('mc-1'));
      runtime.value.changeAnswer('mc-1','A');runtime.flush();assert.equal(runtime.value.draft.answers['mc-1'],undefined);
      runtime.value.setQuestionAssetReady('tf-1',false);runtime.flush();
      const renewed=structuredClone(exam);renewed.questions[0].sourceContent!.questions[0]={...segment,privateUnavailable:undefined,privateUrl:'https://storage.invalid/new'};
      props.exam=renewed;runtime.flush();assert.equal(runtime.value.failedQuestions.has('mc-1'),false);assert.equal(runtime.value.failedQuestions.has('tf-1'),true,'Không xóa lỗi ảnh thật của câu khác');
      runtime.value.changeAnswer('mc-1','B');runtime.flush();assert.equal(runtime.value.draft.answers['mc-1'],'B');
      props.exam=structuredClone(renewed);runtime.flush();assert.equal(runtime.value.failedQuestions.has('tf-1'),true,'Refresh đề không tự nhận ảnh lỗi đã tải');
    }finally{runtime.dispose();}
  });

  test('Đối chứng: bẫy chấm thực sự được gọi ở tuyến luyện tập thông thường',()=>{
    clock=T0;const {runtime}=mount(new FakeStore(),{isHomework:false},syntheticExam());
    try{runtime.value.begin();runtime.flush();runtime.value.finish(true);assert.throws(()=>runtime.flush(),/Client score trap/);assert.equal(localScoreCalls,1);}finally{runtime.dispose();}
  });
}finally{
  Date.now=originalNow;
  for(const [key,descriptor] of savedGlobals){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete (globalThis as any)[key];}
}
finish({environment:'Hook thật, runtime tổng hợp, không phải trình duyệt'});

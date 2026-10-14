import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {join} from 'node:path';
import {PRACTICE_EXAMS} from '../src/native/exams/data';
import {createDraft,saveDraft,draftKey} from '../src/native/exams/store';
import {emptyAux,readAux,writeAux} from '../src/native/exams/room-aux';
import {FakeStore,suite} from './exams-harness.mts';
const root=process.env.MTM_ROOT!,require=createRequire(join(root,'package.json')),{buildSync}=require('esbuild');
const fixture=join(root,'tests/fixtures/room-react.mts');
const code=buildSync({entryPoints:[join(root,'src/native/exams/FocusRoom.tsx')],bundle:true,write:false,platform:'node',format:'cjs',jsx:'automatic',packages:'external',alias:{react:fixture,'react/jsx-runtime':fixture,'react-dom':fixture},loader:{'.css':'empty'},logLevel:'silent'}).outputFiles[0].text;
const mod={exports:{} as any};new Function('require','module','exports',code)((id:string)=>id.endsWith('.css')?{}:require(id),mod,mod.exports);const FocusRoom=mod.exports.default;
class Events extends EventTarget {removeEventListener(t:string,l:any,o?:any){super.removeEventListener(t,l,typeof o==='boolean'?{capture:o}:o);}}
const doc=new Events();Object.assign(doc,{body:{},getElementById:()=>null,documentElement:{style:{overflow:''}},activeElement:null,fullscreenElement:null});
class FakeElement{closest(){return null;}}
Object.assign(globalThis,{document:doc,Element:FakeElement,HTMLElement:FakeElement});
class Runtime{
  slots:any[]=[];index=0;changed=false;effects:(()=>void)[]=[];value:any;
  constructor(public fn:()=>any){}
  state(initial:any){const i=this.index++;if(!this.slots[i])this.slots[i]={value:typeof initial==='function'?initial():initial};return[this.slots[i].value,(v:any)=>{const next=typeof v==='function'?v(this.slots[i].value):v;if(!Object.is(next,this.slots[i].value)){this.slots[i].value=next;this.changed=true;}}];}
  ref(value:any){const i=this.index++;return this.slots[i]??(this.slots[i]={current:value});}
  effect(fn:any,deps:any){const i=this.index++,old=this.slots[i];if(!old||!deps||!old.deps||deps.length!==old.deps.length||deps.some((v:any,j:number)=>!Object.is(v,old.deps[j]))){this.slots[i]={deps,cleanup:old?.cleanup};this.effects.push(()=>{old?.cleanup?.();this.slots[i].cleanup=fn();});}}
  flush(){for(let i=0;i<30;i++){(globalThis as any).__mtmRoomRuntime=this;this.index=0;this.changed=false;this.value=this.fn();this.effects.splice(0).forEach(fn=>fn());if(!this.changed)return this.value;}throw Error('Không ổn định');}
  dispose(){this.slots.forEach(s=>s?.cleanup?.());}
}
const exam=PRACTICE_EXAMS[0];
function mount(store:FakeStore){
  const made=createDraft(exam,'room-test',Date.now());assert.ok(made.ok);saveDraft(store,exam,made.value,null);
  const answers:any[]=[];let exits=0;
  const state:any={draft:made.value,activeQuestion:0,setActiveQuestion(i:number){state.activeQuestion=i;r.changed=true;},setQuestionFocus(){},seconds:5400,answered:0,states:exam.questions.map(()=> 'blank'),unsaved:false,notice:'',changeAnswer(...args:any[]){answers.push(args);},pdfReady:true,setPdfReady(){},finish(){},confirmation:null,sections:[{name:'I',from:0,to:12},{name:'II',from:12,to:16},{name:'III',from:16,to:22}]};
  const r=new Runtime(()=>FocusRoom({props:{exam,catalogUrl:'/thi-thu',storeOverride:store},state,onExit(){exits++;}}));r.flush();return {r,state,answers,get exits(){return exits;}};
}
function buttons(tree:any):any[]{if(!tree||typeof tree!=='object')return[];if(Array.isArray(tree))return tree.flatMap(buttons);return [...(tree.type==='button'?[tree]:[]),...buttons(tree.props?.children)];}
function textOf(tree:any):string{if(tree==null||typeof tree==='boolean')return'';if(Array.isArray(tree))return tree.map(textOf).join('');if(typeof tree==='object')return textOf(tree.props?.children);return String(tree);}
function find(tree:any,predicate:(node:any)=>boolean):any{if(!tree||typeof tree!=='object')return null;if(Array.isArray(tree))return tree.map(t=>find(t,predicate)).find(Boolean);return predicate(tree)?tree:find(tree.props?.children,predicate);}
function press(key:string,target?:any){const e=new Event('keydown',{cancelable:true});Object.assign(e,{key,ctrlKey:false,altKey:false,metaKey:false,isComposing:false});if(target)Object.defineProperty(e,'target',{value:target});doc.dispatchEvent(e);return e;}
const {test,finish}=suite('FR');
test('Mount/reload khôi phục câu 18 trước lưu, không ghi đè thành câu 1',()=>{
  const store=new FakeStore();writeAux(store,'room-test',{...emptyAux(),active:17,marked:[17]});const {r,state}=mount(store);
  assert.equal(state.activeQuestion,17);assert.equal(readAux(store,'room-test',22).active,17);
  press('ArrowRight');r.flush();assert.equal(state.activeQuestion,18);assert.equal(readAux(store,'room-test',22).active,18);r.dispose();
  const reload=mount(store);assert.equal(reload.state.activeQuestion,18);reload.r.dispose();
});
test('Gọi handler bàn phím thật: chọn A, đánh dấu M, phím không bắn khi nhập chữ',()=>{
  const store=new FakeStore(),{r,state,answers}=mount(store);press('A');r.flush();assert.deepEqual(answers,[[exam.questions[0].id,'A']]);press('M');r.flush();assert.deepEqual(readAux(store,'room-test',22).marked,[0]);
  const input=new FakeElement();input.closest=()=>({} as any);for(const key of ['B','M','ArrowRight','?'])assert.equal(press(key,input).defaultPrevented,false);r.flush();assert.equal(answers.length,1);assert.equal(state.activeQuestion,0);assert.deepEqual(readAux(store,'room-test',22).marked,[0]);r.dispose();
});
test('Bấm bảng số nhảy đúng câu, làm dở và đánh dấu giữ riêng nhau',()=>{
  const store=new FakeStore(),{r,state}=mount(store);state.states[12]='partial';r.flush();const entry=buttons(r.value).find(b=>b.props['aria-label']?.includes('Câu 1: làm dở'));assert.ok(entry);entry.props.onClick();r.flush();assert.equal(state.activeQuestion,12);
  press('M');r.flush();assert.ok(buttons(r.value).some(b=>b.props.className?.includes('fr-partial fr-marked')));assert.equal(state.states[12],'partial');r.dispose();
});
test('Kho phụ hỏng vẫn mở, cảnh báo đổi ngưỡng và nút câu chưa xong hoạt động',()=>{
  const store=new FakeStore();store.setItem('mtm:exam-aux:v1:room-test','{');const {r,state}=mount(store);assert.equal(state.activeQuestion,0);state.seconds=300;r.flush();assert.ok(textOf(r.value).includes('Còn 5 phút.'));state.states[1]='answered';buttons(r.value).find(b=>textOf(b)==='Đến câu chưa xong').props.onClick();r.flush();assert.equal(state.activeQuestion,2);r.dispose();
});
test('Handler vuốt: ngang đổi câu, dọc và control nhập không đổi; mở/đóng phiếu',()=>{
  const store=new FakeStore(),{r,state}=mount(store),paper=find(r.value,(n:any)=>n.props?.className==='fr-paper');
  const target=new FakeElement();paper.props.onTouchStart({target,touches:[{clientX:200,clientY:100}]});paper.props.onTouchEnd({changedTouches:[{clientX:100,clientY:104}]});r.flush();assert.equal(state.activeQuestion,1);
  paper.props.onTouchStart({target,touches:[{clientX:200,clientY:100}]});paper.props.onTouchEnd({changedTouches:[{clientX:100,clientY:210}]});r.flush();assert.equal(state.activeQuestion,1);
  target.closest=()=>({} as any);paper.props.onTouchStart({target,touches:[{clientX:200,clientY:100}]});paper.props.onTouchEnd({changedTouches:[{clientX:100,clientY:104}]});r.flush();assert.equal(state.activeQuestion,1);
  buttons(r.value).find(b=>b.props['aria-haspopup']==='dialog').props.onClick();r.flush();assert.ok(find(r.value,(n:any)=>n.props?.className==='fr-sheet is-open'));
  press('Escape');r.flush();assert.ok(!find(r.value,(n:any)=>n.props?.className==='fr-sheet is-open'));r.dispose();
});
test('Hợp đồng Fullscreen API vào/ra và thoát tập trung không ghi lại byte bản nháp',()=>{
  const store=new FakeStore(),mounted=mount(store),{r}=mounted,before=store.getItem(draftKey(exam.id));let enter=0,exit=0;
  const host={requestFullscreen(){enter++;(doc as any).fullscreenElement=host;doc.dispatchEvent(new Event('fullscreenchange'));return Promise.resolve();}};
  (doc as any).exitFullscreen=()=>{exit++;(doc as any).fullscreenElement=null;doc.dispatchEvent(new Event('fullscreenchange'));return Promise.resolve();};
  r.value.props.ref.current=host;buttons(r.value).find(b=>textOf(b)==='Toàn màn hình').props.onClick();r.flush();assert.equal(enter,1);
  buttons(r.value).find(b=>textOf(b)==='Thoát toàn màn hình').props.onClick();r.flush();assert.equal(exit,1);buttons(r.value).find(b=>textOf(b)==='Thoát tập trung').props.onClick();assert.equal(mounted.exits,1);assert.equal(store.getItem(draftKey(exam.id)),before);r.value.props.ref.current=null;r.dispose();
});
test('Trả lời nhanh A-D dùng bộ ghi hiện có, phản ánh đáp án và bỏ chọn',()=>{
  const {r,state,answers}=mount(new FakeStore());const q=exam.questions[0];assert.equal(q.kind,'mc');
  let quick=find(r.value,(n:any)=>n.props?.className==='fr-quick');
  buttons(quick).find(b=>textOf(b)==='B').props.onClick();assert.deepEqual(answers.pop(),[q.id,'B']);
  state.draft.answers[q.id]='B';r.flush();quick=find(r.value,(n:any)=>n.props?.className==='fr-quick');
  const selected=buttons(quick).find(b=>textOf(b)==='B');assert.equal(selected.props['aria-pressed'],true);
  selected.props.onClick();assert.deepEqual(answers.pop(),[q.id,null]);
  state.pdfReady=false;r.flush();assert.equal(find(r.value,(n:any)=>n.type==='fieldset'&&n.props.disabled)?.props.disabled,true);r.dispose();
});
test('Trả lời nhanh Đ/S giữ đủ bốn ý, sửa/xóa một ý không mất ý khác',()=>{
  const {r,state,answers}=mount(new FakeStore());state.activeQuestion=exam.questions.findIndex(q=>q.kind==='tf');
  const q=exam.questions[state.activeQuestion];state.draft.answers[q.id]=[true,null,false,null];r.flush();
  let quick=find(r.value,(n:any)=>n.props?.className==='fr-quick');
  buttons(quick).find(b=>b.props['aria-label']==='Ý b: Sai').props.onClick();assert.deepEqual(answers.pop(),[q.id,[true,false,false,null]]);
  state.draft.answers[q.id]=[true,false,false,null];r.flush();quick=find(r.value,(n:any)=>n.props?.className==='fr-quick');
  buttons(quick).find(b=>b.props['aria-label']==='Ý b: Sai').props.onClick();assert.deepEqual(answers.pop(),[q.id,[true,null,false,null]]);r.dispose();
});
test('Ô nhanh câu ngắn giữ nguyên chuỗi, đồng bộ và không kích phím tắt',()=>{
  const {r,state,answers}=mount(new FakeStore());state.activeQuestion=exam.questions.findIndex(q=>q.kind==='short');r.flush();
  const q=exam.questions[state.activeQuestion],input=find(r.value,(n:any)=>n.props?.id==='fr-quick-short');
  input.props.onChange({target:{value:'-0,25'}});assert.deepEqual(answers.pop(),[q.id,'-0,25']);
  state.draft.answers[q.id]='-0,25';r.flush();assert.equal(find(r.value,(n:any)=>n.props?.id==='fr-quick-short').props.value,'-0,25');
  const target=new FakeElement();target.closest=()=>({} as any);press('ArrowRight',target);r.flush();assert.equal(state.activeQuestion,exam.questions.indexOf(q));r.dispose();
});
test('Menu công cụ mở/đóng bằng Esc và chọn tiện ích đóng menu',()=>{
  const {r}=mount(new FakeStore());let toggle=buttons(r.value).find(b=>b.props['aria-controls']==='fr-actions');
  toggle.props.onClick();r.flush();assert.equal(find(r.value,(n:any)=>n.props?.id==='fr-actions').props.className,'fr-actions is-open');
  press('Escape');r.flush();assert.equal(find(r.value,(n:any)=>n.props?.id==='fr-actions').props.className,'fr-actions');
  toggle=buttons(r.value).find(b=>b.props['aria-controls']==='fr-actions');toggle.props.onClick();r.flush();
  buttons(r.value).find(b=>textOf(b)==='Tiện ích').props.onClick();r.flush();assert.equal(find(r.value,(n:any)=>n.props?.id==='fr-actions').props.className,'fr-actions');
  assert.ok(find(r.value,(n:any)=>n.props?.['aria-label']==='Tiện ích phòng làm bài'));r.dispose();
});
test('Tên đề đầy đủ mở bằng chạm, Esc đóng; nhãn phiếu thống nhất',()=>{
  const {r}=mount(new FakeStore());const title=buttons(r.value).find(b=>b.props.className==='fr-title-button');
  title.props.onClick();r.flush();assert.ok(find(r.value,(n:any)=>n.props?.['aria-label']==='Tên đầy đủ của đề'));
  press('Escape');r.flush();assert.ok(!find(r.value,(n:any)=>n.props?.['aria-label']==='Tên đầy đủ của đề'));
  const sheet=buttons(r.value).find(b=>b.props['aria-label']==='Mở phiếu trả lời');assert.ok(sheet);assert.ok(!textOf(sheet).startsWith('Phiếu ·'));r.dispose();
});
test('Phương án DOM trong đề dùng cùng bộ ghi/bỏ chọn với dock',()=>{
  const {r,state,answers}=mount(new FakeStore()),q=exam.questions[0];
  const provider=()=>find(r.value,(n:any)=>n.props?.value?.questionId===q.id).props.value;
  provider().choose('B');assert.deepEqual(answers.pop(),[q.id,'B']);
  state.draft.answers[q.id]='B';r.flush();assert.equal(provider().answer,'B');provider().choose('B');assert.deepEqual(answers.pop(),[q.id,null]);
  state.pdfReady=false;r.flush();assert.equal(provider().disabled,true);r.dispose();
});
test('Nộp bài chỉ nổi vàng khi làm hết hoặc còn tối đa 5 phút; dấu sao theo câu',()=>{
  const {r,state}=mount(new FakeStore());
  const submit=()=>buttons(r.value).find(b=>textOf(b)==='Nộp bài');
  assert.equal(submit().props.className,'fr-submit');
  state.seconds=301;r.flush();assert.equal(submit().props.className,'fr-submit');
  state.seconds=300;r.flush();assert.equal(submit().props.className,'fr-submit is-ready');
  state.seconds=5400;state.answered=exam.questions.length;r.flush();assert.equal(submit().props.className,'fr-submit is-ready');
  press('M');r.flush();assert.match(textOf(buttons(r.value).find(b=>b.props.className==='fr-sheet-toggle')),/★/);
  press('ArrowRight');r.flush();assert.doesNotMatch(textOf(buttons(r.value).find(b=>b.props.className==='fr-sheet-toggle')),/★/);
  buttons(r.value).find(b=>b.props.className==='fr-menu-title').props.onClick();r.flush();
  assert.ok(find(r.value,(n:any)=>n.props?.['aria-label']==='Tên đầy đủ của đề'));r.dispose();
});
test('PDF: chỉ compact mobile khởi tạo 150%, nút vừa ngang về 100%; giao diện cũ giữ nguyên',()=>{
  const pdfCode=buildSync({entryPoints:[join(root,'src/native/exams/QuestionPdf.tsx')],bundle:true,write:false,platform:'node',format:'cjs',jsx:'automatic',packages:'external',alias:{react:fixture,'react/jsx-runtime':fixture,'react-dom':fixture},logLevel:'silent'}).outputFiles[0].text;
  const m={exports:{} as any};new Function('require','module','exports',pdfCode)((id:string)=>id.startsWith('pdfjs-dist')?(id.includes('worker')?{default:'worker'}:{GlobalWorkerOptions:{},AnnotationMode:{DISABLE:0},getDocument(){}}):require(id),m,m.exports);
  const original=(globalThis as any).window;
  try{for(const [mobile,compact,want] of [[true,true,'×1,5'],[false,true,'Vừa ngang'],[true,false,'Vừa bề ngang']] as const){
    (globalThis as any).window={matchMedia:()=>({matches:mobile})};
    const r=new Runtime(()=>m.exports.default({file:{questionPages:[1]},title:'Đề kiểm',onReady(){},compact}));
    // Kiểm khởi tạo và handler; không mô phỏng vẽ canvas bằng fixture React.
    (globalThis as any).__mtmRoomRuntime=r;r.value=r.fn();
    assert.ok(textOf(r.value).includes(want));
    if(compact){buttons(r.value).find(b=>b.props['aria-label']==='Vừa ngang').props.onClick();r.index=0;r.value=r.fn();assert.equal(textOf(buttons(r.value).find(b=>b.props['aria-label']==='Vừa ngang')),'Vừa ngang');}
  }}finally{(globalThis as any).window=original;}
});
finish();


import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {join} from 'node:path';
import {NOTEBOOK_KEY,parseNotebook,saveNotebook} from '../src/migration/notebook-store';

const root=process.env.MTM_ROOT!,require=createRequire(join(root,'package.json'));
const {buildSync}=require('esbuild'),React=require('react');
const code=buildSync({entryPoints:[join(root,'src/migration/Notebook.tsx')],bundle:true,write:false,platform:'node',format:'cjs',jsx:'automatic',packages:'external',loader:{'.css':'empty'},logLevel:'silent'}).outputFiles[0].text;
const DRAFT_KEY='mtm:guest-notebook:draft:v1';
const date=new Date(),dateKey=[date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-'),monthKey=dateKey.slice(0,7);
// Chỉ fixture GIẢ trong bộ nhớ. Không đọc localStorage của trình duyệt hoặc hồ sơ thật.
const saved={version:1,days:{[dateKey]:[{id:'fake-task',text:'Việc GIẢ đã lưu',minutes:30,done:false}]},goals:{[monthKey]:'Mục tiêu GIẢ đã lưu'}};
const savedRaw=JSON.stringify(saved),draftTitle='Việc GIẢ đang gõ',draftGoal='Mục tiêu GIẢ đang gõ';
const storage=(initial:Record<string,string>={})=>{
  const values=new Map(Object.entries(initial));
  return{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,String(value)),removeItem:(key:string)=>values.delete(key)};
};
let primary=storage(),session=storage();
const globals=globalThis as any,names=['localStorage','sessionStorage','window','confirm','requestAnimationFrame'];
const previous=names.map(name=>[name,Object.getOwnPropertyDescriptor(globals,name)] as const);
Object.defineProperties(globals,{
  localStorage:{configurable:true,get:()=>primary},sessionStorage:{configurable:true,get:()=>session},
  window:{configurable:true,value:{addEventListener(){},removeEventListener(){}}},
  confirm:{configurable:true,value:()=>true},requestAnimationFrame:{configurable:true,value:(fn:()=>void)=>{fn();return 0;}},
});
function find(tree:any,predicate:(node:any)=>boolean):any{
  if(!tree||typeof tree!=='object')return null;
  if(Array.isArray(tree))return tree.map(node=>find(node,predicate)).find(Boolean)??null;
  return predicate(tree)?tree:find(tree.props?.children,predicate);
}
function text(tree:any):string{
  if(typeof tree==='string'||typeof tree==='number')return String(tree);
  if(!tree||typeof tree!=='object')return '';
  return Array.isArray(tree)?tree.map(text).join(''):text(tree.props?.children);
}
function mount(){
  const slots:any[]=[],effects=new Map<number,{deps:any[];cleanup?:()=>void}>();
  let cursor=0,changed=false,pending:(()=>void)[]=[];
  const hooks={
    useState:(initial:any)=>{const index=cursor++;if(!(index in slots))slots[index]=typeof initial==='function'?initial():initial;return[slots[index],(next:any)=>{const value=typeof next==='function'?next(slots[index]):next;if(!Object.is(value,slots[index])){slots[index]=value;changed=true;}}];},
    useRef:(initial:any)=>{const index=cursor++;if(!(index in slots))slots[index]={current:initial};return slots[index];},
    useEffect:(fn:()=>void|(()=>void),deps:any[])=>{const index=cursor++,old=effects.get(index);if(!old||deps.some((value,i)=>!Object.is(value,old.deps[i]))){pending.push(()=>{old?.cleanup?.();const cleanup=fn();effects.set(index,{deps,cleanup:typeof cleanup==='function'?cleanup:undefined});});}},
  };
  const mod={exports:{} as any};
  new Function('require','module','exports',code)((id:string)=>id==='react'?{...React,...hooks}:require(id),mod,mod.exports);
  const draw=()=>{let tree:any;for(let renders=0;renders<15;renders++){changed=false;cursor=0;tree=mod.exports.default();const queue=pending;pending=[];queue.forEach(fn=>fn());if(!changed)return tree;}throw Error('Hook GIẢ không ổn định sau 15 lần dựng.');};
  return{draw,unmount:()=>effects.forEach(effect=>effect.cleanup?.())};
}
const title=(tree:any)=>find(tree,node=>node.type==='input'&&node.props.placeholder==='Ví dụ: Ôn lại điều kiện xác định của hàm số');
const goal=(tree:any)=>find(tree,node=>node.type==='textarea');
const editText=(tree:any)=>find(tree,node=>node.type==='input'&&node.props.autoFocus===true);
const minuteInputs=(tree:any)=>{const out:any[]=[];const visit=(node:any)=>{if(!node||typeof node!=='object')return;if(Array.isArray(node)){node.forEach(visit);return;}if(node.type==='input'&&node.props.inputMode==='decimal')out.push(node);visit(node.props?.children);};visit(tree);return out;};
const change=(input:any,value:string)=>{assert.ok(input,'Có điều khiển cần nhập.');input.props.onChange({target:{value}});};
const reset=(payload?:unknown)=>{primary=storage({[NOTEBOOK_KEY]:savedRaw});session=storage(payload===undefined?{}:{[DRAFT_KEY]:JSON.stringify(payload)});};
let failed=0,total=0;
function test(name:string,fn:()=>void){total++;try{fn();console.log('ĐẠT '+total+' '+name);}catch(error){failed++;console.error('LỖI '+total+' '+name+': '+(error instanceof Error?error.message:String(error)));}}

try{
  test('Phút nhập dở ngoài miền vẫn phục hồi title và mục tiêu, không ghi vào bản lưu chính',()=>{
    for(const minutes of [2000,-1,1.5]){
      reset();const first=mount();let tree=first.draw();change(title(tree),draftTitle);change(goal(tree),draftGoal);change(minuteInputs(tree)[0],String(minutes));tree=first.draw();
      const payload=JSON.parse(session.getItem(DRAFT_KEY)!);assert.equal(payload.minutes,String(minutes));assert.equal(payload.title,draftTitle);assert.equal(payload.goalText,draftGoal);first.unmount();
      const second=mount();tree=second.draw();assert.equal(title(tree).props.value,draftTitle);assert.equal(goal(tree).props.value,draftGoal);assert.equal(minuteInputs(tree)[0].props.value,String(minutes));
      find(tree,node=>node.type==='form').props.onSubmit({preventDefault(){}});tree=second.draw();assert.match(text(tree),/Số phút phải là số nguyên từ 0 đến 1440/);assert.doesNotMatch(text(tree),/Bản lưu sổ tay có dữ liệu không hợp lệ/);assert.equal(primary.getItem(NOTEBOOK_KEY),savedRaw);second.unmount();
    }
  });
  test('Tên việc sửa đang rỗng không xóa các nháp hợp lệ khác khi tải lại',()=>{
    reset();const first=mount();let tree=first.draw();find(tree,node=>node.props?.['aria-label']==='Sửa việc Việc GIẢ đã lưu').props.onClick();tree=first.draw();
    change(editText(tree),'');change(title(tree),draftTitle);change(goal(tree),draftGoal);tree=first.draw();assert.equal(JSON.parse(session.getItem(DRAFT_KEY)!).edit.text,'');first.unmount();
    const second=mount();tree=second.draw();assert.equal(editText(tree)?.props.value,'');assert.equal(title(tree).props.value,draftTitle);assert.equal(goal(tree).props.value,draftGoal);
    find(tree,node=>node.type==='button'&&text(node)==='Lưu thay đổi').props.onClick();tree=second.draw();assert.match(text(tree),/Nội dung việc không được để trống/);assert.equal(primary.getItem(NOTEBOOK_KEY),savedRaw);second.unmount();
  });
  test('Phút âm hoặc số lẻ đang sửa được giữ qua writer và reload, saveEdit vẫn từ chối',()=>{
    for(const minutes of [-1,1.5]){
      reset();const first=mount();let tree=first.draw();find(tree,node=>node.props?.['aria-label']==='Sửa việc Việc GIẢ đã lưu').props.onClick();tree=first.draw();change(goal(tree),draftGoal);change(minuteInputs(tree)[1],String(minutes));first.draw();first.unmount();
      const second=mount();tree=second.draw();assert.equal(minuteInputs(tree)[1]?.props.value,String(minutes));assert.equal(goal(tree).props.value,draftGoal);
      find(tree,node=>node.type==='button'&&text(node)==='Lưu thay đổi').props.onClick();tree=second.draw();assert.match(text(tree),/Số phút phải là số nguyên từ 0 đến 1440/);assert.equal(primary.getItem(NOTEBOOK_KEY),savedRaw);second.unmount();
    }
  });
  test('Draft hợp lệ v1 vẫn phục hồi như trước',()=>{
    reset();const first=mount();let tree=first.draw();change(title(tree),draftTitle);change(minuteInputs(tree)[0],'45');first.draw();first.unmount();
    const second=mount();tree=second.draw();assert.equal(title(tree).props.value,draftTitle);assert.equal(minuteInputs(tree)[0].props.value,'45');assert.match(text(tree),/Đã khôi phục phần chưa lưu/);assert.equal(primary.getItem(NOTEBOOK_KEY),savedRaw);second.unmount();
  });
  test('Chuỗi gõ ở ô phút thêm việc được giữ nguyên qua từng bước và tải lại',()=>{
    reset();let current=mount(),tree=current.draw();
    for(const value of ['','-','-1','','1','1.','1.5']){
      change(minuteInputs(tree)[0],value);tree=current.draw();
      assert.equal(minuteInputs(tree)[0].props.type,'text');assert.equal(minuteInputs(tree)[0].props.value,value);
      assert.equal(JSON.parse(session.getItem(DRAFT_KEY)!).minutes,value);current.unmount();
      current=mount();tree=current.draw();assert.equal(minuteInputs(tree)[0].props.value,value);assert.match(text(tree),/Đã khôi phục phần chưa lưu/);assert.equal(primary.getItem(NOTEBOOK_KEY),savedRaw);
    }current.unmount();
  });
  test('Chuỗi gõ ở ô phút sửa việc được giữ nguyên qua từng bước và tải lại',()=>{
    reset();let current=mount(),tree=current.draw();find(tree,node=>node.props?.['aria-label']==='Sửa việc Việc GIẢ đã lưu').props.onClick();tree=current.draw();
    for(const value of ['','-','-1','','1','1.','1.5']){
      change(minuteInputs(tree)[1],value);tree=current.draw();assert.equal(minuteInputs(tree)[1].props.value,value);
      assert.equal(JSON.parse(session.getItem(DRAFT_KEY)!).edit.minutes,value);current.unmount();
      current=mount();tree=current.draw();assert.equal(minuteInputs(tree)[1].props.value,value);assert.equal(primary.getItem(NOTEBOOK_KEY),savedRaw);
    }current.unmount();
  });
  test('Cả thêm và sửa từ chối ô trống, nhập dở và số ngoài miền bằng thông báo đúng',()=>{
    for(const value of ['', ' ', '-', '.', '1e', 'NaN', 'Infinity', '-1', '1.5', '1441']){
      reset();let current=mount(),tree=current.draw();change(title(tree),draftTitle);change(minuteInputs(tree)[0],value);tree=current.draw();
      find(tree,node=>node.type==='form').props.onSubmit({preventDefault(){}});tree=current.draw();
      assert.equal(text(find(tree,node=>node.props?.role==='alert')),'Số phút phải là số nguyên từ 0 đến 1440.');assert.equal(primary.getItem(NOTEBOOK_KEY),savedRaw);assert.equal(minuteInputs(tree)[0].props.value,value);current.unmount();
      reset();current=mount();tree=current.draw();find(tree,node=>node.props?.['aria-label']==='Sửa việc Việc GIẢ đã lưu').props.onClick();tree=current.draw();change(minuteInputs(tree)[1],value);tree=current.draw();
      find(tree,node=>node.type==='button'&&text(node)==='Lưu thay đổi').props.onClick();tree=current.draw();
      assert.equal(text(find(tree,node=>node.props?.role==='alert')),'Số phút phải là số nguyên từ 0 đến 1440.');assert.equal(primary.getItem(NOTEBOOK_KEY),savedRaw);assert.equal(minuteInputs(tree)[1].props.value,value);current.unmount();
    }
  });
  test('Thêm và sửa lưu số nguyên tại ranh giới 0, 1440 dưới dạng số chính thức',()=>{
    for(const value of ['0','45','1440']){
      reset();let current=mount(),tree=current.draw();change(title(tree),draftTitle);change(minuteInputs(tree)[0],value);tree=current.draw();find(tree,node=>node.type==='form').props.onSubmit({preventDefault(){}});tree=current.draw();
      let data=parseNotebook(primary.getItem(NOTEBOOK_KEY));assert.equal(data.days[dateKey].length,2);assert.equal(data.days[dateKey][1].minutes,Number(value));assert.equal(title(tree).props.value,'');assert.equal(session.getItem(DRAFT_KEY),null);current.unmount();
      reset();current=mount();tree=current.draw();find(tree,node=>node.props?.['aria-label']==='Sửa việc Việc GIẢ đã lưu').props.onClick();tree=current.draw();change(minuteInputs(tree)[1],value);tree=current.draw();find(tree,node=>node.type==='button'&&text(node)==='Lưu thay đổi').props.onClick();tree=current.draw();
      data=parseNotebook(primary.getItem(NOTEBOOK_KEY));assert.equal(data.days[dateKey][0].minutes,Number(value));assert.equal(editText(tree),null);assert.equal(session.getItem(DRAFT_KEY),null);current.unmount();
    }
  });
  test('Nháp v1 cũ lưu phút dạng số vẫn khôi phục cả thêm và sửa',()=>{
    for(const minutes of [0,45,1440,-1,1.5,2000]){
      reset({version:1,date:dateKey,title:draftTitle,minutes,goalMonth:monthKey,goalText:draftGoal,edit:{date:dateKey,id:'fake-task',text:'Việc GIẢ sửa',minutes}});
      const current=mount(),tree=current.draw();assert.equal(minuteInputs(tree)[0].props.value,String(minutes));assert.equal(minuteInputs(tree)[1].props.value,String(minutes));assert.equal(title(tree).props.value,draftTitle);assert.equal(editText(tree).props.value,'Việc GIẢ sửa');assert.equal(goal(tree).props.value,draftGoal);assert.equal(primary.getItem(NOTEBOOK_KEY),savedRaw);current.unmount();
    }
  });
  test('Schema draft hỏng vẫn bị loại; không ghi đè sổ tay đã lưu',()=>{
    const base={version:1,date:dateKey,title:draftTitle,minutes:30,goalMonth:monthKey,goalText:draftGoal,edit:null};
    for(const payload of [
      {...base,extra:'GIẢ'}, {...base,version:2}, {...base,title:'x'.repeat(401)}, {...base,goalText:'x'.repeat(2001)}, {...base,date:'2026-02-30'},
      {...base,minutes:'2'.repeat(33)}, {...base,minutes:{value:30}}, {...base,minutes:null}, {...base,minutes:Infinity}, {...base,edit:[]},
      {...base,edit:{date:dateKey,id:'fake-task',text:'x'.repeat(401),minutes:30}},
      {...base,edit:{date:dateKey,id:'fake-task',text:'',minutes:{value:30}}},
      {...base,edit:{date:dateKey,id:'fake-task',text:'',minutes:30,extra:true}},
    ]){reset(payload);const current=mount(),tree=current.draw();assert.equal(title(tree).props.value,'');assert.equal(session.getItem(DRAFT_KEY),null);assert.match(text(tree),/Bản nháp phục hồi không hợp lệ/);assert.equal(primary.getItem(NOTEBOOK_KEY),savedRaw);current.unmount();}
  });
  test('Parser và saveNotebook chính vẫn từ chối text rỗng, phút âm, lẻ và quá 1440',()=>{
    for(const patch of [{text:''},{minutes:-1},{minutes:1.5},{minutes:2000}]){
      reset();const invalid={...saved,days:{[dateKey]:[{...saved.days[dateKey][0],...patch}]}};
      assert.throws(()=>parseNotebook(JSON.stringify(invalid)),/không hợp lệ/);assert.throws(()=>saveNotebook(primary,savedRaw,invalid),/không hợp lệ/);assert.equal(primary.getItem(NOTEBOOK_KEY),savedRaw);
    }
  });
}finally{
  for(const [name,descriptor] of previous){if(descriptor)Object.defineProperty(globals,name,descriptor);else delete globals[name];}
}
console.log(`${total-failed}/${total} ca runtime nháp sổ tay đạt. Kiểm bằng hook GIẢ, chưa phải thao tác trình duyệt thật.`);
process.exitCode=failed?1:0;

import {useEffect,useRef,useState,type KeyboardEvent} from 'react';
import NotebookImport from './NotebookImport';
import NotebookRhythm from './NotebookRhythm';
import NotebookFormulaLauncher from './NotebookFormulaLauncher';
import NotebookStepOrderLauncher from './NotebookStepOrderLauncher';
import NotebookFlightLauncher from './NotebookFlightLauncher';
import R106PageIntro from './R106PageIntro';
import {BEFORE_NAVIGATION_EVENT} from './navigation';
import {NOTEBOOK_KEY as KEY,emptyNotebook as empty,parseNotebook,saveNotebook,type Task,type Store} from './notebook-store';
import {CalendarDays,CheckCircle2,ChevronLeft,ChevronRight,Download,Pencil,Plus,Save,Trash2,X} from 'lucide-react';

const DRAFT_KEY='mtm:guest-notebook:draft:v1';
const DRAFT_LIMIT=12000;
const STORAGE_CONFLICT='Sổ tay vừa thay đổi ở thẻ khác. Nhịp học đang chờ đối chiếu; phần đang gõ được giữ trên màn hình. Hãy sao chép phần cần giữ rồi tải lại trang.';
type DraftMinutes=string|number;
type DraftEdit={date:string;id:string;text:string;minutes:DraftMinutes};
type SessionDraft={version:1;date:string;title:string;minutes:DraftMinutes;goalMonth:string;goalText:string|null;edit:DraftEdit|null};

const keyFor=(d:Date)=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
const monthFor=(d:Date)=>new Date(d.getFullYear(),d.getMonth(),1);
const clampMonth=(d:Date,delta:number)=>new Date(d.getFullYear(),d.getMonth()+delta,Math.min(d.getDate(),new Date(d.getFullYear(),d.getMonth()+delta+1,0).getDate()));
const exactKeys=(value:Record<string,unknown>,keys:string[])=>Object.keys(value).sort().join('|')===keys.slice().sort().join('|');
const isDateKey=(value:unknown):value is string=>{
 if(typeof value!=='string'||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value))return false;
 const parsed=new Date(value+'T12:00:00');return !Number.isNaN(parsed.getTime())&&keyFor(parsed)===value;
};
// Nháp giữ nguyên chuỗi đang gõ, kể cả ô trống hoặc dấu âm; vẫn đọc được nháp số v1 cũ.
const validDraftMinutes=(value:unknown):value is DraftMinutes=>typeof value==='string'?value.length<=32:typeof value==='number'&&Number.isFinite(value);
const parseMinutes=(value:string):number|null=>{const parsed=Number(value);return value.trim()!==''&&Number.isInteger(parsed)&&parsed>=0&&parsed<=1440?parsed:null;};
function initialState(){try{const raw=localStorage.getItem(KEY);return{raw,data:parseNotebook(raw),error:''};}catch(e){return{raw:null,data:empty(),error:e instanceof Error?e.message:'Chưa đọc được bộ nhớ trình duyệt.'};}}
function readSessionDraft():{draft:SessionDraft|null;error:string}{
 try{
  const raw=sessionStorage.getItem(DRAFT_KEY);if(raw===null)return{draft:null,error:''};
  if(raw.length>DRAFT_LIMIT)throw new Error('Bản nháp vượt giới hạn an toàn.');
  const value:unknown=JSON.parse(raw);if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Bản nháp không phải đối tượng.');
  const draft=value as Record<string,unknown>;
  if(!exactKeys(draft,['version','date','title','minutes','goalMonth','goalText','edit'])||draft.version!==1||!isDateKey(draft.date)||typeof draft.title!=='string'||draft.title.length>400||!validDraftMinutes(draft.minutes)||typeof draft.goalMonth!=='string'||!/^[0-9]{4}-[0-9]{2}$/.test(draft.goalMonth)||draft.goalMonth!==draft.date.slice(0,7)||!(draft.goalText===null||(typeof draft.goalText==='string'&&draft.goalText.length<=2000)))throw new Error('Cấu trúc bản nháp không hợp lệ.');
  if(draft.edit!==null){
   if(!draft.edit||typeof draft.edit!=='object'||Array.isArray(draft.edit))throw new Error('Mục đang sửa không hợp lệ.');
   const edit=draft.edit as Record<string,unknown>;
   if(!exactKeys(edit,['date','id','text','minutes'])||!isDateKey(edit.date)||edit.date!==draft.date||typeof edit.id!=='string'||edit.id.length<1||edit.id.length>200||typeof edit.text!=='string'||edit.text.length>400||!validDraftMinutes(edit.minutes))throw new Error('Mục đang sửa không hợp lệ.');
  }
  return{draft:draft as SessionDraft,error:''};
 }catch{
  try{sessionStorage.removeItem(DRAFT_KEY);}catch{}
  return{draft:null,error:'Bản nháp phục hồi không hợp lệ nên đã được bỏ qua. Bản sổ tay đã lưu vẫn được giữ nguyên.'};
 }
}

export default function Notebook(){
 const today=new Date();
 const [initial]=useState(initialState),[recovery]=useState(readSessionDraft);
 const recoveredDate=recovery.draft?.date??keyFor(today),recoveredMonth=monthFor(new Date(recoveredDate+'T12:00:00'));
 const recoveredEdit=recovery.draft?.edit??null;
 const recoveredGoal=recovery.draft?.goalText??null;
 const recoveredDirty=!!recovery.draft&&(!!recovery.draft.title.trim()||String(recovery.draft.minutes)!=='30'||recoveredGoal!==null&&recoveredGoal!==(initial.data.goals[recovery.draft.goalMonth]??'')||!!recoveredEdit);
 const [month,setMonth]=useState(recoveredMonth),[date,setDate]=useState(recoveredDate),[error,setError]=useState(recovery.error),[notice,setNotice]=useState(recoveredDirty?'Đã khôi phục phần chưa lưu trong thẻ trình duyệt này.':'');
 const lastRaw=useRef<string|null>(initial.raw),calendarButtons=useRef(new Map<string,HTMLButtonElement>());
 const [store,setStore]=useState<Store>(initial.data),[title,setTitle]=useState(recovery.draft?.title??''),[minutes,setMinutes]=useState(String(recovery.draft?.minutes??30)),[goalDraft,setGoalDraft]=useState<string|null>(recoveredGoal);
 const [editingId,setEditingId]=useState<string|null>(recoveredEdit?.id??null),[editingText,setEditingText]=useState(recoveredEdit?.text??''),[editingMinutes,setEditingMinutes]=useState(String(recoveredEdit?.minutes??30));
 const [draftStorageError,setDraftStorageError]=useState('');
 const [taskFilter,setTaskFilter]=useState<'all'|'pending'|'done'>('all');
 const [taskFocus,setTaskFocus]=useState<{id:string|null;revision:number}>({id:null,revision:0});
 const nextTaskCheckbox=useRef<HTMLInputElement>(null),activeTaskFilter=useRef<HTMLButtonElement>(null);
 const [storageNotice,setStorageNotice]=useState(initial.error),[storageConflict,setStorageConflict]=useState('');
 const monthKey=keyFor(month).slice(0,7),offset=(month.getDay()+6)%7;
 const days=Array.from({length:42},(_,i)=>new Date(month.getFullYear(),month.getMonth(),i-offset+1));
 const tasks=store.days[date]??[],monthTasks=Object.entries(store.days).filter(([k])=>k.startsWith(monthKey)),completed=monthTasks.flatMap(([,v])=>v).filter(t=>t.done);
 const editingTask=editingId?tasks.find(t=>t.id===editingId):undefined;
 const dayCompleted=tasks.filter(t=>t.done).length;
 const matchesFilter=(task:Task)=>taskFilter==='all'||(taskFilter==='done'?task.done:!task.done);
 const visibleTasks=tasks.filter(task=>matchesFilter(task)||task.id===editingId);
 const editingOutsideFilter=!!editingTask&&!matchesFilter(editingTask);
 const orphanEdit=!!editingId&&!editingTask;
 const goalDirty=goalDraft!==null&&goalDraft!==(store.goals[monthKey]??''),editDirty=!!editingId&&(!editingTask||editingText!==editingTask.text||editingMinutes!==String(editingTask.minutes));
 const taskDraftDirty=!!title.trim()||minutes!=='30'||editDirty,dirty=taskDraftDirty||goalDirty;

 useEffect(()=>{if(taskFocus.revision)(taskFocus.id?nextTaskCheckbox.current:activeTaskFilter.current)?.focus();},[taskFocus]);

 function discardSessionDraft(){
  try{sessionStorage.removeItem(DRAFT_KEY);setDraftStorageError('');return true;}
  catch{setDraftStorageError('Không thể bỏ phần chưa lưu vì trình duyệt đang chặn bộ nhớ của thẻ. Trang sổ tay được giữ lại để tránh phục hồi sai.');return false;}
 }

 useEffect(()=>{
  try{
   if(!dirty){sessionStorage.removeItem(DRAFT_KEY);setDraftStorageError('');return;}
   const draft:SessionDraft={version:1,date,title,minutes,goalMonth:monthKey,goalText:goalDirty?goalDraft:null,edit:editDirty&&editingId?{date,id:editingId,text:editingText,minutes:editingMinutes}:null};
   const json=JSON.stringify(draft);if(json.length>DRAFT_LIMIT)throw new Error('Bản nháp đang gõ vượt giới hạn an toàn.');
   sessionStorage.setItem(DRAFT_KEY,json);setDraftStorageError('');
  }catch(e){setDraftStorageError(e instanceof Error?e.message:'Không thể giữ phần đang gõ để phục hồi trong thẻ này.');}
 },[date,dirty,editDirty,editingId,editingMinutes,editingTask,editingText,goalDirty,goalDraft,minutes,monthKey,title]);
 useEffect(()=>{const unload=(e:BeforeUnloadEvent)=>{if(dirty){e.preventDefault();e.returnValue='';}};const leave=(e:Event)=>{if(!dirty)return;if(!confirm('Có nội dung sổ tay chưa lưu. Rời trang và bỏ phần chưa lưu?')){e.preventDefault();return;}if(!discardSessionDraft())e.preventDefault();};window.addEventListener('beforeunload',unload);window.addEventListener(BEFORE_NAVIGATION_EVENT,leave);return()=>{window.removeEventListener('beforeunload',unload);window.removeEventListener(BEFORE_NAVIGATION_EVENT,leave);};},[dirty]);
 useEffect(()=>{
  const changed=(e:StorageEvent)=>{
   if(e.key!==KEY&&e.key!==null)return;
   try{
    if(e.storageArea&&e.storageArea!==localStorage)return;
    const raw=e.key===null?localStorage.getItem(KEY):e.newValue,next=parseNotebook(raw);
    setStorageNotice('');setNotice('');
    if(dirty&&raw!==lastRaw.current){setStorageConflict(STORAGE_CONFLICT);return;}
    lastRaw.current=raw;setStore(next);setStorageConflict('');setNotice('Đã nhận thay đổi sổ tay từ thẻ khác.');setError('');
   }catch(err){setStorageNotice(err instanceof Error?err.message:'Bản lưu ở thẻ khác không hợp lệ.');setStorageConflict('');setNotice('');}
  };
  window.addEventListener('storage',changed);return()=>window.removeEventListener('storage',changed);
 },[dirty]);

 function resetTaskDrafts(){setTitle('');setMinutes('30');setEditingId(null);setEditingText('');setEditingMinutes('30');}
 function confirmDayChange(nextKey:string){
  if(nextKey===date)return true;
  const changingMonth=nextKey.slice(0,7)!==monthKey;
  if((taskDraftDirty||changingMonth&&goalDirty)&&!confirm('Có nội dung sổ tay chưa lưu. Chuyển ngày và bỏ phần đang gõ của ngày hoặc tháng cũ?'))return false;
  resetTaskDrafts();const next=new Date(nextKey+'T12:00:00');setDate(nextKey);setMonth(monthFor(next));if(changingMonth)setGoalDraft(null);setNotice('');return true;
 }
 function todayPlan(){if((goalDirty||taskDraftDirty)&&!confirm('Có nội dung sổ tay chưa lưu. Về hôm nay và bỏ phần đang sửa?'))return;resetTaskDrafts();setDate(keyFor(today));setMonth(monthFor(today));setGoalDraft(null);setNotice('');}
 function persist(next:Store,message:string){
  setError('');if(storageNotice||storageConflict)return false;
  try{
   let raw:string|null;
   try{raw=localStorage.getItem(KEY);parseNotebook(raw);}catch(e){setStorageNotice(e instanceof Error?e.message:'Chưa đọc được bản lưu sổ tay.');setNotice('');return false;}
   if(raw!==lastRaw.current){setStorageConflict(STORAGE_CONFLICT);setNotice('');return false;}
   const json=JSON.stringify(next);if(json.length>1000000)throw new Error('Sổ tay đã đạt giới hạn dung lượng. Xuất tệp để lưu lại trước khi xóa bớt.');
   lastRaw.current=saveNotebook(localStorage,lastRaw.current,next);setStore(next);setNotice(message);return true;
  }catch(e){setError(e instanceof Error?e.message:'Không lưu được. Trình duyệt có thể đang chặn bộ nhớ cục bộ.');return false;}
 }
 function move(delta:number){if((goalDirty||taskDraftDirty)&&!confirm('Có nội dung sổ tay chưa lưu. Chuyển tháng và bỏ phần đang sửa?'))return;const current=new Date(date+'T12:00:00'),next=clampMonth(current,delta);resetTaskDrafts();setDate(keyFor(next));setMonth(monthFor(next));setGoalDraft(null);setNotice('');}
 function moveCalendarFocus(e:KeyboardEvent<HTMLButtonElement>,current:Date){
  let next:Date|undefined;const weekday=(current.getDay()+6)%7;
  if(e.key==='ArrowLeft')next=new Date(current.getFullYear(),current.getMonth(),current.getDate()-1);
  if(e.key==='ArrowRight')next=new Date(current.getFullYear(),current.getMonth(),current.getDate()+1);
  if(e.key==='ArrowUp')next=new Date(current.getFullYear(),current.getMonth(),current.getDate()-7);
  if(e.key==='ArrowDown')next=new Date(current.getFullYear(),current.getMonth(),current.getDate()+7);
  if(e.key==='Home')next=new Date(current.getFullYear(),current.getMonth(),current.getDate()-weekday);
  if(e.key==='End')next=new Date(current.getFullYear(),current.getMonth(),current.getDate()+6-weekday);
  if(e.key==='PageUp')next=clampMonth(current,-1);
  if(e.key==='PageDown')next=clampMonth(current,1);
  if(!next)return;e.preventDefault();const key=keyFor(next);if(!confirmDayChange(key))return;requestAnimationFrame(()=>calendarButtons.current.get(key)?.focus());
 }
 function update(nextTasks:Task[],message='Đã lưu trên trình duyệt này.'){return persist({...store,days:{...store.days,[date]:nextTasks}},message);}
 function focusAfterTaskRemoval(id:string,nextTasks:Task[],nextEditingId=editingId){
  const remaining=nextTasks.filter(task=>matchesFilter(task)||task.id===nextEditingId);
  if(remaining.some(task=>task.id===id))return;
  const index=visibleTasks.findIndex(task=>task.id===id),adjacent=remaining[Math.min(index,remaining.length-1)];
  const next=adjacent?.id===nextEditingId?remaining.find(task=>task.id!==nextEditingId):adjacent;
  setTaskFocus(previous=>({id:next?.id??null,revision:previous.revision+1}));
 }
 function toggleTask(task:Task,done:boolean){const next=tasks.map(item=>item.id===task.id?{...item,done}:item);if(update(next))focusAfterTaskRemoval(task.id,next);}
 function finishEdit(task:Task){setEditingId(null);setEditingText('');if(matchesFilter(task))setTaskFocus(previous=>({id:task.id,revision:previous.revision+1}));else focusAfterTaskRemoval(task.id,tasks,null);}
 function startEdit(task:Task){if(taskDraftDirty&&!confirm('Bỏ phần đang gõ để sửa việc khác?'))return;setTitle('');setMinutes('30');setEditingId(task.id);setEditingText(task.text);setEditingMinutes(String(task.minutes));setError('');setNotice('');}
 function saveEdit(task:Task){const text=editingText.trim();if(!text){setError('Nội dung việc không được để trống.');return;}const parsedMinutes=parseMinutes(editingMinutes);if(parsedMinutes===null){setError('Số phút phải là số nguyên từ 0 đến 1440.');return;}if(update(tasks.map(t=>t.id===task.id?{...t,text,minutes:parsedMinutes}:t),'Đã lưu thay đổi của việc trên trình duyệt.'))finishEdit(task);}
 function exportData(){try{const content=localStorage.getItem(KEY)??JSON.stringify(store,null,2);const blob=new Blob([content],{type:'application/json'});const href=URL.createObjectURL(blob),a=document.createElement('a');a.href=href;a.download='MTM-so-tay-ca-nhan-'+keyFor(new Date())+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(href),1000);}catch(e){setError(e instanceof Error?e.message:'Không xuất được bản lưu từ trình duyệt.');}}

 return <div className="mig-container mig-notebook">
  <R106PageIntro className="mig-notebook-intro" eyebrow="MỖI NGÀY MỘT BƯỚC TIẾN" title="Sổ tay học tập" description={<p>Lên kế hoạch từng ngày, đánh dấu việc đã xong và đặt mục tiêu tháng.</p>}><div className="mig-notebook-file-actions"><NotebookImport store={store} expectedRaw={lastRaw.current} blocked={!!storageNotice||!!storageConflict} onApplied={(next,raw)=>{lastRaw.current=raw;setStore(next);setNotice('Đã ghép bản lưu. Các mục có trước được giữ nguyên.');}}/><button type="button" className="mig-button outline" onClick={exportData}><Download size={17}/>Xuất bản lưu</button></div></R106PageIntro>
  <div className="mig-local-notice"><CalendarDays size={22}/><div><b>Bản nháp cá nhân trên trình duyệt này</b><p>Chưa đồng bộ tài khoản hoặc gửi giáo viên. Phần đang gõ được phục hồi khi tải lại trong chính thẻ này; đóng thẻ hoặc xóa dữ liệu trình duyệt vẫn có thể làm mất bản nháp. Không nhập thông tin nhạy cảm trên máy dùng chung.</p><span>Đồng bộ tài khoản đang chờ tích hợp trực tiếp trên MTM; không mở hệ thống cũ thay thế.</span></div></div>
  {(storageNotice||storageConflict||error||draftStorageError)&&<p role="alert" className="mig-error">{storageNotice||storageConflict||error||draftStorageError}</p>}
  <div className="mig-notebook-stats"><article><span>Ngày đã lên kế hoạch</span><b>{monthTasks.filter(([,t])=>t.length).length}</b></article><article><span>Việc đã hoàn thành</span><b>{completed.length}</b></article><article><span>Phút theo các việc đã đánh dấu</span><b>{completed.reduce((s,t)=>s+t.minutes,0)}</b></article></div>
  <NotebookRhythm days={store.days} today={keyFor(today)} selectedDate={date} onSelectDay={confirmDayChange} unavailable={!!storageNotice||!!storageConflict} unavailableMessage={storageConflict||undefined}/>
  <NotebookFormulaLauncher/>
 <NotebookStepOrderLauncher/>
 <NotebookFlightLauncher/>
  <div className="mig-notebook-grid">
   <section className="mig-panel"><div className="mig-calendar-heading"><h2>Tháng {month.getMonth()+1}, {month.getFullYear()}</h2><div><button type="button" className="mig-icon-button" aria-label="Tháng trước" onClick={()=>move(-1)}><ChevronLeft/></button><button type="button" className="mig-icon-button" aria-label="Tháng sau" onClick={()=>move(1)}><ChevronRight/></button></div></div>
    <div className="mig-calendar" role="group" aria-label="Chọn ngày lập kế hoạch">{['T.2','T.3','T.4','T.5','T.6','T.7','CN'].map(d=><span className="mig-calendar-weekday" key={d}>{d}</span>)}{days.map(d=>{const key=keyFor(d),has=(store.days[key]||[]).length>0;return <button ref={node=>{if(node)calendarButtons.current.set(key,node);else calendarButtons.current.delete(key);}} type="button" key={key} tabIndex={date===key?0:-1} className={(d.getMonth()!==month.getMonth()?'is-outside ':'')+(key===keyFor(today)?'is-today':'')} aria-pressed={date===key} aria-label={key+(has?' · đã có kế hoạch':'')} onClick={()=>confirmDayChange(key)} onKeyDown={e=>moveCalendarFocus(e,d)}>{d.getDate()}<span className={has?'has-plan':''}/></button>;})}</div>
    <p className="mig-calendar-legend"><span/> Đã lên kế hoạch · Viền vàng: hôm nay</p><button type="button" className="mig-button primary full" onClick={todayPlan}>Kế hoạch hôm nay <ChevronRight size={16}/></button>
    <div className="mig-month-goal"><h3>Mục tiêu tháng {month.getMonth()+1}</h3><label className="mig-field"><span className="mig-sr-only">Mục tiêu trong tháng</span><textarea maxLength={2000} rows={4} placeholder="Viết mục tiêu cụ thể, vừa sức và kiểm tra được…" value={goalDraft??store.goals[monthKey]??''} onChange={e=>setGoalDraft(e.target.value)}/></label><button type="button" className="mig-text-button" onClick={()=>{if(persist({...store,goals:{...store.goals,[monthKey]:(goalDraft??store.goals[monthKey]??'').trim()}},'Đã lưu mục tiêu tháng trên trình duyệt.'))setGoalDraft(null);}}><Save size={16}/>Lưu mục tiêu</button></div>
   </section>
   <section className="mig-panel"><div className="mig-calendar-heading"><div><p className="mig-eyebrow">KẾ HOẠCH TRONG NGÀY</p><h2>{date.split('-').reverse().join('/')}</h2></div><CheckCircle2 size={26}/></div>
    {orphanEdit&&<div className="mig-error" role="status"><b>Bản sửa chưa tìm thấy việc gốc</b><p>Phần sửa được giữ lại để em sao chép. Chưa lưu và chưa ghép phần sửa này vào việc nào. Chuyển ngày hoặc rời trang sẽ hỏi trước khi bỏ phần chưa lưu.</p><label className="mig-field">Nội dung bản sửa chưa ghép<textarea aria-label="Nội dung bản sửa chưa ghép" readOnly rows={3} value={editingText}/></label><p>Số phút đang nhập: {editingMinutes||'(để trống)'}</p></div>}
    <form onSubmit={e=>{e.preventDefault();if(!title.trim())return;const parsedMinutes=parseMinutes(minutes);if(parsedMinutes===null){setError('Số phút phải là số nguyên từ 0 đến 1440.');return;}if(tasks.length>=30){setError('Mỗi ngày tối đa 30 việc.');return;}if(persist({...store,days:{...store.days,[date]:[...tasks,{id:crypto.randomUUID(),text:title.trim(),minutes:parsedMinutes,done:false}]}},'Đã thêm việc vào bản nháp trên trình duyệt.')){setTitle('');setMinutes('30');}}}><label className="mig-field">Việc cần làm<input maxLength={400} value={title} required placeholder="Ví dụ: Ôn lại điều kiện xác định của hàm số" onChange={e=>setTitle(e.target.value)}/></label><div className="mig-task-add"><label className="mig-field">Dự kiến (phút)<input type="text" inputMode="decimal" maxLength={32} value={minutes} onChange={e=>setMinutes(e.target.value)}/></label><button className="mig-button gold" type="submit"><Plus size={17}/>Thêm việc</button></div></form>
    <div className="mig-task-filters" role="group" aria-label="Lọc việc trong ngày">{([{id:'all',label:'Tất cả',count:tasks.length},{id:'pending',label:'Chưa xong',count:tasks.length-dayCompleted},{id:'done',label:'Đã xong',count:dayCompleted}] as const).map(filter=><button key={filter.id} id={'notebook-task-filter-'+filter.id} ref={taskFilter===filter.id?activeTaskFilter:undefined} type="button" aria-pressed={taskFilter===filter.id} onClick={()=>setTaskFilter(filter.id)}>{filter.label} ({filter.count})</button>)}</div>
    <p className="mig-task-filter-count" role="status">Đang hiện {visibleTasks.length}/{tasks.length} việc trong ngày.</p>
    {editingOutsideFilter&&<p className="mig-task-filter-edit-note">Việc đang sửa được giữ trong danh sách để em lưu hoặc hủy sửa.</p>}
    <div className="mig-task-list">{visibleTasks.length?visibleTasks.map(t=><article key={t.id} className={t.done?'done':''}>{editingId===t.id?<div className="mig-task-edit"><label className="mig-field">Nội dung việc<input autoFocus maxLength={400} value={editingText} onChange={e=>setEditingText(e.target.value)}/></label><label className="mig-field">Dự kiến (phút)<input type="text" inputMode="decimal" maxLength={32} value={editingMinutes} onChange={e=>setEditingMinutes(e.target.value)}/></label><div className="mig-task-edit-actions"><button type="button" className="mig-button primary" onClick={()=>saveEdit(t)}><Save size={15}/>Lưu thay đổi</button><button type="button" className="mig-button outline" onClick={()=>{finishEdit(t);setError('');}}><X size={15}/>Hủy sửa</button></div></div>:<><label><input id={'notebook-task-'+t.id} ref={taskFocus.id===t.id?nextTaskCheckbox:undefined} type="checkbox" checked={t.done} onChange={e=>toggleTask(t,e.target.checked)}/><span>{t.text}<small>{t.minutes} phút dự kiến</small></span></label><div className="mig-task-actions"><button type="button" className="mig-icon-button" aria-label={'Sửa việc '+t.text} onClick={()=>startEdit(t)}><Pencil size={16}/></button><button type="button" className="mig-icon-button" aria-label={'Xóa việc '+t.text} onClick={()=>{if(!confirm('Xóa việc này khỏi bản nháp?'))return;const next=tasks.filter(x=>x.id!==t.id);if(update(next,'Đã xóa việc khỏi bản nháp trên trình duyệt.'))focusAfterTaskRemoval(t.id,next);}}><Trash2 size={16}/></button></div></>}</article>):tasks.length?<div className="mig-empty"><CheckCircle2 size={34}/><h3>{taskFilter==='pending'?'Không còn việc chưa xong':'Chưa có việc đã xong'}</h3><p>{taskFilter==='pending'?'Các việc trong ngày đã được đánh dấu hoàn thành.':'Đánh dấu khi em hoàn thành một việc.'} Chọn Tất cả để xem lại kế hoạch.</p></div>:<div className="mig-empty"><CalendarDays size={34}/><h3>Một ngày mới, một kế hoạch mới</h3><p>Thêm việc đầu tiên và đánh dấu khi em đã hoàn thành.</p></div>}</div>
    <p role="status" aria-live="polite" className="mig-saved-note">{notice}</p>
   </section>
  </div>
 </div>;
}

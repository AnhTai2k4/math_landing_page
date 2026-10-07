import {useEffect,useRef,useState,type KeyboardEvent} from 'react';
import NotebookImport from './NotebookImport';
import {BEFORE_NAVIGATION_EVENT} from './navigation';
import {NOTEBOOK_KEY as KEY,emptyNotebook as empty,parseNotebook,saveNotebook,type Task,type Store} from './notebook-store';
import {CalendarDays,CheckCircle2,ChevronLeft,ChevronRight,Download,Pencil,Plus,Save,Trash2,X} from 'lucide-react';

const DRAFT_KEY='mtm:guest-notebook:draft:v1';
const DRAFT_LIMIT=12000;
type DraftEdit={date:string;id:string;text:string;minutes:number};
type SessionDraft={version:1;date:string;title:string;minutes:number;goalMonth:string;goalText:string|null;edit:DraftEdit|null};

const keyFor=(d:Date)=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
const monthFor=(d:Date)=>new Date(d.getFullYear(),d.getMonth(),1);
const clampMonth=(d:Date,delta:number)=>new Date(d.getFullYear(),d.getMonth()+delta,Math.min(d.getDate(),new Date(d.getFullYear(),d.getMonth()+delta+1,0).getDate()));
const exactKeys=(value:Record<string,unknown>,keys:string[])=>Object.keys(value).sort().join('|')===keys.slice().sort().join('|');
const isDateKey=(value:unknown):value is string=>{
 if(typeof value!=='string'||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value))return false;
 const parsed=new Date(value+'T12:00:00');return !Number.isNaN(parsed.getTime())&&keyFor(parsed)===value;
};
const validMinutes=(value:unknown):value is number=>Number.isInteger(value)&&Number(value)>=0&&Number(value)<=1440;
function initialState(){try{const raw=localStorage.getItem(KEY);return{raw,data:parseNotebook(raw),error:''};}catch(e){return{raw:null,data:empty(),error:e instanceof Error?e.message:'Chưa đọc được bộ nhớ trình duyệt.'};}}
function readSessionDraft():{draft:SessionDraft|null;error:string}{
 try{
  const raw=sessionStorage.getItem(DRAFT_KEY);if(raw===null)return{draft:null,error:''};
  if(raw.length>DRAFT_LIMIT)throw new Error('Bản nháp vượt giới hạn an toàn.');
  const value:unknown=JSON.parse(raw);if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Bản nháp không phải đối tượng.');
  const draft=value as Record<string,unknown>;
  if(!exactKeys(draft,['version','date','title','minutes','goalMonth','goalText','edit'])||draft.version!==1||!isDateKey(draft.date)||typeof draft.title!=='string'||draft.title.length>400||!validMinutes(draft.minutes)||typeof draft.goalMonth!=='string'||!/^[0-9]{4}-[0-9]{2}$/.test(draft.goalMonth)||draft.goalMonth!==draft.date.slice(0,7)||!(draft.goalText===null||(typeof draft.goalText==='string'&&draft.goalText.length<=2000)))throw new Error('Cấu trúc bản nháp không hợp lệ.');
  if(draft.edit!==null){
   if(!draft.edit||typeof draft.edit!=='object'||Array.isArray(draft.edit))throw new Error('Mục đang sửa không hợp lệ.');
   const edit=draft.edit as Record<string,unknown>;
   if(!exactKeys(edit,['date','id','text','minutes'])||!isDateKey(edit.date)||edit.date!==draft.date||typeof edit.id!=='string'||edit.id.length<1||edit.id.length>200||typeof edit.text!=='string'||edit.text.length<1||edit.text.length>400||!validMinutes(edit.minutes))throw new Error('Mục đang sửa không hợp lệ.');
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
 const recoveredEdit=recovery.draft?.edit&&initial.data.days[recovery.draft.edit.date]?.some(t=>t.id===recovery.draft?.edit?.id)?recovery.draft.edit:null;
 const recoveredGoal=recovery.draft?.goalText??null;
 const recoveredDirty=!!recovery.draft&&(!!recovery.draft.title.trim()||recoveredGoal!==(initial.data.goals[recovery.draft.goalMonth]??'')||!!recoveredEdit);
 const [month,setMonth]=useState(recoveredMonth),[date,setDate]=useState(recoveredDate),[error,setError]=useState(recovery.error),[notice,setNotice]=useState(recoveredDirty?'Đã khôi phục phần chưa lưu trong thẻ trình duyệt này.':'');
 const lastRaw=useRef<string|null>(initial.raw),calendarButtons=useRef(new Map<string,HTMLButtonElement>());
 const [store,setStore]=useState<Store>(initial.data),[title,setTitle]=useState(recovery.draft?.title??''),[minutes,setMinutes]=useState(recovery.draft?.minutes??30),[goalDraft,setGoalDraft]=useState<string|null>(recoveredGoal);
 const [editingId,setEditingId]=useState<string|null>(recoveredEdit?.id??null),[editingText,setEditingText]=useState(recoveredEdit?.text??''),[editingMinutes,setEditingMinutes]=useState(recoveredEdit?.minutes??30);
 const [draftStorageError,setDraftStorageError]=useState('');
 const storageNotice=initial.error,monthKey=keyFor(month).slice(0,7),offset=(month.getDay()+6)%7;
 const days=Array.from({length:42},(_,i)=>new Date(month.getFullYear(),month.getMonth(),i-offset+1));
 const tasks=store.days[date]??[],monthTasks=Object.entries(store.days).filter(([k])=>k.startsWith(monthKey)),completed=monthTasks.flatMap(([,v])=>v).filter(t=>t.done);
 const editingTask=editingId?tasks.find(t=>t.id===editingId):undefined;
 const goalDirty=goalDraft!==null&&goalDraft!==(store.goals[monthKey]??''),editDirty=!!editingTask&&(editingText!==editingTask.text||editingMinutes!==editingTask.minutes);
 const taskDraftDirty=!!title.trim()||editDirty,dirty=taskDraftDirty||goalDirty;

 function discardSessionDraft(){
  try{sessionStorage.removeItem(DRAFT_KEY);setDraftStorageError('');return true;}
  catch{setDraftStorageError('Không thể bỏ phần chưa lưu vì trình duyệt đang chặn bộ nhớ của thẻ. Trang sổ tay được giữ lại để tránh phục hồi sai.');return false;}
 }

 useEffect(()=>{
  try{
   if(!dirty){sessionStorage.removeItem(DRAFT_KEY);setDraftStorageError('');return;}
   const draft:SessionDraft={version:1,date,title,minutes,goalMonth:monthKey,goalText:goalDirty?goalDraft:null,edit:editDirty&&editingTask?{date,id:editingTask.id,text:editingText,minutes:editingMinutes}:null};
   const json=JSON.stringify(draft);if(json.length>DRAFT_LIMIT)throw new Error('Bản nháp đang gõ vượt giới hạn an toàn.');
   sessionStorage.setItem(DRAFT_KEY,json);setDraftStorageError('');
  }catch(e){setDraftStorageError(e instanceof Error?e.message:'Không thể giữ phần đang gõ để phục hồi trong thẻ này.');}
 },[date,dirty,editDirty,editingMinutes,editingTask,editingText,goalDirty,goalDraft,minutes,monthKey,title]);
 useEffect(()=>{const unload=(e:BeforeUnloadEvent)=>{if(dirty){e.preventDefault();e.returnValue='';}};const leave=(e:Event)=>{if(!dirty)return;if(!confirm('Có nội dung sổ tay chưa lưu. Rời trang và bỏ phần chưa lưu?')){e.preventDefault();return;}if(!discardSessionDraft())e.preventDefault();};window.addEventListener('beforeunload',unload);window.addEventListener(BEFORE_NAVIGATION_EVENT,leave);return()=>{window.removeEventListener('beforeunload',unload);window.removeEventListener(BEFORE_NAVIGATION_EVENT,leave);};},[dirty]);
 useEffect(()=>{const changed=(e:StorageEvent)=>{if(e.key!==KEY)return;if(dirty){setError('Sổ tay vừa thay đổi ở thẻ khác. Phần đang gõ được giữ trên màn hình; tải lại sau khi sao chép phần cần giữ.');return;}try{const next=parseNotebook(e.newValue);lastRaw.current=e.newValue;setStore(next);setNotice('Đã nhận thay đổi sổ tay từ thẻ khác.');setError('');}catch(err){setError(err instanceof Error?err.message:'Bản lưu ở thẻ khác không hợp lệ.');}};window.addEventListener('storage',changed);return()=>window.removeEventListener('storage',changed);},[dirty]);

 function resetTaskDrafts(){setTitle('');setEditingId(null);setEditingText('');setEditingMinutes(30);}
 function confirmDayChange(nextKey:string){
  if(nextKey===date)return true;
  if(taskDraftDirty&&!confirm('Có nội dung việc đang sửa hoặc chưa thêm. Chuyển ngày và bỏ phần đang gõ?'))return false;
  resetTaskDrafts();const next=new Date(nextKey+'T12:00:00');setDate(nextKey);setMonth(monthFor(next));setGoalDraft(null);setNotice('');return true;
 }
 function todayPlan(){if((goalDirty||taskDraftDirty)&&!confirm('Có nội dung sổ tay chưa lưu. Về hôm nay và bỏ phần đang sửa?'))return;resetTaskDrafts();setDate(keyFor(today));setMonth(monthFor(today));setGoalDraft(null);setNotice('');}
 function persist(next:Store,message:string){setError('');if(storageNotice){setError('Không ghi đè bản lưu đang lỗi. Xuất bản lưu gốc trước khi xử lý bộ nhớ trình duyệt.');return false;}try{const json=JSON.stringify(next);if(json.length>1000000)throw new Error('Sổ tay đã đạt giới hạn dung lượng. Xuất tệp để lưu lại trước khi xóa bớt.');lastRaw.current=saveNotebook(localStorage,lastRaw.current,next);setStore(next);setNotice(message);return true;}catch(e){setError(e instanceof Error?e.message:'Không lưu được. Trình duyệt có thể đang chặn bộ nhớ cục bộ.');return false;}}
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
 function startEdit(task:Task){if(title.trim()&&!confirm('Bỏ phần việc mới đang gõ để sửa việc đã lưu?'))return;setTitle('');setEditingId(task.id);setEditingText(task.text);setEditingMinutes(task.minutes);setError('');setNotice('');}
 function saveEdit(task:Task){const text=editingText.trim();if(!text){setError('Nội dung việc không được để trống.');return;}if(!Number.isInteger(editingMinutes)||editingMinutes<0||editingMinutes>1440){setError('Số phút phải là số nguyên từ 0 đến 1440.');return;}if(update(tasks.map(t=>t.id===task.id?{...t,text,minutes:editingMinutes}:t),'Đã lưu thay đổi của việc trên trình duyệt.')){setEditingId(null);setEditingText('');}}
 function exportData(){try{const content=localStorage.getItem(KEY)??JSON.stringify(store,null,2);const blob=new Blob([content],{type:'application/json'});const href=URL.createObjectURL(blob),a=document.createElement('a');a.href=href;a.download='MTM-so-tay-ca-nhan-'+keyFor(new Date())+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(href),1000);}catch(e){setError(e instanceof Error?e.message:'Không xuất được bản lưu từ trình duyệt.');}}

 return <div className="mig-container mig-notebook">
  <div className="mig-section-heading"><div><p className="mig-eyebrow">MỖI NGÀY MỘT BƯỚC TIẾN</p><h1>Sổ tay học tập</h1></div><div className="mig-notebook-file-actions"><NotebookImport store={store} expectedRaw={lastRaw.current} blocked={!!storageNotice} onApplied={(next,raw)=>{lastRaw.current=raw;setStore(next);setNotice('Đã ghép bản lưu. Các mục có trước được giữ nguyên.');}}/><button type="button" className="mig-button outline" onClick={exportData}><Download size={17}/>Xuất bản lưu</button></div></div>
  <div className="mig-local-notice"><CalendarDays size={22}/><div><b>Bản nháp cá nhân trên trình duyệt này</b><p>Chưa đồng bộ tài khoản hoặc gửi giáo viên. Phần đang gõ được phục hồi khi tải lại trong chính thẻ này; đóng thẻ hoặc xóa dữ liệu trình duyệt vẫn có thể làm mất bản nháp. Không nhập thông tin nhạy cảm trên máy dùng chung.</p><span>Đồng bộ tài khoản đang chờ tích hợp trực tiếp trên MTM; không mở hệ thống cũ thay thế.</span></div></div>
  {(storageNotice||error||draftStorageError)&&<p role="alert" className="mig-error">{error||storageNotice||draftStorageError}</p>}
  <div className="mig-notebook-stats"><article><span>Ngày đã lên kế hoạch</span><b>{monthTasks.filter(([,t])=>t.length).length}</b></article><article><span>Việc đã hoàn thành</span><b>{completed.length}</b></article><article><span>Phút theo các việc đã đánh dấu</span><b>{completed.reduce((s,t)=>s+t.minutes,0)}</b></article></div>
  <div className="mig-notebook-grid">
   <section className="mig-panel"><div className="mig-calendar-heading"><h2>Tháng {month.getMonth()+1}, {month.getFullYear()}</h2><div><button type="button" className="mig-icon-button" aria-label="Tháng trước" onClick={()=>move(-1)}><ChevronLeft/></button><button type="button" className="mig-icon-button" aria-label="Tháng sau" onClick={()=>move(1)}><ChevronRight/></button></div></div>
    <div className="mig-calendar" role="group" aria-label="Chọn ngày lập kế hoạch">{['T.2','T.3','T.4','T.5','T.6','T.7','CN'].map(d=><span className="mig-calendar-weekday" key={d}>{d}</span>)}{days.map(d=>{const key=keyFor(d),has=(store.days[key]||[]).length>0;return <button ref={node=>{if(node)calendarButtons.current.set(key,node);else calendarButtons.current.delete(key);}} type="button" key={key} tabIndex={date===key?0:-1} className={(d.getMonth()!==month.getMonth()?'is-outside ':'')+(key===keyFor(today)?'is-today':'')} aria-pressed={date===key} aria-label={key+(has?' — đã có kế hoạch':'')} onClick={()=>confirmDayChange(key)} onKeyDown={e=>moveCalendarFocus(e,d)}>{d.getDate()}<span className={has?'has-plan':''}/></button>;})}</div>
    <p className="mig-calendar-legend"><span/> Đã lên kế hoạch · Viền vàng: hôm nay</p><button type="button" className="mig-button primary full" onClick={todayPlan}>Kế hoạch hôm nay <ChevronRight size={16}/></button>
    <div className="mig-month-goal"><h3>Mục tiêu tháng {month.getMonth()+1}</h3><label className="mig-field"><span className="mig-sr-only">Mục tiêu trong tháng</span><textarea maxLength={2000} rows={4} placeholder="Viết mục tiêu cụ thể, vừa sức và kiểm tra được…" value={goalDraft??store.goals[monthKey]??''} onChange={e=>setGoalDraft(e.target.value)}/></label><button type="button" className="mig-text-button" onClick={()=>{if(persist({...store,goals:{...store.goals,[monthKey]:(goalDraft??store.goals[monthKey]??'').trim()}},'Đã lưu mục tiêu tháng trên trình duyệt.'))setGoalDraft(null);}}><Save size={16}/>Lưu mục tiêu</button></div>
   </section>
   <section className="mig-panel"><div className="mig-calendar-heading"><div><p className="mig-eyebrow">KẾ HOẠCH TRONG NGÀY</p><h2>{date.split('-').reverse().join('/')}</h2></div><CheckCircle2 size={26}/></div>
    <form onSubmit={e=>{e.preventDefault();if(!title.trim())return;if(tasks.length>=30){setError('Mỗi ngày tối đa 30 việc.');return;}if(persist({...store,days:{...store.days,[date]:[...tasks,{id:crypto.randomUUID(),text:title.trim(),minutes,done:false}]}},'Đã thêm việc vào bản nháp trên trình duyệt.'))setTitle('');}}><label className="mig-field">Việc cần làm<input maxLength={400} value={title} required placeholder="Ví dụ: Ôn lại điều kiện xác định của hàm số" onChange={e=>setTitle(e.target.value)}/></label><div className="mig-task-add"><label className="mig-field">Dự kiến (phút)<input type="number" min={0} max={1440} step={1} value={minutes} onChange={e=>setMinutes(Number(e.target.value))}/></label><button className="mig-button gold" type="submit"><Plus size={17}/>Thêm việc</button></div></form>
    <div className="mig-task-list">{tasks.length?tasks.map(t=><article key={t.id} className={t.done?'done':''}>{editingId===t.id?<div className="mig-task-edit"><label className="mig-field">Nội dung việc<input autoFocus maxLength={400} value={editingText} onChange={e=>setEditingText(e.target.value)}/></label><label className="mig-field">Dự kiến (phút)<input type="number" min={0} max={1440} step={1} value={editingMinutes} onChange={e=>setEditingMinutes(Number(e.target.value))}/></label><div className="mig-task-edit-actions"><button type="button" className="mig-button primary" onClick={()=>saveEdit(t)}><Save size={15}/>Lưu thay đổi</button><button type="button" className="mig-button outline" onClick={()=>{setEditingId(null);setEditingText('');setError('');}}><X size={15}/>Hủy sửa</button></div></div>:<><label><input type="checkbox" checked={t.done} onChange={e=>update(tasks.map(x=>x.id===t.id?{...x,done:e.target.checked}:x))}/><span>{t.text}<small>{t.minutes} phút dự kiến</small></span></label><div className="mig-task-actions"><button type="button" className="mig-icon-button" aria-label={'Sửa việc '+t.text} onClick={()=>startEdit(t)}><Pencil size={16}/></button><button type="button" className="mig-icon-button" aria-label={'Xóa việc '+t.text} onClick={()=>{if(confirm('Xóa việc này khỏi bản nháp?'))update(tasks.filter(x=>x.id!==t.id),'Đã xóa việc khỏi bản nháp trên trình duyệt.');}}><Trash2 size={16}/></button></div></>}</article>):<div className="mig-empty"><CalendarDays size={34}/><h3>Một ngày mới, một kế hoạch mới</h3><p>Thêm việc đầu tiên và đánh dấu khi em đã hoàn thành.</p></div>}</div>
    <p role="status" aria-live="polite" className="mig-saved-note">{notice}</p>
   </section>
  </div>
 </div>;
}

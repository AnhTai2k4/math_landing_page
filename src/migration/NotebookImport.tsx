import {useEffect,useRef,useState} from 'react';
import {Upload,X,ShieldCheck} from 'lucide-react';
import {planNotebookImport,applyNotebookImport,type NotebookImportPlan} from './notebook-restore';
import type {Store} from './notebook-store';
type Props={store:Store;expectedRaw:string|null;blocked:boolean;onApplied:(next:Store,raw:string)=>void};
export default function NotebookImport({store,expectedRaw,blocked,onApplied}:Props){
 const input=useRef<HTMLInputElement>(null),dialog=useRef<HTMLDialogElement>(null),sequence=useRef(0);
 const [loading,setLoading]=useState(false),[error,setError]=useState(''),[prepared,setPrepared]=useState<{name:string;rawAtPreview:string|null;plan:NotebookImportPlan}|null>(null);
 useEffect(()=>{if(prepared&&!dialog.current?.open)dialog.current?.showModal();},[prepared]);
 function close(){dialog.current?.close();setPrepared(null);setError('');}
 async function inspect(file:File){
  const current=++sequence.current;setLoading(true);setError('');
  try{
   if(file.size>1000000)throw new Error('Chỉ nhận tệp JSON tối đa 1 MB. Chưa thay đổi bản lưu.');
   const raw=await file.text();if(current!==sequence.current)return;
   const plan=planNotebookImport(store,raw);setPrepared({name:file.name,rawAtPreview:expectedRaw,plan});
  }catch(e){setError(e instanceof Error?e.message:'Không đọc được tệp. Bản đang dùng vẫn được giữ nguyên.');}
  finally{if(current===sequence.current)setLoading(false);if(input.current)input.current.value='';}
 }
 function apply(){
  if(!prepared)return;
  try{const saved=applyNotebookImport(localStorage,prepared.rawAtPreview,prepared.plan);onApplied(prepared.plan.next!,saved);close();}
  catch(e){setError(e instanceof Error?e.message:'Chưa ghép được dữ liệu. Bản hiện có không bị thay thế.');}
 }
 return <div className="mig-notebook-import">
  <input ref={input} type="file" accept=".json,application/json" aria-label="Chọn bản lưu sổ tay JSON" className="mig-sr-only" tabIndex={-1} disabled={blocked||loading} onChange={e=>{const file=e.target.files?.[0];if(file)void inspect(file);}}/>
  <button type="button" className="mig-button outline" disabled={blocked||loading} onClick={()=>input.current?.click()}><Upload size={17}/>{loading?'Đang kiểm tệp…':'Nhập bản lưu'}</button>
  {error&&!prepared&&<p className="mig-import-inline-error" role="alert">{error}</p>}
  <dialog ref={dialog} className="mig-dialog" aria-labelledby="mig-import-title" onCancel={close} onClick={e=>{if(e.target===dialog.current)close();}}>
   <div className="mig-dialog-inner"><button type="button" className="mig-icon-button mig-close" aria-label="Đóng nhập bản lưu" onClick={close}><X/></button>
    <p className="mig-eyebrow">KIỂM TRƯỚC KHI GHI</p><h2 id="mig-import-title">Ghép bản lưu sổ tay</h2>
    <p className="mig-muted">Tệp: <b>{prepared?.name}</b>. Tệp chỉ được đọc trên trình duyệt này, không gửi lên máy chủ.</p>
    {prepared&&<><dl className="mig-import-counts"><div><dt>Việc mới</dt><dd>{prepared.plan.addedTasks}</dd></div><div><dt>Mục tiêu mới</dt><dd>{prepared.plan.addedGoals}</dd></div><div><dt>Mục đã có, giữ nguyên</dt><dd>{prepared.plan.duplicates}</dd></div></dl>
     {prepared.plan.conflicts.length?<div className="mig-error" role="alert"><b>Có {prepared.plan.conflicts.length} mục trùng nhưng khác nội dung.</b><p>Chưa ghép bất kỳ mục nào. Bản hiện tại và tệp gốc được giữ nguyên.</p><ul>{prepared.plan.conflicts.slice(0,8).map((c,i)=><li key={i}>{c.kind==='goal'?'Mục tiêu tháng':'Việc trong ngày'}: {c.key}</li>)}</ul></div>:<p className="mig-import-safe"><ShieldCheck size={18}/>Chỉ thêm mục mới; không thay thế việc hoặc mục tiêu đã có.</p>}
     {error&&<p role="alert" className="mig-error">{error}</p>}
     <div className="mig-import-actions"><button type="button" className="mig-button outline" onClick={close}>Hủy</button><button type="button" className="mig-button primary" disabled={!prepared.plan.next||!!prepared.plan.conflicts.length||!prepared.plan.addedTasks&&!prepared.plan.addedGoals} onClick={apply}>Xác nhận ghép</button></div>
    </>}
   </div>
  </dialog>
 </div>;
}

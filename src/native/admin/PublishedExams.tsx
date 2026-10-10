import React,{useEffect,useState} from 'react';
import NativeExams from '../NativeExams';
import {PRACTICE_EXAMS,type PracticeExam} from '../exams/data';
import {backend,hydrate,publishedExams} from './backend';
export default function PublishedExams({pathname,search}:{pathname:string;search:string}){
 const [active,setActive]=useState<PracticeExam[]>([]),[history,setHistory]=useState<PracticeExam[]>([]),[message,setMessage]=useState(''),[loading,setLoading]=useState(!!backend());
 useEffect(()=>{if(!backend())return;let alive=true;async function refresh(){try{const rows=await publishedExams(),resolved=await Promise.allSettled(rows.filter(row=>row.visible).map(hydrate));if(alive){setActive(resolved.flatMap(r=>r.status==='fulfilled'?[r.value]:[]));setHistory(rows.map(r=>r.exam));setMessage(resolved.some(r=>r.status==='rejected')?'Một đề mới chưa tải được PDF. Các đề khác vẫn làm được.':'');}}catch(e){if(alive)setMessage((e as Error).message);}finally{if(alive)setLoading(false);}}void refresh();const interval=window.setInterval(()=>void refresh(),55*60*1000);return()=>{alive=false;clearInterval(interval);};},[]);
 if(pathname.startsWith('/thi-thu/mtm-custom-')&&loading)return <section className="ep-card" aria-busy="true"><h1>Đang tải đề đã đăng</h1><p role="status">Đang lấy phiên bản và PDF để mở bài.</p></section>;
 if(pathname.startsWith('/thi-thu/mtm-custom-')&&message&&!active.some(e=>pathname===`/thi-thu/${e.id}`))return <section className="ep-card"><h1>Chưa tải được đề</h1><p role="status">{message}</p><button type="button" onClick={()=>window.location.reload()}>Thử tải lại</button></section>;
 return <>{message&&<p className="ep-notice" role="status">{message}</p>}<NativeExams pathname={pathname} search={search} catalog={[...PRACTICE_EXAMS,...active]} historyCatalog={[...PRACTICE_EXAMS,...history]}/></>;
}

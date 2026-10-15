import {useEffect,useState} from 'react';
import './leaderboard.css';
export type RankRow={rank:number;fullName:string;className:string;score:number;submitted:number;total:number};
export const rankEmpty='Bảng xếp hạng bắt đầu từ 15/10/2026. Chưa có bài trong kỳ này.';
const tabs=[['btvn-tuan','BTVN tuần'],['btvn-thang','BTVN tháng'],['kiem-tra-thang','Kiểm tra cuối tháng']] as const;
export function RankContent({rows,status}:{rows:RankRow[];status:'loading'|'ready'|'error'}){
 if(status==='loading')return <p role="status">Đang tải bảng xếp hạng…</p>;
 if(status==='error')return <p role="alert">Chưa tải được bảng xếp hạng. Vui lòng thử lại.</p>;
 if(!rows.length)return <p>{rankEmpty}</p>;
 return <ol className="mtm-rank-list">{rows.map(row=><li key={row.rank} className={row.rank<=3?'mtm-rank-top':''}><b className="mtm-rank-place" aria-label={'Hạng '+row.rank}>{row.rank}</b><div><strong>{row.fullName}</strong><small>{row.className} · Đã nộp {row.submitted}/{row.total} bài</small></div><b className="mtm-rank-score">{row.score.toLocaleString('vi-VN',{maximumFractionDigits:2})}<small>/10</small></b></li>)}</ol>;
}
export default function HomeLeaderboard({compact=false}:{compact?:boolean}){
 const [expanded,setExpanded]=useState(false);
 const [cohort,setCohort]=useState('2K9'),[kind,setKind]=useState('btvn-tuan'),[rows,setRows]=useState<RankRow[]>([]),[status,setStatus]=useState<'loading'|'ready'|'error'>('loading'),[enabled,setEnabled]=useState(true),[retry,setRetry]=useState(0);
 const [secondary,setSecondary]=useState<string[]>([]);
 useEffect(()=>{
  if(!enabled||compact)return;const controller=new AbortController();
  // Bản đầy đủ chỉ hiện thêm khối THCS khi có dữ liệu.
  Promise.all(['2K12','2K13','2K14'].map(async c=>{
   try{const response=await fetch('/api/xep-hang?khoi='+c+'&loai='+kind,{credentials:'omit',signal:controller.signal});if(!response.ok)return null;const data=await response.json();return data.enabled&&Array.isArray(data.rows)&&data.rows.length?c:null;}catch{return null;}
  })).then(list=>{if(!controller.signal.aborted)setSecondary(previous=>[...new Set([...previous,...list.filter((c):c is string=>c!==null)])]);});
  return()=>controller.abort();
 },[kind,enabled,compact]);
 useEffect(()=>{const controller=new AbortController();setExpanded(false);setRows([]);setStatus('loading');
  fetch('/api/xep-hang?khoi='+cohort+'&loai='+kind,{credentials:'omit',signal:controller.signal}).then(async response=>{if(!response.ok)throw Error();const data=await response.json();if(typeof data.enabled!=='boolean'||!Array.isArray(data.rows))throw Error();if(!controller.signal.aborted){setEnabled(data.enabled);setRows(data.rows);setStatus('ready');}}).catch(()=>{if(!controller.signal.aborted)setStatus('error');});
  return()=>controller.abort();
 },[cohort,kind,retry]);
 if(!enabled)return null;
 return <section className={compact?"mtm-rank mtm-rank-compact":"mig-container mtm-rank"} aria-labelledby="mtm-rank-title"><header><div><p className="mtm-rank-eyebrow">CÙNG NHAU TIẾN BỘ</p><h2 id="mtm-rank-title">Bảng xếp hạng</h2><p>Ghi nhận sự cố gắng của các em tại Minh Thành Math.</p></div><label>Khối <select value={cohort} onChange={event=>setCohort(event.target.value)}>{['2K9','2K10','2K11',...secondary].map(c=><option key={c}>{c}</option>)}</select></label></header><div className="mtm-rank-tabs" role="group" aria-label="Chọn bảng xếp hạng">{tabs.map(([id,title])=><button type="button" key={id} aria-pressed={kind===id} onClick={()=>setKind(id)}>{title}</button>)}</div><p className="mtm-rank-period">{kind==='btvn-tuan'?'Tuần hiện tại, thứ Hai đến Chủ nhật':'Tháng dương lịch hiện tại'} · Giờ Việt Nam</p><div aria-live="polite"><RankContent rows={rows.slice(0,compact&&!expanded?5:10)} status={status}/></div>{compact&&status==='ready'&&rows.length>5&&<button type="button" aria-expanded={expanded} onClick={()=>setExpanded(value=>!value)}>{expanded?'Thu gọn top 5':'Xem top 10'}</button>}{status==='error'&&<button type="button" onClick={()=>setRetry(n=>n+1)}>Thử lại</button>}<p className="mtm-rank-note">{kind==='kiem-tra-thang'?'Ưu tiên điểm thi trên web khi có cả điểm thi giấy.':'Điểm trung bình các bài được giao trong kỳ; bài chưa làm tính 0, nộp muộn vẫn tính điểm.'}</p></section>;
}

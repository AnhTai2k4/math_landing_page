import {LoadingCards} from '../../components/LoadingCards';
import {useEffect,useState} from 'react';
import './leaderboard.css';
export type RankRow={rank:number;fullName?:string;className:string;score:number;submitted:number;total:number};
export const rankEmpty='Bảng xếp hạng bắt đầu từ 15/10/2026. Chưa có bài trong kỳ này.';
const tabs=[['btvn-tuan','Tuần này'],['btvn-thang','Tháng này'],['kiem-tra-thang','Kiểm tra cuối tháng']] as const;
const classes:Record<string,string[]>={'2K9':['2K9 9+','2K9 8+','2K9 XPT','2K9 HSA (THỨ 5)','2K9 HSA (CN)'],'2K10':['2K10 9+','2K10 8+','2K10 XPT','2K10 Thứ 3, 6'],'2K11':['2K11 9+','2K11 8+','2K11 XPT']};
const score=(row:RankRow)=>row.score.toLocaleString('vi-VN',{maximumFractionDigits:2});
export function RankContent({rows,status,own=false}:{rows:RankRow[];status:'loading'|'ready'|'error';own?:boolean}){
 if(status==='loading')return <LoadingCards label="Đang tải bảng xếp hạng…"/>;
 if(status==='error')return <p role="alert">Chưa tải được bảng xếp hạng. Vui lòng thử lại.</p>;
 if(!rows.length)return <p>{rankEmpty}</p>;
 return <ol className="mtm-rank-list">{rows.map(row=><li key={row.rank} className={row.rank<=3?'mtm-rank-top':''}><b className="mtm-rank-place" aria-label={'Hạng '+row.rank}>{row.rank}</b><div><strong>{own&&row.fullName?row.fullName:'Học sinh MTM'}</strong><small>{row.className} · Đã nộp {row.submitted}/{row.total} bài</small></div><b className="mtm-rank-score">{score(row)}<small>/10</small></b></li>)}</ol>;
}
export default function HomeLeaderboard({compact=false}:{compact?:boolean}){
 const [expanded,setExpanded]=useState(false);
 const [cohort,setCohort]=useState('2K9'),[kind,setKind]=useState('btvn-tuan'),[cls,setClass]=useState(''),[rows,setRows]=useState<RankRow[]>([]),[status,setStatus]=useState<'loading'|'ready'|'error'>('loading'),[enabled,setEnabled]=useState(true),[retry,setRetry]=useState(0);
 const [own,setOwn]=useState<{state:'guest'|'ready'|'error';row:RankRow|null}>({state:'guest',row:null});
 useEffect(()=>{const controller=new AbortController();setExpanded(false);setRows([]);setStatus('loading');
  // Giữ URL đơn giản tương thích thẻ compact và cache công khai.
  const url='/api/xep-hang?khoi='+cohort+'&loai='+kind+(cls?'&lop='+encodeURIComponent(cls):'');
  fetch(url,{credentials:'omit',signal:controller.signal}).then(async response=>{if(!response.ok)throw Error();const data=await response.json();if(typeof data.enabled!=='boolean'||!Array.isArray(data.rows))throw Error();if(!controller.signal.aborted){setEnabled(data.enabled);setRows(data.rows);setStatus('ready');}}).catch(()=>{if(!controller.signal.aborted)setStatus('error');});
  return()=>controller.abort();
 },[cohort,kind,cls,retry]);
 useEffect(()=>{
  if(compact)return;const controller=new AbortController();setOwn({state:'guest',row:null});
  fetch('/api/xep-hang-cua-em',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({khoi:cohort,loai:kind,...(cls?{lop:cls}:{})}),signal:controller.signal}).then(async response=>{if(response.status===401)return;if(!response.ok)throw Error();const data=await response.json();if(!controller.signal.aborted)setOwn({state:'ready',row:data.row??null});}).catch(()=>{if(!controller.signal.aborted)setOwn({state:'error',row:null});});
  return()=>controller.abort();
 },[compact,cohort,kind,cls,retry]);
 if(!enabled)return null;
 const titleId=compact?'mtm-rank-title':'mtm-rank-full-title';
 return <section className={compact?'mtm-rank mtm-rank-compact':'mtm-rank mtm-rank-full'} aria-labelledby={titleId}><div className={compact?undefined:'mig-container mtm-rank-inner'}><header><div><p className="mtm-rank-eyebrow">CÙNG NHAU TIẾN BỘ</p><h2 id={titleId}>Bảng xếp hạng</h2><p>Ghi nhận sự cố gắng của các em tại Minh Thành Math.</p></div>{compact?<label>Khối <select value={cohort} onChange={event=>setCohort(event.target.value)}>{Object.keys(classes).map(c=><option key={c}>{c}</option>)}</select></label>:<label>Lớp <select value={cls} onChange={event=>setClass(event.target.value)}><option value="">Tất cả lớp trong khối</option>{classes[cohort].map(c=><option key={c}>{c}</option>)}</select></label>}</header>{!compact&&<div className="mtm-rank-cohorts" role="group" aria-label="Chọn khối">{Object.keys(classes).map(c=><button type="button" key={c} aria-pressed={cohort===c} onClick={()=>{setCohort(c);setClass('');}}>{c}</button>)}</div>}<div className="mtm-rank-tabs" role="group" aria-label="Chọn kỳ xếp hạng">{tabs.map(([id,title])=><button type="button" key={id} aria-pressed={kind===id} onClick={()=>setKind(id)}>{compact?(id==='btvn-tuan'?'BTVN tuần':id==='btvn-thang'?'BTVN tháng':title):title}</button>)}</div><p className="mtm-rank-period">{kind==='btvn-tuan'?'Tuần hiện tại, thứ Hai đến Chủ nhật':'Tháng dương lịch hiện tại'} · Giờ Việt Nam</p><div aria-live="polite">{!compact&&status==='ready'&&rows.length>0&&<div className="mtm-rank-podium" aria-label="Vinh danh top 3">{rows.slice(0,3).map(row=><article key={row.rank} className={'mtm-rank-medal mtm-rank-medal-'+row.rank}><span>Hạng {row.rank}</span><h3>Học sinh MTM</h3><p>{row.className}</p><strong>{score(row)} <small>/10</small></strong><p>Đã nộp {row.submitted}/{row.total} bài</p></article>)}</div>}{!compact&&status==='ready'&&rows.length>0&&<h3>Top 10 · Điểm trung bình</h3>}<RankContent rows={rows.slice(0,compact&&!expanded?5:10)} status={status}/></div>{compact&&status==='ready'&&rows.length>5&&<button type="button" aria-expanded={expanded} onClick={()=>setExpanded(v=>!v)}>{expanded?'Thu gọn top 5':'Xem top 10'}</button>}{compact?<a className="mtm-rank-full-link" href="#bang-xep-hang">Xem bảng đầy đủ ↓</a>:<div className="mtm-rank-own" aria-live="polite"><h3>Hạng của em</h3>{own.state==='guest'?<p><a href="/btvn">Đăng nhập BTVN</a> để xem hạng của em, kể cả ngoài top 10.</p>:own.state==='error'?<p>Chưa tải được hạng của em. <button type="button" onClick={()=>setRetry(n=>n+1)}>Thử lại</button></p>:own.row?<RankContent rows={[own.row]} status="ready" own/>:<p>Em chưa có hạng trong kỳ và bộ lọc này.</p>}</div>}{status==='error'&&<button type="button" onClick={()=>setRetry(n=>n+1)}>Thử lại</button>}<p className="mtm-rank-note">{kind==='kiem-tra-thang'?'Ưu tiên điểm thi trên web khi có cả điểm thi giấy.':'Điểm trung bình các bài được giao trong kỳ; bài chưa làm tính 0, nộp muộn vẫn tính điểm.'}</p></div></section>;
}

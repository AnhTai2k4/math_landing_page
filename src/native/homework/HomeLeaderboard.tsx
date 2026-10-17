import {LoadingCards} from '../../components/LoadingCards';
import {useEffect,useRef,useState} from 'react';
import './leaderboard.css';
import './r104-leaderboard.css';
import './leaderboard-refresh.css';
import {StudentAvatar} from '../../components/StudentAppearance';
import {DEFAULT_APPEARANCE,type StudentAppearance} from '../../components/student-appearance';
import {requestLeaderboard,subscribeLeaderboardRefresh} from './leaderboard-refresh';
export type RankRow={rank:number;fullName?:string;className:string;school?:string|null;avatar?:StudentAppearance['avatar']|null;photo?:string|null;score:number;submitted:number;total:number};
export const rankEmpty='Bảng xếp hạng bắt đầu từ 15/10/2026. Chưa có bài trong kỳ này.';
const tabs=[['btvn-tuan','Tuần này'],['btvn-thang','Tháng này'],['kiem-tra-thang','Kiểm tra cuối tháng']] as const;
const classes:Record<string,string[]>={'2K9':['2K9 9+','2K9 8+','2K9 XPT','2K9 HSA (THỨ 5)','2K9 HSA (CN)'],'2K10':['2K10 9+','2K10 8+','2K10 XPT','2K10 Thứ 3, 6'],'2K11':['2K11 9+','2K11 8+','2K11 XPT']};
const score=(row:RankRow)=>row.score.toLocaleString('vi-VN',{maximumFractionDigits:2});
const appearance=(row:RankRow):StudentAppearance=>({avatar:row.avatar??DEFAULT_APPEARANCE.avatar,photo:row.photo??''});
const school=(row:RankRow)=>row.school?.trim()||'';
export function RankContent({rows,status,own=false}:{rows:RankRow[];status:'loading'|'ready'|'error';own?:boolean}){
 if(status==='loading')return <LoadingCards label="Đang tải bảng xếp hạng…"/>;
 if(status==='error')return <p role="alert">Chưa tải được bảng xếp hạng. Vui lòng thử lại.</p>;
 if(!rows.length)return <p>{rankEmpty}</p>;
 return <ol className={'mtm-rank-list'+(own?' mtm-rank-list-own':'')}>{rows.map(row=><li key={row.rank} className={row.rank<=3?'mtm-rank-top':''}><b className="mtm-rank-place" aria-label={'Hạng '+row.rank}>{row.rank}</b><StudentAvatar appearance={appearance(row)} size={own?44:42}/><div className="mtm-rank-identity"><strong>{row.fullName||'Học sinh MTM'}</strong><small className="mtm-rank-class">{row.className}</small>{school(row)&&<small className="mtm-rank-school">{school(row)}</small>}<small className="mtm-rank-submitted">Đã nộp {row.submitted}/{row.total} bài</small></div><b className="mtm-rank-score">{score(row)}<small>/10</small></b></li>)}</ol>;
}
export default function HomeLeaderboard({compact=false}:{compact?:boolean}){
 const [expanded,setExpanded]=useState(false);
 const [cohort,setCohort]=useState('2K9'),[kind,setKind]=useState('btvn-tuan'),[cls,setClass]=useState(''),[rows,setRows]=useState<RankRow[]>([]),[status,setStatus]=useState<'loading'|'ready'|'error'>('loading'),[enabled,setEnabled]=useState(true),[retry,setRetry]=useState(0);
 const [own,setOwn]=useState<{state:'guest'|'ready'|'error';row:RankRow|null}>({state:'guest',row:null});
 const ownGeneration=useRef(0),publicGeneration=useRef(0),publicQuery=useRef(''),ownQuery=useRef(''),publicSnapshot=useRef(''),ownSnapshot=useRef('');
 const [update,setUpdate]=useState(0);
 const filterKey=cohort+'|'+kind+'|'+cls,latestFilter=useRef(filterKey);latestFilter.current=filterKey;
 useEffect(()=>subscribeLeaderboardRefresh(event=>{
  ownGeneration.current++;publicGeneration.current++;
  if(event.reason==='session'){ownSnapshot.current='';setOwn({state:'guest',row:null});}
  setRetry(n=>n+1);
 }),[]);
 useEffect(()=>setExpanded(false),[cohort,kind,cls]);
 useEffect(()=>{const controller=new AbortController(),generation=++publicGeneration.current;
  // Hồ sơ vừa lưu được đọc lại ngay, không dùng bản cache của bảng công khai.
  const url='/api/xep-hang?khoi='+cohort+'&loai='+kind+(cls?'&lop='+encodeURIComponent(cls):'');
  if(publicQuery.current!==url){publicQuery.current=url;publicSnapshot.current='';setRows([]);setStatus('loading');}
  requestLeaderboard<{enabled:boolean;rows:RankRow[]}>(url,{credentials:'omit'}).then(response=>{const data=response.data;if(!response.ok||!data||typeof data.enabled!=='boolean'||!Array.isArray(data.rows))throw Error();if(!controller.signal.aborted&&generation===publicGeneration.current&&latestFilter.current===filterKey){const next=JSON.stringify(data.rows);if(publicSnapshot.current&&publicSnapshot.current!==next)setUpdate(n=>n+1);publicSnapshot.current=next;setEnabled(data.enabled);setRows(data.rows);setStatus('ready');}}).catch(()=>{if(!controller.signal.aborted&&generation===publicGeneration.current&&latestFilter.current===filterKey)setStatus('error');});
  return()=>controller.abort();
 },[cohort,kind,cls,retry]);
 useEffect(()=>{
  if(compact)return;const controller=new AbortController(),generation=++ownGeneration.current;
  const body=JSON.stringify({khoi:cohort,loai:kind,...(cls?{lop:cls}:{})});
  if(ownQuery.current!==body){ownQuery.current=body;ownSnapshot.current='';setOwn({state:'guest',row:null});}
  requestLeaderboard<{row:RankRow|null}>('/api/xep-hang-cua-em',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body}).then(response=>{if(controller.signal.aborted||generation!==ownGeneration.current||latestFilter.current!==filterKey)return;if(response.status===401||response.status===403){ownSnapshot.current='';setOwn({state:'guest',row:null});return;}const data=response.data;if(!response.ok||!data)throw Error();const next=JSON.stringify(data.row??null);if(ownSnapshot.current&&ownSnapshot.current!==next)setUpdate(n=>n+1);ownSnapshot.current=next;setOwn({state:'ready',row:data.row??null});}).catch(()=>{if(!controller.signal.aborted&&generation===ownGeneration.current&&latestFilter.current===filterKey)setOwn({state:'error',row:null});});
  return()=>controller.abort();
 },[compact,cohort,kind,cls,retry]);
 if(!enabled)return null;
 const titleId=compact?'mtm-rank-title':'mtm-rank-full-title';
 const refreshed=update?(update%2?' mtm-rank-refresh-odd':' mtm-rank-refresh-even'):'';
 const officialNote='Chỉ điểm đã chấm đủ mới tính hạng chính thức. Điểm tạm tính của bài tự luận hoặc nộp vở đang chờ chấm chưa tính vào hạng.';
 if(!compact)return <section id="home-leaderboard" className={'mtm-rank r104-rank'+refreshed} aria-labelledby={titleId}>
  <div className="r104-rank-surface">
   <header className="r104-rank-head"><h2 id={titleId}>Bảng xếp hạng<span>.</span></h2><div className="r104-rank-filters"><div className="mtm-rank-cohorts" role="group" aria-label="Chọn khối">{Object.keys(classes).map(c=><button type="button" key={c} aria-pressed={cohort===c} onClick={()=>{setCohort(c);setClass('');}}>{c}</button>)}</div><label className="r104-rank-kind"><span className="r104-sr-only">Kỳ xếp hạng</span><select value={kind} onChange={e=>setKind(e.target.value)}>{tabs.map(([value,label])=><option value={value} key={value}>{value==='btvn-tuan'?'BTVN tuần':value==='btvn-thang'?'BTVN tháng':label}</option>)}</select></label></div><label className="r104-rank-class"><span className="r104-sr-only">Lớp</span><select value={cls} onChange={event=>setClass(event.target.value)}><option value="">Tất cả lớp trong khối</option>{classes[cohort].map(c=><option key={c}>{c}</option>)}</select></label></header>
   <div className="r104-podium" aria-label="Vinh danh top 3" aria-live="polite">{status==='loading'?<p role="status">Đang tải bảng xếp hạng…</p>:status==='error'?<p role="alert">Chưa tải được bảng xếp hạng. <button type="button" onClick={()=>setRetry(n=>n+1)}>Thử lại</button></p>:!rows.length?<p>{rankEmpty}</p>:[1,0,2].map(i=>{const row=rows[i];return row?<article key={row.rank} className={'mtm-rank-medal mtm-rank-medal-'+row.rank}><StudentAvatar appearance={appearance(row)} size={row.rank===1?72:64}/><strong title={row.fullName}>{row.fullName||'Học sinh MTM'}</strong><small className="r104-medal-class">{row.className}</small>{school(row)&&<small className="r104-medal-school">{school(row)}</small>}<span className="r104-medal-score">{score(row)}<small>/10</small></span><div className="r104-podium-plinth"><span>Hạng {row.rank}</span></div></article>:null;})}</div>
   <aside className="r104-rank-own" aria-live="polite"><h3>Hạng của em</h3>{own.state==='guest'?<><StudentAvatar/><p>Vào BTVN để xem điểm và hạng của em.</p><a href="/btvn">Vào góc học tập ↗</a></>:own.state==='error'?<p>Chưa tải được hạng. <button type="button" onClick={()=>setRetry(n=>n+1)}>Thử lại</button></p>:own.row?<RankContent rows={[own.row]} status="ready" own/>:<><StudentAvatar/><p>Em chưa có hạng trong kỳ và bộ lọc này.</p><a href="/btvn">Vào góc học tập ↗</a></>}</aside>
   <div className="r104-rank-bottom"><span>{kind==='btvn-tuan'?'Tuần hiện tại':'Tháng hiện tại'} · Giờ Việt Nam</span><button type="button" aria-expanded={expanded} aria-controls="r104-top-ten" onClick={()=>setExpanded(v=>!v)}>{expanded?'Thu gọn':'Top 10'} <span aria-hidden="true">↗</span></button></div>
  </div><p className="mtm-rank-note mtm-rank-official-note">{officialNote}</p><div id="r104-top-ten" className={'r104-top-ten'+(expanded?' is-open':'')} aria-hidden={!expanded} ref={element=>{if(element)element.inert=!expanded;}}><div><h3>Top 10 · Điểm trung bình</h3><RankContent rows={rows.slice(0,10)} status={status}/><p className="mtm-rank-note">{kind==='kiem-tra-thang'?'Ưu tiên điểm thi trên web khi có cả điểm thi giấy.':'Bài chưa tới hạn mà chưa nộp không tính 0. Điểm và hạng lấy từ hệ thống MTM.'}</p></div></div>
 </section>;
 return <section className={(compact?'mtm-rank mtm-rank-compact':'mtm-rank mtm-rank-full')+refreshed} aria-labelledby={titleId}><div className={compact?undefined:'mig-container mtm-rank-inner'}><header><div><p className="mtm-rank-eyebrow">CÙNG NHAU TIẾN BỘ</p><h2 id={titleId}>Bảng xếp hạng</h2><p>Ghi nhận sự cố gắng của các em tại Minh Thành Math.</p></div>{compact?<label>Khối <select value={cohort} onChange={event=>setCohort(event.target.value)}>{Object.keys(classes).map(c=><option key={c}>{c}</option>)}</select></label>:<label>Lớp <select value={cls} onChange={event=>setClass(event.target.value)}><option value="">Tất cả lớp trong khối</option>{classes[cohort].map(c=><option key={c}>{c}</option>)}</select></label>}</header>{!compact&&<div className="mtm-rank-cohorts" role="group" aria-label="Chọn khối">{Object.keys(classes).map(c=><button type="button" key={c} aria-pressed={cohort===c} onClick={()=>{setCohort(c);setClass('');}}>{c}</button>)}</div>}<div className="mtm-rank-tabs" role="group" aria-label="Chọn kỳ xếp hạng">{tabs.map(([id,title])=><button type="button" key={id} aria-pressed={kind===id} onClick={()=>setKind(id)}>{compact?(id==='btvn-tuan'?'BTVN tuần':id==='btvn-thang'?'BTVN tháng':title):title}</button>)}</div><p className="mtm-rank-period">{kind==='btvn-tuan'?'Tuần hiện tại, thứ Hai đến Chủ nhật':'Tháng dương lịch hiện tại'} · Giờ Việt Nam</p><div aria-live="polite">{!compact&&status==='ready'&&rows.length>0&&<div className="mtm-rank-podium" aria-label="Vinh danh top 3">{rows.slice(0,3).map(row=><article key={row.rank} className={'mtm-rank-medal mtm-rank-medal-'+row.rank}><span>Hạng {row.rank}</span><h3>{row.fullName||'Học sinh MTM'}</h3><p>{row.className}</p><strong>{score(row)} <small>/10</small></strong><p>Đã nộp {row.submitted}/{row.total} bài</p></article>)}</div>}{!compact&&status==='ready'&&rows.length>0&&<h3>Top 10 · Điểm trung bình</h3>}<RankContent rows={rows.slice(0,compact&&!expanded?5:10)} status={status}/></div>{compact&&status==='ready'&&rows.length>5&&<button type="button" aria-expanded={expanded} onClick={()=>setExpanded(v=>!v)}>{expanded?'Thu gọn top 5':'Xem top 10'}</button>}{compact?<a className="mtm-rank-full-link" href="#bang-xep-hang">Xem bảng đầy đủ ↓</a>:<div className="mtm-rank-own" aria-live="polite"><h3>Hạng của em</h3>{own.state==='guest'?<p><a href="/btvn">Đăng nhập BTVN</a> để xem hạng của em, kể cả ngoài top 10.</p>:own.state==='error'?<p>Chưa tải được hạng của em. <button type="button" onClick={()=>setRetry(n=>n+1)}>Thử lại</button></p>:own.row?<RankContent rows={[own.row]} status="ready" own/>:<p>Em chưa có hạng trong kỳ và bộ lọc này.</p>}</div>}{status==='error'&&<button type="button" onClick={()=>setRetry(n=>n+1)}>Thử lại</button>}<p className="mtm-rank-note">{kind==='kiem-tra-thang'?'Ưu tiên điểm thi trên web khi có cả điểm thi giấy.':'Bài chưa tới hạn mà chưa nộp không tính 0; bài quá hạn chưa nộp tính 0, nộp muộn vẫn tính điểm.'} {officialNote}</p></div></section>;
}

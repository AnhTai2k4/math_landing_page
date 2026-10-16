import {useEffect,useState,type ReactNode} from 'react';
import type {HomeworkState} from './btvn-contract';
import type {RankRow} from './HomeLeaderboard';
import {homeworkServerNow} from './asset-renewal';
import {homeworkPriorityDeadline,homeworkPriorityReason,isHomeworkLocked,nextHomework} from './homework-priority';
import {displayClassName,lessonHomeworkTitle} from './presentation';
import './r104-homework.css';

const periods=[['btvn-tuan','BTVN tuần'],['btvn-thang','BTVN tháng'],['kiem-tra-thang','Kiểm tra cuối tháng']] as const;
type RankState={status:'loading'|'ready'|'error'|'guest'|'disabled'|'unsupported';row:RankRow|null};
const dateTime=(at:number)=>new Date(at).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
function validRow(row:unknown):row is RankRow{
  if(!row||typeof row!=='object')return false;
  const r=row as RankRow;
  return Number.isSafeInteger(r.rank)&&r.rank>0&&typeof r.score==='number'&&Number.isFinite(r.score)&&r.score>=0&&r.score<=10&&typeof r.className==='string'&&Number.isInteger(r.submitted)&&r.submitted>=0&&Number.isInteger(r.total)&&r.total>=1&&r.submitted<=r.total;
}

/** Chọn bài chỉ chuyển qua gateway hiện có, không tự tạo lượt làm. */
export default function R104Dashboard({state,busy,onSelect,profileControl}:{state:HomeworkState;busy:boolean;onSelect:(code:string)=>void;profileControl?:ReactNode}){
  const [now,setNow]=useState(Date.now),[kind,setKind]=useState('btvn-tuan'),[retry,setRetry]=useState(0),[priorityNotice,setPriorityNotice]=useState('');
  const [rank,setRank]=useState<RankState>({status:'loading',row:null});
  const clock=homeworkServerNow(state,now),lessons=state.lessons??[],priority=nextHomework(lessons,clock);
  const cohort=/\b(2K(?:9|1[0-4]))\b/i.exec(state.className)?.[1].toUpperCase();
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[]);
  useEffect(()=>{
    const controller=new AbortController();
    if(!cohort){setRank({status:'unsupported',row:null});return()=>controller.abort();}
    setRank({status:'loading',row:null});
    fetch('/api/xep-hang-cua-em',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({khoi:cohort,loai:kind}),signal:controller.signal})
      .then(async response=>{
        if(response.status===401||response.status===403){if(!controller.signal.aborted)setRank({status:'guest',row:null});return;}
        if(!response.ok)throw Error();
        const data=await response.json();
        if(typeof data.enabled!=='boolean'||(data.row!=null&&!validRow(data.row)))throw Error();
        if(!controller.signal.aborted)setRank({status:data.enabled?'ready':'disabled',row:data.row??null});
      }).catch(()=>{if(!controller.signal.aborted)setRank({status:'error',row:null});});
    return()=>controller.abort();
  },[cohort,kind,retry,state.fullName,state.className]);
  const choosePriority=()=>{
    if(busy||!priority)return;
    const fresh=nextHomework(lessons,homeworkServerNow(state));
    if(fresh?.lessonCode!==priority.lessonCode){setNow(Date.now());setPriorityNotice('Gợi ý vừa thay đổi theo giờ lớp. Em kiểm tra lại bài được gợi ý.');return;}
    setPriorityNotice('');onSelect(priority.lessonCode);
  };
  const deadline=priority?homeworkPriorityDeadline(priority):null;
  const submitted=lessons.filter(lesson=>lesson.submittedAt!=null).length;
  const locked=lessons.filter(lesson=>isHomeworkLocked(lesson,clock)).length;
  const available=lessons.filter(lesson=>lesson.available&&!isHomeworkLocked(lesson,clock)&&lesson.submittedAt==null&&(lesson.kind!=='kiem-tra-thang'||(homeworkPriorityDeadline(lesson)!==null&&clock<homeworkPriorityDeadline(lesson)!))).length;
  const recent=[...lessons].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,3);
  return <div className="r104-homework">
    <header className="r104-hw-heading"><p>Học tập <span aria-hidden="true">/</span> Bài tập về nhà</p><h1>Góc học tập của em<span>.</span></h1><p>Việc hôm nay, kết quả và những bước tiếp theo.</p></header>
    <div className="r104-hw-profile"><div>{profileControl}<span><strong>{state.fullName}</strong><small>{displayClassName(state)}</small></span></div><a href="#r104-lesson-list">Các buổi học ↓</a></div>
    <div className="r104-hw-workplane">
      <section className="r104-hw-today" aria-labelledby="r104-today-title">
        <header><span className="r104-hw-overline"><i/>Việc hôm nay</span><small>{priority?'Buổi '+priority.date.slice(8,10)+'/'+priority.date.slice(5,7):'Lịch học của em'}</small></header>
        <div className="r104-hw-today-grid"><div className="r104-hw-today-copy"><p>{displayClassName(state)}</p><h2 id="r104-today-title">{priority?lessonHomeworkTitle(priority):lessons.length?'Em đã xem hết việc cần làm':'Chờ buổi học đầu tiên'}<span>.</span></h2>
          <p>{priority?homeworkPriorityReason(priority,clock):lessons.length?'Em có thể xem lại bài đã nộp và bài giảng trong từng buổi bên dưới.':'Khi thầy giao bài, buổi học và BTVN sẽ xuất hiện tại đây.'}</p>
          {priority&&<><div className="r104-hw-today-facts"><span>Đã mở</span><span>{deadline!==null?(priority.kind==='kiem-tra-thang'?'Đóng: ':'Hạn: ')+dateTime(deadline):'Hạn: chờ xác minh'}</span></div><button type="button" className="r104-hw-primary" disabled={busy} onClick={choosePriority}>Xem bài cần làm <span aria-hidden="true">↗</span></button><p className="r104-hw-select-note">Mở thông tin bài, chưa bắt đầu lượt làm.</p></>}
          <div role="status">{priorityNotice}</div>
        </div><div className="r104-hw-class-snapshot"><p>Từng bước tiến bộ</p><h3>Buổi học của em</h3><dl><div><dt>Đang mở, chưa nộp</dt><dd>{available}</dd></div><div><dt>Đã có bài nộp</dt><dd>{submitted}</dd></div><div><dt>Chưa tới giờ mở</dt><dd>{locked}</dd></div></dl>
          {recent.length>0&&<ol>{recent.map(lesson=><li key={lesson.lessonCode}><span>{lesson.date.slice(8,10)}/{lesson.date.slice(5,7)}</span><div><strong>{lessonHomeworkTitle(lesson)}</strong><small>{isHomeworkLocked(lesson,clock)?'Chưa mở':lesson.submittedAt!=null?'Đã có bài nộp':lesson.available?'Đang mở':'Đang chuẩn bị'}</small></div></li>)}</ol>}
        </div></div>
      </section>
      <aside className="r104-hw-summary" aria-labelledby="r104-hw-summary-title"><h2 id="r104-hw-summary-title">Điểm &amp; hạng của em</h2><label>Kỳ xem<select value={kind} onChange={event=>setKind(event.target.value)}>{periods.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label><p className="r104-hw-period">{kind==='btvn-tuan'?'Tuần hiện tại, thứ Hai đến Chủ nhật':'Tháng dương lịch hiện tại'} · {cohort??displayClassName(state)}</p>
        <div aria-live="polite" aria-busy={rank.status==='loading'}>{rank.status==='ready'&&rank.row?<><dl className="r104-hw-scores"><div><dt>Điểm trung bình<small>Các bài trong kỳ</small></dt><dd>{rank.row.score.toLocaleString('vi-VN',{minimumFractionDigits:2,maximumFractionDigits:2})}<small>/10</small></dd></div><div><dt>Hạng trong khối<small>{cohort}</small></dt><dd>{rank.row.rank}</dd></div></dl><p className="r104-hw-rank-context">Đã nộp {rank.row.submitted}/{rank.row.total} bài trong kỳ.</p></>:<p className="r104-hw-rank-empty">{rank.status==='loading'?'Đang tải điểm và hạng…':rank.status==='guest'?'Phiên xếp hạng cần đăng nhập lại. Em thoát BTVN rồi đăng nhập lại để xem.':rank.status==='disabled'?'Bảng xếp hạng hiện chưa được mở.':rank.status==='unsupported'?'Lớp em chưa có bảng xếp hạng theo khối tại đây.':rank.status==='error'?'Chưa tải được điểm và hạng.':'Em chưa có hạng trong kỳ này.'}</p>}</div>
        {rank.status==='error'&&<button type="button" className="r104-hw-retry" onClick={()=>setRetry(n=>n+1)}>Thử tải lại</button>}
        <details><summary>Điểm này được tính thế nào?</summary><p>{kind==='kiem-tra-thang'?'Ưu tiên điểm thi trên web khi có cả điểm thi giấy.':'Điểm trung bình các bài được giao trong kỳ. Bài chưa tới hạn mà chưa nộp không tính 0; điểm lấy từ hệ thống MTM.'}</p><p>Thời gian tính theo giờ Việt Nam. Điểm từng buổi và lịch sử lượt làm nằm trong phần kết quả của buổi học.</p></details>
      </aside>
    </div>
  </div>;
}

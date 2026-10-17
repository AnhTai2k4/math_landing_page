import {useEffect,useId,useRef,useState} from 'react';
import {STUDY_DAYS_KEY,clearStudyDays,localStudyDay,readStudyDays,saveStudyDays,studyDayOffset,studyDayStats,type StudyDays,type StudyStore} from './self-study-days';
import './study-rhythm.css';
function browserStore():StudyStore|undefined{try{return window.localStorage;}catch{return undefined;}}

export default function HomeworkStudyRhythm(){
  const id=useId(),[today,setToday]=useState(()=>localStudyDay()),[record,setRecord]=useState<StudyDays>(()=>readStudyDays(browserStore())),[notice,setNotice]=useState(''),[confirmClear,setConfirmClear]=useState(false);
  const alive=useRef(true),revision=useRef(0),version=revision.current;
  const pending=useRef(new Map<string,boolean>()),pendingClear=useRef(false);
  const pendingDays=(days:string[])=>{const next=new Set(pendingClear.current?[]:days);for(const [day,mark] of pending.current){if(mark)next.add(day);else next.delete(day);}return [...next].sort();};
  const refreshRecord=(previous:StudyDays,day:string):StudyDays=>{
    const latest=readStudyDays(browserStore(),day);
    if(latest.status==='unavailable')return {...previous,status:'unavailable'};
    if(latest.status==='invalid'&&!pendingClear.current)return latest;
    return {days:pendingDays(latest.days),status:pending.current.size||pendingClear.current?'unavailable':latest.status};
  };
  const persist=(store:StudyStore|undefined,latest=readStudyDays(store)):StudyDays=>{
    if(latest.status==='invalid'&&!pendingClear.current)return latest;
    const days=pendingDays(latest.status==='unavailable'?record.days:latest.days);
    // Không ghi đè một kho chưa đọc được; giữ cả dấu bỏ để lần thử lại không phục hồi nhầm.
    if(latest.status==='unavailable')return {days,status:'unavailable'};
    const next=pendingClear.current&&!days.length?clearStudyDays(store):saveStudyDays(days,store);
    if(next.status==='ready'){pending.current.clear();pendingClear.current=false;}
    return next;
  };
  const act=(run:()=>void)=>{if(!alive.current||revision.current!==version)return;revision.current++;run();};
  useEffect(()=>{
    alive.current=true;
    const refresh=()=>{if(!alive.current)return;const day=localStudyDay();if(day!==today){revision.current++;setToday(day);setRecord(previous=>refreshRecord(previous,day));setConfirmClear(false);setNotice('Ngày trên thiết bị đã đổi. Em kiểm tra hôm nay trước khi tự đánh dấu.');}};
    const storage=(event:StorageEvent)=>{if(alive.current&&(event.key===STUDY_DAYS_KEY||event.key===null)){revision.current++;setRecord(previous=>refreshRecord(previous,localStudyDay()));setNotice('Lịch tự học trên thiết bị vừa được cập nhật ở cửa sổ khác.');setConfirmClear(false);}};
    window.addEventListener('focus',refresh);window.addEventListener('storage',storage);
    const now=new Date(),next=new Date(now.getFullYear(),now.getMonth(),now.getDate()+1).getTime()-now.getTime()+1000;
    const timer=window.setTimeout(refresh,next);
    return()=>{alive.current=false;window.removeEventListener('focus',refresh);window.removeEventListener('storage',storage);window.clearTimeout(timer);};
  },[today]);
  const stats=studyDayStats(record.days,today),days=Array.from({length:7},(_,i)=>studyDayOffset(today,i-6));
  const toggle=(mark:boolean)=>act(()=>{
    const day=localStudyDay();setToday(day);setConfirmClear(false);
    if(day!==today){setRecord(previous=>refreshRecord(previous,day));setNotice('Ngày trên thiết bị đã đổi. Em kiểm tra hôm nay rồi bấm lại để tự đánh dấu.');return;}
    const store=browserStore(),latest=readStudyDays(store,day);
    if(latest.status==='invalid'&&!pendingClear.current){setRecord(latest);setNotice('Em cần xóa dữ liệu không đọc được trước khi ghi ngày mới.');return;}
    pending.current.set(day,mark);setRecord(persist(store,latest));
    setNotice(mark?'Em đã tự ghi một ngày học. Một bước nhỏ cũng đáng ghi nhận.':'Đã bỏ dấu hôm nay. Các ngày khác được giữ nguyên.');
  });
  return <div className="btvn-study-rhythm" data-version="v1">
    <p id={id+'-privacy'}>Em tự đánh dấu sau khi học. Lịch chỉ lưu trên trình duyệt này, dùng chung cho người cùng thiết bị. Đây không phải biên nhận nộp BTVN hay xác minh em đã học.</p>
    <dl className="btvn-study-stats"><div><dt>Chuỗi đang nối</dt><dd>{stats.current} ngày</dd></div><div><dt>Tổng ngày tự ghi</dt><dd>{stats.total} ngày</dd></div><div><dt>Chuỗi dài nhất</dt><dd>{stats.longest} ngày</dd></div></dl>
    <p>{stats.marked?'Hôm nay em đã tự đánh dấu. Nghỉ ngơi cũng là một phần của việc học.':stats.current?'Chuỗi đang tính đến hôm qua. Khi học xong hôm nay, em có thể tự đánh dấu.':'Em bắt đầu khi sẵn sàng. Một ngày nghỉ không xóa các ngày em đã ghi.'}</p>
    <p className="btvn-study-date">Hôm nay: {today.split('-').reverse().join('/')} theo ngày trên thiết bị.</p>
    <ol className="btvn-study-week" aria-label="Bảy ngày gần nhất">{days.map(day=><li key={day} className={record.days.includes(day)?'is-marked':''}><time dateTime={day}>{day.slice(8)}/{day.slice(5,7)}</time><span>{record.days.includes(day)?'Đã ghi':'Chưa ghi'}</span>{day===today&&<b>Hôm nay</b>}</li>)}</ol>
    <div className="btvn-study-badges" aria-label="Huy hiệu theo chuỗi dài nhất">{[3,7,30].map(milestone=><span key={milestone} className={stats.badges.includes(milestone)?'is-earned':''}>{milestone} ngày liên tiếp: {stats.badges.includes(milestone)?'đã đạt':'chưa đạt'}</span>)}</div>
    <button type="button" disabled={record.status==='invalid'} aria-describedby={id+'-privacy'} onClick={()=>toggle(!stats.marked)}>{stats.marked?'Bỏ dấu hôm nay':'Em đã tự học hôm nay'}</button>
    <p role="status" aria-live="polite">{notice}</p>
    {record.status==='invalid'&&<p role="alert">Dữ liệu cũ không đọc được hoặc chứa ngày không hợp lệ. Chưa ghi đè dữ liệu cũ. Em có thể xóa để bắt đầu lịch mới.</p>}
    {record.status==='unavailable'&&<div role="alert"><p>Trình duyệt chưa lưu được lịch. Các dấu hiện chỉ giữ trong trang đang mở và có thể mất khi tải lại. Nếu dùng chế độ riêng tư, lịch có thể bị xóa khi đóng trình duyệt.</p><button type="button" onClick={()=>act(()=>{setRecord(persist(browserStore()));setNotice('Đã thử lưu lại lịch trên trình duyệt này.');})}>Thử lưu lại lịch</button></div>}
    <p className="btvn-study-note">Không có điểm thưởng hoặc hình phạt. Huy hiệu 3, 7, 30 ngày dựa trên chuỗi tự ghi dài nhất. Xóa dữ liệu trình duyệt sẽ mất lịch; lịch không đồng bộ sang thiết bị khác.</p>
    {confirmClear?<div className="btvn-study-clear" role="group" aria-label="Xác nhận xóa lịch"><p>Xóa toàn bộ ngày và huy hiệu tự ghi trên trình duyệt này? Thao tác này không khôi phục được.</p><button type="button" onClick={()=>act(()=>{const next=clearStudyDays(browserStore());pending.current.clear();pendingClear.current=next.status!=='ready';setRecord(next);setConfirmClear(false);setNotice('Đã xóa lịch ở trang này. Nếu trình duyệt chặn lưu, em cần xóa dữ liệu trong cài đặt trình duyệt.');})}>Xác nhận xóa lịch</button><button type="button" onClick={()=>act(()=>setConfirmClear(false))}>Giữ lại lịch</button></div>:<button type="button" className="btvn-study-secondary" onClick={()=>act(()=>setConfirmClear(true))}>{record.status==='invalid'?'Xóa dữ liệu không đọc được':'Xóa lịch sử trên thiết bị'}</button>}
  </div>;
}

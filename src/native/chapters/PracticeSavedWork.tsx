import {useId,useState} from 'react';
import {Link} from '../../migration/navigation';
import './practice-saved-work.css';

export type PendingPractice={id:string;title:string;href:string;updatedAt:number;deadline:number};
export type PracticeHistoryItem={attemptId:string;examId:string;title:string;href:string;submittedAt:number};

export function PracticeResume({items,incomplete,label='chương'}:{items:PendingPractice[];incomplete:boolean;label?:string}){
  const [expanded,setExpanded]=useState(false),id=useId();
  const sorted=[...items].sort((a,b)=>b.updatedAt-a.updatedAt||a.id.localeCompare(b.id)),shown=expanded?sorted:sorted.slice(0,3);
  return <section className="cp-saved-work" aria-labelledby={id+'-title'}>
    <h3 id={id+'-title'}>Bài chưa nộp trong {label}</h3>
    <p>Chỉ đọc bản lưu trên trình duyệt này. Đồng hồ vẫn chạy khi em rời bài; bài hết giờ sẽ được kiểm tra khi mở lại.</p>
    {incomplete&&<p role="status">Chưa đọc được đầy đủ bản lưu. Danh sách dưới đây có thể thiếu bài; dữ liệu gốc được giữ nguyên.</p>}
    {!items.length?<p>{incomplete?'Chưa tìm thấy bài chưa nộp trong phần đọc được.':'Chưa có bài chưa nộp trong '+label+' trên trình duyệt này.'}</p>:<>
      <ul id={id+'-items'}>{shown.map(item=><li key={item.id}><h4>{item.title}</h4><p>Lưu gần nhất: <time dateTime={new Date(item.updatedAt).toISOString()}>{new Date(item.updatedAt).toLocaleString('vi-VN')}</time></p><p>Hạn làm bài: <time dateTime={new Date(item.deadline).toISOString()}>{new Date(item.deadline).toLocaleString('vi-VN')}</time></p><Link className="mig-button outline" href={item.href}>Mở bài chưa nộp: {item.title}</Link></li>)}</ul>
      {items.length>3&&<button type="button" aria-expanded={expanded} aria-controls={id+'-items'} onClick={()=>setExpanded(value=>!value)}>{expanded?'Thu gọn còn 3 bài':'Xem cả '+items.length+' bài chưa nộp'}</button>}
    </>}
  </section>;
}

export function PracticeHistory({items,messages,label}:{items:PracticeHistoryItem[];messages:string[];label:string}){
  const id=useId(),[examId,setExamId]=useState(''),[order,setOrder]=useState('newest');
  const options=Array.from(new Map(items.map(item=>[item.examId,item.title])).entries());
  // Khi danh sách đầu vào đổi, không giữ bộ lọc trỏ tới bài không còn trong danh sách.
  const selected=options.some(([key])=>key===examId)?examId:'';
  const shown=items.filter(item=>!selected||item.examId===selected).sort((a,b)=>(order==='oldest'?a.submittedAt-b.submittedAt:b.submittedAt-a.submittedAt)||a.attemptId.localeCompare(b.attemptId));
  return <section className="cp-history cp-saved-work" aria-labelledby={id+'-title'}>
    <h2 id={id+'-title'}>Lịch sử {label} đang chọn</h2>
    {messages.length>0&&<p role="alert">{messages.join(' ')}</p>}
    {!items.length?<p>{messages.length?'Chưa tìm thấy bài đã nộp trong phần đọc được.':'Chưa có bài đã nộp ở đây.'}</p>:<>
      <div className="cp-saved-filters">
        <div><label htmlFor={id+'-exam'}>Lọc theo bài</label><select id={id+'-exam'} value={selected} onChange={event=>setExamId(event.target.value)}><option value="">Tất cả bài đã nộp</option>{options.map(([key,title])=><option key={key} value={key}>{title}</option>)}</select></div>
        <div><label htmlFor={id+'-order'}>Thứ tự lượt nộp</label><select id={id+'-order'} value={order} onChange={event=>setOrder(event.target.value)}><option value="newest">Mới nhất trước</option><option value="oldest">Cũ nhất trước</option></select></div>
        <button type="button" onClick={()=>{setExamId('');setOrder('newest');}}>Đặt lại bộ lọc lịch sử</button>
      </div>
      <p role="status" aria-live="polite" aria-atomic="true">Hiện {shown.length}/{items.length} lượt đã nộp trong {label}.</p>
      {!shown.length?<p>Chưa có lượt nộp khớp bộ lọc này.</p>:<ul>{shown.map(item=><li key={item.attemptId}><Link href={item.href}>{item.title} · <time dateTime={new Date(item.submittedAt).toISOString()}>{new Date(item.submittedAt).toLocaleString('vi-VN')}</time></Link></li>)}</ul>}
      <p>Lọc và sắp xếp chỉ thay cách xem, giữ nguyên bài và phiên bản đã nộp.</p>
    </>}
  </section>;
}

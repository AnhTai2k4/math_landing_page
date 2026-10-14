import {useEffect,useState} from 'react';
import {Link} from './navigation';
import {ArrowUpRight} from 'lucide-react';
import './guide.css';

export const ZALO_ASSISTANT_URL='https://zalo.me/0967365413';
type Audience='hoc-sinh'|'phu-huynh';
const readAudience=():Audience=>new URLSearchParams(location.search).get('cho')==='phu-huynh'?'phu-huynh':'hoc-sinh';

function Steps({parent}:{parent:boolean}){
 const asks=parent?['Xin nghỉ','Học online','Link Zoom','Tài liệu','Video buổi học','Học phí']:['Xin nghỉ','Học online','Link Zoom','Tài liệu','Video buổi học','Hỏi bài'];
 return <section className="mg-card mg-steps" aria-label="Ba bước dùng Zalo trợ lý lớp">
  <div className="mg-step mg-step-zalo">
   <span className="mg-num" aria-hidden="true">1</span>
   <div className="mg-step-body">
    <h2>Kết bạn Zalo trợ lý lớp</h2>
    <a className="mg-button" href={ZALO_ASSISTANT_URL} target="_blank" rel="noopener noreferrer">Mở Zalo Toán Thầy Thành <ArrowUpRight size={16} aria-hidden="true"/></a>
   </div>
   <img className="mg-qr" src="/zalo-toan-thay-thanh-qr.svg" width={140} height={140} alt="Mã QR kết bạn Zalo Toán Thầy Thành"/>
  </div>
  <div className="mg-step">
   <span className="mg-num" aria-hidden="true">2</span>
   <div className="mg-step-body">
    <h2>Nhắn riêng một tin</h2>
    <p className="mg-template">{parent?'Họ tên phụ huynh / Họ tên học sinh / Lớp':'Họ tên / Lớp đang học'}</p>
   </div>
  </div>
  <div className="mg-step">
   <span className="mg-num" aria-hidden="true">3</span>
   <div className="mg-step-body">
    <h2>Cần gì nhắn trợ lý, bất cứ lúc nào</h2>
    <ul className="mg-chips">{asks.map(a=><li key={a}>{a}</li>)}</ul>
   </div>
  </div>
 </section>;}

function Web({parent}:{parent:boolean}){return <section className="mg-card mg-web">
 <h2>{parent?'Con luyện đề trên web':'Luyện đề trên web'}</h2>
 <div className="mg-web-links"><Link className="mg-link" href="/luyen-tap">Luyện tập</Link><Link className="mg-link" href="/thi-thu">Thi thử</Link></div>
 <p>Bấm <b>Bắt đầu</b>, làm bài, <b>Nộp bài</b> rồi xem ngay điểm và lời giải. Không cần tài khoản.</p>
 <p className="mg-btvn">BTVN vẫn làm trên SHub.</p>
</section>;}

function More({parent}:{parent:boolean}){return <details className="mg-card mg-more">
 <summary>Xem thêm</summary>
 {parent?<ul>
  <li><b>Giờ phản hồi</b> việc cần thầy, kế toán: trong ngày; tin sau 22h trả lời trước 9h sáng hôm sau.</li>
  <li><b>Sau mỗi buổi</b>, nhóm phụ huynh nhận link tài liệu, BTVN, video và ảnh bảng điểm, điểm danh.</li>
  <li><b>Học phí</b>: kế toán gửi riêng ngày 1, hạn mùng 5. Bill chuyển khoản gửi riêng Zalo trung tâm, không gửi vào nhóm.</li>
  <li><b>An toàn</b>: trợ lý chỉ trao đổi thông tin của chính con mình. Trung tâm không bao giờ xin mật khẩu, mã OTP.</li>
  <li><b>Kết quả luyện đề</b> lưu trên máy con đang dùng; xem lại ở trang Luyện tập, Thi thử trên chính máy đó.</li>
  <li>Phụ huynh mới tìm lớp: nhắn Zalo trợ lý hoặc điền mục <Link href="/#register">Tư vấn</Link>.</li>
 </ul>:<ul>
  <li><b>Hỏi bài</b>: gửi đề, nói muốn giải chi tiết hay hướng dẫn từng bước. Trợ lý không gửi đáp án BTVN.</li>
  <li>Tài liệu, link chỉ gửi sau khi trung tâm xác nhận đúng lớp. Lớp THCS không có Zoom, video.</li>
  <li><b>Kết quả luyện đề</b> lưu trên máy đang dùng: nên luyện trên một máy cố định.</li>
  <li><b>Cách chấm</b> đề 22 câu: trắc nghiệm 3 điểm, đúng/sai 4 điểm, trả lời ngắn 3 điểm.</li>
  <li>Lỗi SHub: thử bằng laptop, vẫn lỗi thì nhắn trợ lý.</li>
 </ul>}
</details>;}

export default function Guide(){const [who,setWho]=useState<Audience>(readAudience);
 useEffect(()=>{const sync=()=>setWho(readAudience());addEventListener('popstate',sync);return()=>removeEventListener('popstate',sync);},[]);
 const pick=(next:Audience)=>{setWho(next);const url=new URL(location.href);url.searchParams.set('cho',next);history.replaceState(null,'',url.pathname+url.search);};
 const parent=who==='phu-huynh';
 return <div className="mtm-guide"><div className="mg-shell">
  <header className="mg-head"><p className="mg-eyebrow">Minh Thành Math</p><h1>Hướng dẫn nhanh</h1></header>
  <div className="mg-tabs" role="tablist" aria-label="Hướng dẫn dành cho">
   <button type="button" role="tab" id="mg-tab-hs" aria-selected={!parent} aria-controls="mg-panel" onClick={()=>pick('hoc-sinh')}>Học sinh</button>
   <button type="button" role="tab" id="mg-tab-ph" aria-selected={parent} aria-controls="mg-panel" onClick={()=>pick('phu-huynh')}>Phụ huynh</button>
  </div>
  <div id="mg-panel" role="tabpanel" aria-labelledby={parent?'mg-tab-ph':'mg-tab-hs'}><Steps parent={parent}/><Web parent={parent}/><More parent={parent}/></div>
  <p className="mg-slogan">Minh Thành Math - Thinking gets sharp!</p>
 </div></div>;}

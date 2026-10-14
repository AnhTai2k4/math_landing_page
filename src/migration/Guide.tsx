import {useEffect,useState} from 'react';
import {Link} from './navigation';
import {ArrowUpRight,BookOpenCheck,MessageCircle,ShieldCheck,Timer} from 'lucide-react';
import './guide.css';

export const ZALO_ASSISTANT_URL='https://zalo.me/0967365413';
type Audience='hoc-sinh'|'phu-huynh';
const readAudience=():Audience=>new URLSearchParams(location.search).get('cho')==='phu-huynh'?'phu-huynh':'hoc-sinh';

function ZaloCard({parent}:{parent:boolean}){return <section className="mg-card mg-zalo" aria-labelledby="mg-zalo-title">
 <div className="mg-zalo-text">
  <p className="mg-kicker"><MessageCircle size={16} aria-hidden="true"/> Bước 1</p>
  <h2 id="mg-zalo-title">Kết bạn Zalo trợ lý lớp "Toán Thầy Thành"</h2>
  <p>Quét mã QR hoặc bấm nút bên dưới, chọn <b>Kết bạn</b>. Trợ lý trực cả ngày lẫn đêm.</p>
  <a className="mg-button" href={ZALO_ASSISTANT_URL} target="_blank" rel="noopener noreferrer">Mở Zalo Toán Thầy Thành <ArrowUpRight size={16} aria-hidden="true"/></a>
 </div>
 <img className="mg-qr" src="/zalo-toan-thay-thanh-qr.svg" width={180} height={180} alt="Mã QR kết bạn Zalo Toán Thầy Thành"/>
 <div className="mg-step2">
  <p className="mg-kicker">Bước 2</p>
  <h3>Nhắn riêng một tin theo mẫu</h3>
  <pre>{parent?'Họ tên phụ huynh: ...\nHọ tên học sinh: ...\nLớp đang học tại trung tâm: ...':'Họ tên: ...\nLớp đang học tại trung tâm: ...'}</pre>
  <p className="mg-small">Ví dụ lớp: "2K10 lớp 9+", "2K11 XPT", "Lớp 9.1". Trung tâm đối chiếu với danh sách lớp rồi nhắn lại xác nhận.{parent?' Có hai con học ở trung tâm thì ghi đủ cả hai con.':''}</p>
 </div>
</section>;}

function Student(){return <>
 <ZaloCard parent={false}/>
 <section className="mg-card"><p className="mg-kicker">Bước 3</p><h2>Hỏi trợ lý những gì?</h2><ul>
  <li><b>Xin nghỉ, xin học online, xin vào muộn</b>: ghi rõ lớp và buổi.</li>
  <li><b>Link Zoom</b> khi học online (lớp cấp 3, HSA, TSA).</li>
  <li><b>Tài liệu, BTVN, video xem lại</b>: ghi lớp và ngày buổi học.</li>
  <li><b>Lịch học, giờ học, học bù.</b></li>
  <li><b>Hỏi bài</b>: gửi đề (chữ hoặc ảnh), chọn <b>giải chi tiết</b> hay <b>hướng dẫn từng bước</b>. Hỏi công thức, gửi bài làm để xem đúng sai.</li>
 </ul><p className="mg-note">Tài liệu, link và giải bài dành cho học sinh đang học, đã đối chiếu đúng lớp. Trợ lý không gửi đáp án BTVN. Lớp THCS chỉ học offline, không có Zoom và video.</p></section>
 <section className="mg-card"><p className="mg-kicker"><BookOpenCheck size={16} aria-hidden="true"/> Web minhthanhmath.vn</p><h2>Luyện đề và thi thử</h2><ol>
  <li>Bấm <Link href="/luyen-tap">Luyện tập</Link>, chọn Toán 10, 11, 12, HSA hoặc TSA, chọn chương đang học. Bài 1 là lý thuyết, các đề sau khó dần.</li>
  <li>Hoặc bấm <Link href="/thi-thu">Thi thử</Link>, lọc theo lớp và kỳ kiểm tra: 22 câu, 90 phút.</li>
  <li>Đọc đề trước, bấm <b>Bắt đầu làm bài</b> thì đồng hồ chạy. Câu chưa chắc bấm <b>Đánh dấu để xem lại</b>.</li>
  <li>Bấm <b>Nộp bài</b> (hết giờ web tự nộp). Xem điểm, lọc <b>Câu sai / chưa đủ điểm</b>, mở lời giải, tải PDF lời giải, hoặc <b>Làm lại đề</b>.</li>
 </ol>
 <table className="mg-table"><caption>Cách chấm đề 22 câu</caption><thead><tr><th>Phần</th><th>Số câu</th><th>Điểm</th></tr></thead><tbody>
  <tr><td>I. Trắc nghiệm</td><td>12</td><td>0,25/câu, tối đa 3</td></tr>
  <tr><td>II. Đúng/sai</td><td>4</td><td>tối đa 4, theo số ý đúng</td></tr>
  <tr><td>III. Trả lời ngắn</td><td>6</td><td>tối đa 3</td></tr>
 </tbody></table>
 <p className="mg-note"><Timer size={15} aria-hidden="true"/> Không cần tài khoản. Bài làm và điểm lưu trên trình duyệt của máy đang dùng: đổi máy hoặc xoá dữ liệu duyệt web là mất lịch sử, nên luyện trên một máy cố định. Điểm trên web là điểm tự luyện.</p></section>
 <section className="mg-card"><h2>Bài tập về nhà (BTVN)</h2><ul>
  <li>Hiện tại BTVN làm trên <b>SHub</b>, đúng lớp của em. Link từng buổi có trong tin thông báo sau buổi học, hoặc hỏi trợ lý Zalo.</li>
  <li>Lỗi SHub: thử bằng laptop trước, vẫn lỗi thì nhắn trợ lý Zalo.</li>
  <li>BTVN ngay trên web MTM đang chuẩn bị. Khi mở, lớp phát mã học sinh riêng cho từng em; không dùng mã của bạn khác.</li>
 </ul></section>
</>;}

function Parent(){return <>
 <ZaloCard parent/>
 <section className="mg-card"><p className="mg-kicker">Bước 3</p><h2>Nhắn trợ lý những việc gì?</h2><ul>
  <li><b>Xin nghỉ, xin học online, xin vào muộn</b>: ghi tên con, lớp và buổi.</li>
  <li><b>Link Zoom</b> buổi con học online (lớp cấp 3, HSA, TSA).</li>
  <li><b>Tài liệu, BTVN, video xem lại</b> buổi con nghỉ: ghi lớp và ngày buổi học.</li>
  <li><b>Lịch học, học bù</b>: XPS 8+ và XPS 9+ cùng khoá học cùng nội dung nên có thể học bù so le.</li>
  <li><b>Học phí tháng</b>: kế toán gửi riêng ngày 1 hằng tháng, hạn đóng mùng 5.</li>
  <li><b>Bill chuyển khoản</b>: gửi riêng Zalo trung tâm, không gửi vào nhóm lớp.</li>
 </ul></section>
 <section className="mg-card"><h2>Việc cần thầy hoặc kế toán kiểm tra</h2><p>Học phí cụ thể, điểm của con, góp ý, khiếu nại: trợ lý ghi nhận và chuyển người phụ trách.</p><ul>
  <li>Tin trong ngày: có người phản hồi trong ngày.</li>
  <li>Tin từ 22h đến trước 0h: phản hồi trước 9h sáng hôm sau.</li>
  <li>Tin từ 0h đến 7h: phản hồi trước 9h sáng cùng ngày.</li>
 </ul></section>
 <section className="mg-card"><h2>Sau mỗi buổi học</h2><p>Nhóm phụ huynh của lớp nhận: link tài liệu, BTVN và video (lớp cấp 2 không có video); file tài liệu buổi học; ảnh bảng điểm và điểm danh; tin nhờ phụ huynh nhắc các con chưa nộp, chưa đạt 7 điểm, học online hoặc nghỉ.</p></section>
 <section className="mg-card"><p className="mg-kicker"><BookOpenCheck size={16} aria-hidden="true"/> Web minhthanhmath.vn</p><h2>Con luyện đề trên web</h2><ul>
  <li><Link href="/luyen-tap">Luyện tập</Link>: đề theo từng chương Toán 10, 11, 12 (Kết nối tri thức), HSA, TSA, từ dễ đến khó.</li>
  <li><Link href="/thi-thu">Thi thử</Link>: đề Giữa kỳ I lớp 10, 11, 12, mỗi đề 22 câu, 90 phút, hết giờ tự nộp.</li>
  <li>Nộp xong con xem ngay điểm, câu sai và lời giải chi tiết.</li>
 </ul><p className="mg-note">Không cần tài khoản. Lịch sử làm bài lưu trên máy con đang dùng, anh/chị xem ngay trên máy đó ở trang Thi thử hoặc Luyện tập. Nên để con luyện trên một máy cố định. BTVN hiện vẫn làm trên SHub; BTVN trên web đang chuẩn bị, lớp sẽ thông báo khi mở.</p></section>
 <section className="mg-card mg-safe"><h2><ShieldCheck size={19} aria-hidden="true"/> An toàn thông tin</h2><ul>
  <li>Trợ lý chỉ trao đổi thông tin của chính con mình, không cung cấp thông tin học sinh khác.</li>
  <li>Bảng điểm, điểm danh, học phí của con chỉ trao đổi khi họ tên phụ huynh, họ tên con và lớp khớp hồ sơ lớp.</li>
  <li>Trung tâm không bao giờ xin mật khẩu hay mã OTP qua Zalo.</li>
 </ul></section>
 <section className="mg-card"><h2>Phụ huynh mới muốn tìm lớp</h2><p>Nhắn Zalo Toán Thầy Thành hoặc điền mục <Link href="/#register">Tư vấn</Link> trên trang chủ để nhận lịch học và đăng ký học thử.</p></section>
</>;}

export default function Guide(){const [who,setWho]=useState<Audience>(readAudience);
 useEffect(()=>{const sync=()=>setWho(readAudience());addEventListener('popstate',sync);return()=>removeEventListener('popstate',sync);},[]);
 const pick=(next:Audience)=>{setWho(next);const url=new URL(location.href);url.searchParams.set('cho',next);history.replaceState(null,'',url.pathname+url.search);};
 return <div className="mtm-guide"><div className="mg-shell">
  <header className="mg-head"><p className="mg-eyebrow">Minh Thành Math · Hướng dẫn</p><h1>Học cùng MTM trên web và Zalo</h1><p>Zalo trợ lý lớp "Toán Thầy Thành" để hỏi lịch, xin nghỉ, lấy tài liệu, hỏi bài; web minhthanhmath.vn để luyện đề và thi thử có lời giải.</p></header>
  <div className="mg-tabs" role="tablist" aria-label="Hướng dẫn dành cho">
   <button type="button" role="tab" id="mg-tab-hs" aria-selected={who==='hoc-sinh'} aria-controls="mg-panel" onClick={()=>pick('hoc-sinh')}>Học sinh</button>
   <button type="button" role="tab" id="mg-tab-ph" aria-selected={who==='phu-huynh'} aria-controls="mg-panel" onClick={()=>pick('phu-huynh')}>Phụ huynh</button>
  </div>
  <div id="mg-panel" role="tabpanel" aria-labelledby={who==='hoc-sinh'?'mg-tab-hs':'mg-tab-ph'}>{who==='hoc-sinh'?<Student/>:<Parent/>}</div>
  <p className="mg-slogan">Minh Thành Math - Thinking gets sharp!</p>
 </div></div>;}

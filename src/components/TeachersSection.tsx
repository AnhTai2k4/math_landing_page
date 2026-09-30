import { PencilLine, Lightbulb, CheckCheck } from 'lucide-react';
import { MtmMomentsGallery } from './MtmMomentsGallery';
const steps = [
  {n:'01', title:'Hiểu điều kiện', text:'Xác định giả thiết, miền xác định và điều bài toán yêu cầu trước khi tính toán.', Icon:Lightbulb},
  {n:'02', title:'Trình bày có căn cứ', text:'Nêu lý do ở các bước biến đổi; sử dụng bảng, hình hoặc đồ thị khi cần.', Icon:PencilLine},
  {n:'03', title:'Kiểm tra kết quả', text:'Đối chiếu điều kiện, thử lại nghiệm và nhận diện lỗi để sửa ở bài tiếp theo.', Icon:CheckCheck},
];
export function TeachersSection(){return <section id="teachers" className="mtm-section mtm-method"><div className="mtm-shell">
  <p className="mtm-eyebrow">CÁCH HỌC TẠI MTM</p><h2>Từ hiểu đề đến<br /><span className="mtm-highlight">tự kiểm tra lời giải</span></h2>
  <p className="mtm-lead">Anh Thành hướng dẫn học sinh học Toán qua lập luận rõ ràng, đủ bước và bám tiến độ kiến thức.</p>
  <div className="mtm-three">{steps.map(({n,title,text,Icon})=><article key={n} className="mtm-card"><div className="mtm-method-top"><span className="mtm-step">{n}</span><Icon size={28} aria-hidden="true" /></div><h3>{title}</h3><p>{text}</p></article>)}</div>
  <div className="mtm-class-heading"><div><p className="mtm-eyebrow">MỘT GÓC MTM</p><h3>Có Toán. Có cả những khoảnh khắc vui.</h3></div><span className="mtm-sticker" aria-hidden="true">Cùng học<br />cùng vui ✦</span></div>
  <figure className="mtm-class-photo"><img src="/mtm-class-moment-v1.jpg" alt="Khoảnh khắc tập thể trong lớp học Minh Thành Math" width="2048" height="1282" loading="lazy" decoding="async" /><figcaption>Một khoảnh khắc tại lớp học Minh Thành Math.</figcaption></figure>
  <MtmMomentsGallery />
</div></section>}


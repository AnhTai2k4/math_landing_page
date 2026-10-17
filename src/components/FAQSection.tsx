import {Link} from '../migration/navigation';
import {ZALO_ASSISTANT_URL} from './mtm-contact';
import type {KeyboardEvent} from 'react';
import './faq-ux.css';

function moveQuestion(event:KeyboardEvent<HTMLDivElement>){
  if(event.altKey||event.ctrlKey||event.metaKey)return;
  if(event.key==='Escape'){
    const detail=(event.target as HTMLElement).closest('details');
    if(detail?.open){event.preventDefault();detail.open=false;detail.querySelector('summary')?.focus();}
    return;
  }
  const summary=(event.target as HTMLElement).closest('summary');
  if(!summary||!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;
  const items=Array.from(event.currentTarget.querySelectorAll('summary')),index=items.indexOf(summary);
  if(index<0)return;
  const next=event.key==='Home'?0:event.key==='End'?items.length-1:(index+(event.key==='ArrowDown'?1:-1)+items.length)%items.length;
  event.preventDefault();items[next].focus();
}
const questions = [
  ['MTM có lớp trực tiếp và online không?', 'Bạn có thể chọn hình thức mong muốn trong form tư vấn. Trung tâm sẽ xác nhận hình thức, lịch và lớp còn phù hợp trước khi đăng ký; không phải mọi lớp đều có cả hai hình thức.'],
  ['Vào BTVN bằng cách nào?', <>Mở <Link href="/btvn">BTVN</Link>, dùng mã MTM đã cấp hoặc họ tên, số điện thoại đã đăng ký và lớp đang học. Chưa có mã vẫn dùng được cách thứ hai. <Link href="/huong-dan">Xem hướng dẫn từng bước</Link>.</>],
  ['Phụ huynh theo dõi bài của con ở đâu?', <>Anh/chị xem <Link href="/huong-dan?cho=phu-huynh">hướng dẫn phụ huynh</Link> để vào đúng bài của con. Cổng phụ huynh riêng chưa được kết nối; cần hỗ trợ thì <a href={ZALO_ASSISTANT_URL} target="_blank" rel="noopener noreferrer">nhắn Zalo trợ lý lớp</a>.</>],
  ['Sau buổi học, xem bài tập và tài liệu lúc nào?', <>Trong BTVN, mỗi thẻ buổi ghi giờ mở và hạn nộp nếu lịch lớp đã được xác minh. Bài chưa mở có ghi thời điểm mở; video và tài liệu chỉ hiện khi buổi đó đã có nguồn. Chưa rõ lịch thì hỏi trợ lý lớp.</>],
  ['Học phí và lịch học được xác nhận thế nào?', 'Trung tâm trao đổi học phí, lịch và điều kiện của lớp trước khi xác nhận đăng ký. Nếu bạn chưa rõ, hãy để lại lớp đang học và hình thức mong muốn để được tư vấn.'],
] as const;
export function FAQSection(){return <section id="faq" className="mtm-section mtm-faq"><div className="mtm-shell mtm-faq-grid"><div><p className="mtm-eyebrow">BẠN CÓ THỂ ĐANG THẮC MẮC</p><h2>Hỏi một chút,<br /><span className="mtm-highlight">rõ hơn một chút.</span></h2><p className="mtm-lead">Những điều cần biết trước khi bắt đầu học cùng MTM.</p><a href="#register" className="mtm-text-link">Còn câu hỏi khác? Gửi lời nhắn →</a></div><div className="mtm-faq-list" onKeyDown={moveQuestion}>{questions.map(([question,answer])=><details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</div></div></section>}

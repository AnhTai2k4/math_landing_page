import { ArrowUpRight, Play, MessageCircle } from 'lucide-react';
import './mtm-interview.css';
export const mtmInterviewUrl='https://www.facebook.com/reel/1453116679983070/';
export function MtmInterview(){return <article className="mtm-interview" aria-labelledby="mtm-interview-title">
 <div className="mtm-interview-art" aria-hidden="true"><MessageCircle className="mtm-interview-chat" size={76}/><span className="mtm-interview-play"><Play size={34}/></span><span className="mtm-interview-art-label">CHUYỆN HỌC Ở MTM</span></div>
 <div className="mtm-interview-copy"><p className="mtm-interview-eyebrow">MỘT GÓC NHÌN TỪ HỌC SINH</p><h3 id="mtm-interview-title">Lắng nghe câu chuyện học tại MTM</h3><p>Một buổi trò chuyện, một hành trình học tập được chia sẻ. Cùng xem video phỏng vấn học sinh trên Fanpage Minh Thành Math nhé.</p><a className="mtm-interview-link" href={mtmInterviewUrl} target="_blank" rel="noopener noreferrer">Xem video trên Facebook <ArrowUpRight size={18} aria-hidden="true"/></a><p className="mtm-interview-note">Mở bài đăng gốc trong thẻ mới; Facebook có thể yêu cầu đăng nhập.</p></div>
 </article>}

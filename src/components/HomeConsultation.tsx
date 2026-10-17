import {ArrowUpRight} from 'lucide-react';
import {ZALO_ASSISTANT_URL} from './mtm-contact';
import './home-consultation.css';

export function ZaloIcon(){
 return <svg viewBox="0 0 40 40" width="30" height="30" aria-hidden="true"><rect width="40" height="40" rx="12" fill="#fff"/><path d="M10 9h20a5 5 0 0 1 5 5v12a5 5 0 0 1-5 5H18l-7 4 1-5a5 5 0 0 1-5-5V14a5 5 0 0 1 3-5Z" fill="#0068ff"/><text x="21" y="24" textAnchor="middle" fill="#fff" fontSize="10" fontWeight="800" fontFamily="Arial,sans-serif">Zalo</text></svg>;
}

export function HomeConsultation(){
 return <aside className="mtm-home-consultation" aria-label="Tư vấn khóa học"><span><strong>Cùng MTM tìm lớp phù hợp</strong><small>Trao đổi với trợ lý trung tâm qua Zalo</small></span><a href={ZALO_ASSISTANT_URL} target="_blank" rel="noopener noreferrer"><ZaloIcon/><span>Tư vấn ngay về khóa học</span><ArrowUpRight size={19} aria-hidden="true"/></a></aside>;
}

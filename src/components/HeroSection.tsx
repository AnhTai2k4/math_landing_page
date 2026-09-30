import { ArrowUpRight, ArrowRight } from 'lucide-react';
import { PortalLinks } from './PortalLinks';

export function HeroSection() {
  return <>
    <section id="home" className="mtm-hero" aria-labelledby="hero-heading">
      <div className="mtm-shell mtm-hero-grid">
        <div className="mtm-hero-copy">
          <p className="mtm-eyebrow">MINH THÀNH MATH · HÀ NỘI</p>
          <h1 id="hero-heading">Học Toán.<br />Hiểu <span>bản chất.</span><br />Vững từng bước.</h1>
          <p className="mtm-lead">Từ một câu hỏi đến một lời giải rõ ràng. Cùng MTM học cách lập luận, trình bày và tự kiểm tra kết quả.</p>
          <div className="mtm-subjects" aria-label="Chương trình học"><span>THCS</span><span>THPT</span><span>HSA</span><span>TSA</span></div>
          <div className="mtm-actions">
            <a className="mtm-primary" href="#register">Tìm lớp phù hợp <ArrowUpRight size={21} aria-hidden="true" /></a>
            <a className="mtm-secondary" href="#courses">Khám phá khóa học <ArrowRight size={18} aria-hidden="true" /></a>
          </div>
          <p className="mtm-contact">82 Chùa Láng, Hà Nội <span aria-hidden="true">·</span> <a href="tel:0964345413">0964 345 413</a></p>
        </div>
        <figure className="mtm-hero-photo">
          <img src="/mtm-thanh-portrait-v1.png" alt="Anh Thành — Minh Thành Math" width="1200" height="1312" fetchPriority="high" decoding="async" />
          <figcaption><span>MINH THÀNH MATH</span><strong>Rõ cách nghĩ.<br />Chắc cách làm.</strong></figcaption>
        </figure>
      </div>
    </section>
    <section id="portals" className="mtm-portal-strip" aria-labelledby="portal-heading">
      <div className="mtm-shell mtm-portal-strip-inner">
        <div><p className="mtm-eyebrow">ĐÃ CÓ TÀI KHOẢN?</p><h2 id="portal-heading">Vào không gian của bạn</h2><p>Tài khoản do trung tâm cấp, quyền xem theo vai trò và lớp học.</p></div>
        <PortalLinks />
      </div>
    </section>
  </>;
}


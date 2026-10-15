import {Link} from '../migration/navigation';

// Cổng vận hành và tài khoản phụ huynh cần nghiệm thu riêng trước khi đưa lại.
export function PortalLinks({footer = false}: {footer?: boolean}) {
  return <nav aria-label="Học tập và hướng dẫn MTM" className={`mtm-portal-links${footer ? ' is-footer' : ''}`}>
    <Link href="/btvn"><span>Vào BTVN</span><span aria-hidden="true">→</span></Link>
    <Link href="/huong-dan?cho=phu-huynh"><span>Hướng dẫn phụ huynh</span><span aria-hidden="true">→</span></Link>
  </nav>;
}

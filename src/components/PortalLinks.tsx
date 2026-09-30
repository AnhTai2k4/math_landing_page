const configured = (import.meta as ImportMeta & {env: Record<string, string>}).env.VITE_MTM_PORTAL_URL || 'https://mtm-vao-ca.thanh-tm-fyu.chatgpt.site';
function portalBase() {
  try {
    const u = new URL(configured);
    if (u.protocol !== 'https:' || u.username || u.password || u.search || u.hash || u.pathname !== '/') return '';
    return u.origin;
  } catch { return ''; }
}
export function PortalLinks({footer = false}: {footer?: boolean}) {
  const base = portalBase();
  if (!base) return null;
  return <nav aria-label="Cổng Minh Thành Math" className={`mtm-portal-links${footer ? ' is-footer' : ''}`}>
    {[['Học sinh', '/portal?audience=student'], ['Phụ huynh', '/portal?audience=parent'], ['Nhân sự', '/']].map(([label, path]) =>
      <a key={label} href={base + path} aria-label={`Đăng nhập ${label.toLowerCase()}`}><span>{label}</span><span aria-hidden="true">↗</span></a>
    )}
  </nav>;
}

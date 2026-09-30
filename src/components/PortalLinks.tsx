import React from 'react';
const configured=(import.meta as ImportMeta & {env:Record<string,string>}).env.VITE_MTM_PORTAL_URL || 'https://mtm-vao-ca.thanh-tm-fyu.chatgpt.site';
function portalBase(){try{const u=new URL(configured);if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||u.pathname!=='/')return '';return u.origin}catch{return ''}}
export function PortalLinks({footer=false}:{footer?:boolean}){const base=portalBase();if(!base)return null;return <nav aria-label="Cổng Minh Thành Math" style={{display:'flex',gap:12,flexWrap:'wrap',padding:'12px 0',fontWeight:600,fontSize:14}}>{[['Học sinh','/portal?audience=student'],['Phụ huynh','/portal?audience=parent'],['Nhân sự','/']].map(([label,path])=><a key={label} href={base+path} style={{color:footer?'#fff':'#243168',border:'1px solid '+(footer?'#6d7ab0':'#dde2ed'),borderRadius:12,padding:'9px 14px',textDecoration:'none'}}>Đăng nhập {label.toLowerCase()}</a>)}</nav>}


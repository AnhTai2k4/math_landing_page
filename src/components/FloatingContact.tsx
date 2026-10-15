import {useEffect,useState} from 'react';
import {Phone,MessageCircle,ArrowUpRight} from 'lucide-react';
import {Link} from '../migration/navigation';
export function contactAllowed(pathname:string,search=''){
 return !(pathname==='/btvn'||pathname.startsWith('/btvn/')||pathname==='/quan-tri'||pathname.startsWith('/quan-tri/')||pathname==='/admin'||pathname.startsWith('/admin/')||pathname.startsWith('/thi-thu/')||(pathname==='/luyen-tap'&&['id','luot'].some(key=>new URLSearchParams(search).has(key))));
}
export function FloatingContact({pathname,search=''}:{pathname:string;search?:string}){
 const [nearForm,setNearForm]=useState(false),allowed=contactAllowed(pathname,search);
 useEffect(()=>{
  setNearForm(false);if(!allowed)return;
  let observer:IntersectionObserver|undefined,form:HTMLElement|null=null;
  const watch=()=>{const next=document.getElementById('register');if(next===form)return;observer?.disconnect();form=next;setNearForm(false);if(form){observer=new IntersectionObserver(entries=>setNearForm(entries.some(entry=>entry.isIntersecting)),{rootMargin:'80px 0px 80px 0px'});observer.observe(form);}};
  watch();const mutations=new MutationObserver(watch);mutations.observe(document.getElementById('main-content')??document.body,{childList:true,subtree:true});
  return()=>{observer?.disconnect();mutations.disconnect();};
 },[pathname,search,allowed]);
 if(!allowed)return null;
 return <nav className="mtm-contact-dock" aria-label="Liên hệ nhanh" hidden={nearForm}><a href="tel:0964345413"><Phone size={18} aria-hidden="true"/><span>Gọi MTM</span></a><a href="https://www.facebook.com/minhthanhmath/" target="_blank" rel="noopener noreferrer"><MessageCircle size={18} aria-hidden="true"/><span>Messenger</span></a><Link className="mtm-contact-register" href="/#register"><ArrowUpRight size={18} aria-hidden="true"/><span>Đăng ký tư vấn</span></Link></nav>;
}

import {lazy,Suspense,useEffect,useRef,useState} from 'react';
const Leaderboard=lazy(()=>import('./HomeLeaderboard'));
export default function LazyLeaderboard(){
 const ref=useRef<HTMLDivElement>(null),[visible,setVisible]=useState(false);
 useEffect(()=>{if(!ref.current)return;if(!('IntersectionObserver' in window)){setVisible(true);return;}const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){setVisible(true);observer.disconnect();}},{rootMargin:'200px'});observer.observe(ref.current);return()=>observer.disconnect();},[]);
 return <div ref={ref} style={{minHeight:1}}>{visible&&<Suspense fallback={<p className="mig-container" role="status">Đang tải bảng xếp hạng…</p>}><Leaderboard/></Suspense>}</div>;
}

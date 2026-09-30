import {useId,useRef,useState} from 'react';
import {lifePhotos,lifeTabs} from './mtm-life-assets';
import './mtm-life-tabs.css';
/** Uses existing public assets only; source/consent evidence stays in the private editorial manifest. */
export function MtmLifeTabs(){
 const [active,setActive]=useState<(typeof lifeTabs)[number]['id']>('classroom');const uid=useId();const buttons=useRef<(HTMLButtonElement|null)[]>([]);
 const choose=(i:number)=>{setActive(lifeTabs[i].id);buttons.current[i]?.focus()};
 return <section className="mtm-life" aria-labelledby={uid+'-title'}><div className="mtm-life-heading"><div><p className="mtm-eyebrow">MỘT GÓC MTM</p><h2 id={uid+'-title'}>Có Toán. Có bạn.<br/>Có những niềm vui nhỏ.</h2></div><span className="mtm-life-note" aria-hidden="true">Cùng nhau<br/>ở MTM ✦</span></div>
 <div role="tablist" aria-label="Ảnh tại MTM" className="mtm-life-tabs">{lifeTabs.map((tab,i)=><button key={tab.id} ref={el=>{buttons.current[i]=el}} type="button" role="tab" id={uid+'-'+tab.id} aria-selected={active===tab.id} aria-controls={uid+'-panel-'+tab.id} tabIndex={active===tab.id?0:-1} onClick={()=>setActive(tab.id)} onKeyDown={e=>{const next=e.key==='ArrowRight'?(i+1)%2:e.key==='ArrowLeft'?(i+1)%2:e.key==='Home'?0:e.key==='End'?1:null;if(next!==null){e.preventDefault();choose(next)}}}>{tab.label}</button>)}</div>
 {lifeTabs.map(tab=><div key={tab.id} id={uid+'-panel-'+tab.id} role="tabpanel" aria-labelledby={uid+'-'+tab.id} hidden={active!==tab.id} tabIndex={0}><div className="mtm-life-grid">{lifePhotos.filter(p=>p.tab===tab.id).map(photo=><figure key={photo.id} className="mtm-life-card"><div className="mtm-life-image"><img src={photo.src} alt={photo.alt} width={photo.width} height={photo.height} loading="lazy" decoding="async"/><span>{photo.tag}</span></div><figcaption><h3>{photo.title}</h3><p>{photo.caption}</p></figcaption></figure>)}</div></div>)}
 </section>
}

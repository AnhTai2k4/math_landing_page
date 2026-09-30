import {MtmMomentsGallery} from './MtmMomentsGallery';
import './mtm-community.css';
export type CommunityStory={id:string;category:'LEARNING'|'EXTRACURRICULAR';title:string;caption:string;asset:string;alt:string;width:number;height:number;source:{verified:boolean;public_use_approved:boolean}};
export type VerifiedMilestone={id:string;title:string;text:string;year:string;source:{verified:boolean;public_use_approved:boolean}};
export function permittedStory(s:CommunityStory){return s.source?.verified===true&&s.source.public_use_approved===true&&/^\/(?:gallery|community)\/[a-zA-Z0-9._-]+\.(?:webp|png|jpg|jpeg)$/.test(s.asset)&&s.width>0&&s.height>0}
/** Source evidence remains in the private editorial workflow; only approved public copy/assets are supplied here. */
export function MtmCommunityStories({stories=[],milestones=[]}:{stories?:CommunityStory[];milestones?:VerifiedMilestone[]}){
 const approved=stories.filter(permittedStory);const history=milestones.filter(m=>m.source?.verified===true&&m.source.public_use_approved===true);
 return <section id="community" className="mtm-community"><div className="mtm-shell">
 {history.length>0&&<div className="mtm-community-history"><h2>Những dấu mốc của MTM</h2><ol>{history.map(m=><li key={m.id}><span>{m.year}</span><h3>{m.title}</h3><p>{m.text}</p></li>)}</ol></div>}
 {(['LEARNING','EXTRACURRICULAR'] as const).map(category=>{const items=approved.filter(s=>s.category===category);return items.length?<div className="mtm-community-stories" key={category}><h2>{category==='LEARNING'?'Chuyện học ở MTM':'Hoạt động ngoại khóa'}</h2><div className="mtm-community-grid">{items.map(s=><figure key={s.id}><img src={s.asset} alt={s.alt} width={s.width} height={s.height} loading="lazy" decoding="async"/><figcaption><h3>{s.title}</h3><p>{s.caption}</p></figcaption></figure>)}</div></div>:null})}
 <div className="mtm-community-memories"><h2>Bộ ảnh kỷ niệm MTM</h2><p className="mtm-community-intro">Một bộ ảnh cùng đội ngũ, cùng màu áo MTM và những nụ cười.</p><MtmMomentsGallery/></div>
 </div></section>
}

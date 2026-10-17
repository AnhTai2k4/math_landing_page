import type {ReactNode} from 'react';

/** R100.6 page header shared by public routes: one h1, eyebrow, optional description and actions.
 * Content stays a ReactNode so callers keep their real text, links and source notes. */
export default function R106PageIntro({eyebrow,title,description,children,className,headingId}:{eyebrow?:ReactNode;title:ReactNode;description?:ReactNode;children?:ReactNode;className?:string;headingId?:string}){
 return <div className={'r106-page-intro'+(className?' '+className:'')}>
  <span className="r106-page-arc" aria-hidden="true"/>
  <div className="r106-page-text">
   {eyebrow&&<p className="r106-page-eyebrow"><span aria-hidden="true"/>{eyebrow}</p>}
   <h1 id={headingId}>{title}</h1>
   {description&&<div className="r106-page-description">{description}</div>}
  </div>
  {children&&<div className="r106-page-aside">{children}</div>}
 </div>;
}

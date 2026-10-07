import {useEffect,useState,type AnchorHTMLAttributes,type MouseEvent} from 'react';
const eventName='mtm:migration:navigate';
export const BEFORE_NAVIGATION_EVENT='mtm:migration:before-navigate';
export function navigate(href:string,options:{replace?:boolean}={}){const next=new URL(href,location.href);if(!['https:','http:'].includes(next.protocol))return;if(next.href!==location.href&&!window.dispatchEvent(new CustomEvent(BEFORE_NAVIGATION_EVENT,{cancelable:true,detail:{href:next.href}})))return;if(next.origin!==location.origin){location.assign(next.href);return;}if(next.href!==location.href){const target=next.pathname+next.search+next.hash;options.replace?history.replaceState(null,'',target):history.pushState(null,'',target);}window.dispatchEvent(new Event(eventName));}
export function useRoute(){const read=()=>({pathname:location.pathname.replace(/\/$/,'')||'/',search:location.search,hash:location.hash});const [route,setRoute]=useState(read);useEffect(()=>{const update=()=>setRoute(read());window.addEventListener('popstate',update);window.addEventListener(eventName,update);window.addEventListener('hashchange',update);return()=>{window.removeEventListener('popstate',update);window.removeEventListener(eventName,update);window.removeEventListener('hashchange',update);};},[]);return route;}
export function Link({href='',onClick,...props}:AnchorHTMLAttributes<HTMLAnchorElement>){return <a {...props} href={href} onClick={(e:MouseEvent<HTMLAnchorElement>)=>{onClick?.(e);if(e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey||props.target==='_blank'||props.download)return;const u=new URL(href,location.href);if(u.origin!==location.origin)return;e.preventDefault();navigate(href);}}/>;}
export function RoutePosition({pathname,hash}:{pathname:string;hash:string}){
 useEffect(()=>{
  let done=false;let timeout:number;let observer:MutationObserver|undefined;
  const position=()=>{if(done)return;let target:HTMLElement|null=null;try{target=hash?document.getElementById(decodeURIComponent(hash.slice(1))):document.querySelector('main');}catch{return;}if(!target)return;done=true;observer?.disconnect();clearTimeout(timeout);target.setAttribute('tabindex','-1');if(hash)target.scrollIntoView({block:'start'});else window.scrollTo({top:0,behavior:'instant' as ScrollBehavior});target.focus({preventScroll:true});};
  observer=new MutationObserver(position);observer.observe(document.body,{childList:true,subtree:true});timeout=window.setTimeout(()=>observer?.disconnect(),5000);const initial=window.setTimeout(position,80);
  return()=>{done=true;clearTimeout(initial);clearTimeout(timeout);observer?.disconnect();};
 },[pathname,hash]);return null;
}

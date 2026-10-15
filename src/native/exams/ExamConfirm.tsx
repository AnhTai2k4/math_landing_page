/// <reference path="./react-dom-portal.d.ts" />
import {useEffect,useRef,useId} from 'react';
import {createPortal} from 'react-dom';
export type ConfirmItem={key:string;label:string;detail?:string;ariaLabel?:string;group?:string;warn?:boolean;onSelect:()=>void};
export default function ExamConfirm({title,message,confirmLabel,onConfirm,onCancel,cancelLabel='Hủy · giữ bài hiện tại',items,itemsLabel}:{title:string;message:string;confirmLabel:string;onConfirm:()=>void;onCancel:()=>void;cancelLabel?:string;items?:ConfirmItem[];itemsLabel?:string}) {
  const host=useRef<HTMLDivElement>(null),cancel=useRef<HTMLButtonElement>(null),id=useId();
  useEffect(()=>{if(document.fullscreenElement)void document.exitFullscreen().catch(()=>{});},[]);
  useEffect(()=>{const previous=document.activeElement as HTMLElement|null;cancel.current?.focus();return()=>{if(previous?.isConnected)previous.focus();};},[]);
  useEffect(()=>{window.addEventListener('mtm:cancel-confirm',onCancel);return()=>window.removeEventListener('mtm:cancel-confirm',onCancel);},[onCancel]);
  useEffect(()=>{const contain=(event:FocusEvent)=>{const dialogs=document.querySelectorAll('[role="alertdialog"]');if(dialogs[dialogs.length-1]===host.current&&!host.current?.contains(event.target as Node))cancel.current?.focus();};document.addEventListener('focusin',contain);return()=>document.removeEventListener('focusin',contain);},[]);
  return createPortal(<div className="ep-confirm-backdrop"><div className="ep-confirm" role="alertdialog" aria-modal="true" aria-labelledby={id+'-title'} aria-describedby={id+'-message'} ref={host} onKeyDown={event=>{
    if(event.key==='Escape'){event.preventDefault();onCancel();}
    if(event.key==='Tab'){const controls=host.current?.querySelectorAll<HTMLButtonElement>('button'),first=controls?.[0],last=controls?.[controls.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}
  }}><h2 id={id+'-title'}>{title}</h2><p id={id+'-message'}>{message}</p>{items&&items.length>0&&<nav className="ep-confirm-list" aria-label={itemsLabel??'Danh sách câu'}>{Array.from(new Set(items.map(item=>item.group??''))).map(group=><div key={group}>{group&&<h3>{group}</h3>}<ul>{items.filter(item=>(item.group??'')===group).map(item=><li key={item.key}><button type="button" className={item.warn?'is-warn':undefined} aria-label={item.ariaLabel} onClick={item.onSelect}>{item.label}{item.detail&&<small> · {item.detail}</small>}</button></li>)}</ul></div>)}</nav>}<div className="ep-toolbar"><button type="button" ref={cancel} onClick={onCancel}>{cancelLabel}</button><button type="button" className="ep-primary" onClick={onConfirm}>{confirmLabel}</button></div></div></div>,document.body);
}

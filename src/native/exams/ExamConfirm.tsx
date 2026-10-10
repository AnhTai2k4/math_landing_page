/// <reference path="./react-dom-portal.d.ts" />
import {useEffect,useRef,useId} from 'react';
import {createPortal} from 'react-dom';
export default function ExamConfirm({title,message,confirmLabel,onConfirm,onCancel}:{title:string;message:string;confirmLabel:string;onConfirm:()=>void;onCancel:()=>void}) {
  const host=useRef<HTMLDivElement>(null),cancel=useRef<HTMLButtonElement>(null),id=useId();
  useEffect(()=>{const previous=document.activeElement as HTMLElement|null;cancel.current?.focus();return()=>{if(previous?.isConnected)previous.focus();};},[]);
  useEffect(()=>{window.addEventListener('mtm:cancel-confirm',onCancel);return()=>window.removeEventListener('mtm:cancel-confirm',onCancel);},[onCancel]);
  useEffect(()=>{const contain=(event:FocusEvent)=>{const dialogs=document.querySelectorAll('[role="alertdialog"]');if(dialogs[dialogs.length-1]===host.current&&!host.current?.contains(event.target as Node))cancel.current?.focus();};document.addEventListener('focusin',contain);return()=>document.removeEventListener('focusin',contain);},[]);
  return createPortal(<div className="ep-confirm-backdrop"><div className="ep-confirm" role="alertdialog" aria-modal="true" aria-labelledby={id+'-title'} aria-describedby={id+'-message'} ref={host} onKeyDown={event=>{
    if(event.key==='Escape'){event.preventDefault();onCancel();}
    if(event.key==='Tab'){const controls=host.current?.querySelectorAll<HTMLButtonElement>('button'),first=controls?.[0],last=controls?.[controls.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}
  }}><h2 id={id+'-title'}>{title}</h2><p id={id+'-message'}>{message}</p><div className="ep-toolbar"><button type="button" ref={cancel} onClick={onCancel}>Hủy · giữ bài hiện tại</button><button type="button" className="ep-primary" onClick={onConfirm}>{confirmLabel}</button></div></div></div>,document.body);
}

import {useEffect,useRef} from 'react';
export default function ExamConfirm({title,message,confirmLabel,onConfirm,onCancel}:{title:string;message:string;confirmLabel:string;onConfirm:()=>void;onCancel:()=>void}) {
  const host=useRef<HTMLDivElement>(null),cancel=useRef<HTMLButtonElement>(null);
  useEffect(()=>{const previous=document.activeElement as HTMLElement|null;cancel.current?.focus();return()=>{if(previous?.isConnected)previous.focus();};},[]);
  return <div className="ep-confirm-backdrop"><div className="ep-confirm" role="alertdialog" aria-modal="true" aria-labelledby="ep-confirm-title" aria-describedby="ep-confirm-message" ref={host} onKeyDown={event=>{
    if(event.key==='Escape'){event.preventDefault();onCancel();}
    if(event.key==='Tab'){const controls=host.current?.querySelectorAll<HTMLButtonElement>('button'),first=controls?.[0],last=controls?.[controls.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}
  }}><h2 id="ep-confirm-title">{title}</h2><p id="ep-confirm-message">{message}</p><div className="ep-toolbar"><button type="button" ref={cancel} onClick={onCancel}>Hủy · giữ bài hiện tại</button><button type="button" className="ep-primary" onClick={onConfirm}>{confirmLabel}</button></div></div></div>;
}

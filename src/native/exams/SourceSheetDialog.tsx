import {lazy,Suspense,useEffect,useRef} from 'react';
import type {QuestionPdf as QuestionPdfFile} from './pdf-source';
import './source-sheet.css';

const QuestionPdf=lazy(()=>import('./QuestionPdf'));
// Phiếu tham khảo không đổi trạng thái sẵn sàng của câu hỏi hay bài làm.
const referenceReady=()=>{};

export default function SourceSheetDialog({file,title,page,number,onClose}:{file:QuestionPdfFile;title:string;page:number;number:number;onClose:()=>void}) {
  const dialog=useRef<HTMLDialogElement>(null),closeButton=useRef<HTMLButtonElement>(null);
  useEffect(()=>{
    const node=dialog.current,trigger=document.activeElement;
    if(!node)return;
    node.showModal();closeButton.current?.focus({preventScroll:true});
    return()=>{node.close();if(trigger instanceof HTMLElement&&trigger.isConnected)trigger.focus({preventScroll:true});};
  },[]);
  return <dialog ref={dialog} className="fr-source-dialog" aria-labelledby="fr-source-title" onCancel={event=>{event.preventDefault();onClose();}}>
    <header className="fr-source-bar"><div><h2 id="fr-source-title">Phiếu gốc · Câu {number}</h2><p>Trang {page}/{file.totalPages} của phiếu</p></div><button ref={closeButton} type="button" className="fr-source-close" onClick={onClose}>Đóng phiếu</button></header>
    <div className="fr-source-body"><Suspense fallback={<p role="status">Đang mở phiếu gốc…</p>}><QuestionPdf file={file} title={title} targetPage={page} onReady={referenceReady} allowFullscreen={false} compact fitToWidth/></Suspense></div>
  </dialog>;
}

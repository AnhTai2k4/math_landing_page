/// <reference path="./react-dom-portal.d.ts" />
import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {getDocument,GlobalWorkerOptions,AnnotationMode,type PDFDocumentProxy,type RenderTask} from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {fetchQuestionPdf,type QuestionPdf as QuestionPdfFile} from './pdf-source';
GlobalWorkerOptions.workerSrc=workerUrl;
// TH-02 (Đợt 4): trang đề vẽ theo đúng bề ngang vùng đọc (trước đây trừ 24 px nên trên điện thoại chỉ còn 293 px),
// thêm mức phóng (cuộn hai chiều) và chế độ toàn màn hình. Không đổi tệp đề, số trang hay điều kiện "bản đề đã hiển thị".
const ZOOMS=[1,1.5,2,3] as const;
const MAX_RENDER_WIDTH=3200;
export default function QuestionPdf({file,title,onReady}:{file:QuestionPdfFile;title:string;onReady:(ready:boolean)=>void}) {
  const [doc,setDoc]=useState<PDFDocumentProxy|null>(null),[index,setIndex]=useState(0),[width,setWidth]=useState(600),[error,setError]=useState(''),[busy,setBusy]=useState(true);
  const [zoom,setZoom]=useState(0),[full,setFull]=useState(false);
  const host=useRef<HTMLElement>(null),sheet=useRef<HTMLDivElement>(null),fullButton=useRef<HTMLButtonElement>(null),ready=useRef(onReady);ready.current=onReady;
  const [placeholder,setPlaceholder]=useState(0);
  // Khung đọc được gắn lại (vào body khi toàn màn hình) nên theo dõi lại bề ngang mỗi lần đổi chế độ.
  useEffect(()=>{const target=sheet.current;if(!target)return;const observer=new ResizeObserver(entries=>setWidth(Math.max(240,Math.floor(entries[0].contentRect.width))));observer.observe(target);return()=>observer.disconnect();},[full]);
  useEffect(()=>{let active=true;const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),20000);let task:ReturnType<typeof getDocument>|undefined;
    ready.current(false);setDoc(null);setIndex(0);setError('');setBusy(true);
    void(async()=>{try{const bytes=await fetchQuestionPdf(file,controller.signal);if(!active)return;task=getDocument({data:bytes,enableXfa:false,stopAtErrors:true,useSystemFonts:true,maxImageSize:16000000});const loaded=await task.promise;if(loaded.numPages!==file.totalPages)throw Error('Số trang bản đề không khớp.');if(active){setDoc(loaded);clearTimeout(timeout);}}catch(e){if(active){setError(e instanceof Error?e.message:'Chưa xem được bản đề.');setBusy(false);ready.current(false);}}})();
    return()=>{active=false;controller.abort();clearTimeout(timeout);void task?.destroy().catch(()=>{});};
  },[file]);
  useEffect(()=>{if(!doc||!sheet.current)return;let active=true;let render:RenderTask|undefined;setBusy(true);setError('');
    void(async()=>{try{const pageNumber=file.questionPages[index];if(!pageNumber)throw Error('Trang câu hỏi chưa hợp lệ.');const page=await doc.getPage(pageNumber);if(!active)return;
      // Vừa bề ngang vùng đọc (ở cỡ vừa, chữ không vượt 1050 px như trước); mức phóng nhân thêm và cho cuộn ngang.
      const fit=Math.min(full?1400:1050,Math.max(240,width-2)),natural=page.getViewport({scale:1}),viewport=page.getViewport({scale:Math.min(MAX_RENDER_WIDTH,fit*ZOOMS[zoom])/natural.width}),density=Math.min(2,devicePixelRatio||1,Math.sqrt(6000000/(viewport.width*viewport.height)));
      const canvas=document.createElement('canvas'),context=canvas.getContext('2d',{alpha:false});if(!context)throw Error('Trình duyệt chưa hiển thị được bản đề.');canvas.width=Math.ceil(viewport.width*density);canvas.height=Math.ceil(viewport.height*density);canvas.style.width=Math.ceil(viewport.width)+'px';canvas.style.height=Math.ceil(viewport.height)+'px';canvas.setAttribute('role','img');canvas.setAttribute('aria-label',`${title}, trang câu hỏi ${pageNumber}`);
      render=page.render({canvas,viewport,transform:density!==1?[density,0,0,density,0,0]:undefined,annotationMode:AnnotationMode.DISABLE});await render.promise;
      // Vẽ xong mới thay canvas cũ: đổi mức phóng không làm trang nháy trắng hay nhảy chiều cao.
      if(active&&sheet.current){sheet.current.replaceChildren(canvas);canvas.dataset.questionPage=String(pageNumber);setBusy(false);ready.current(true);}
    }catch(e){if(active){setError(e instanceof Error?e.message:'Chưa hiển thị được trang đề.');setBusy(false);ready.current(false);}}})();return()=>{active=false;render?.cancel();};
  },[doc,file,index,width,zoom,full]);
  // Toàn màn hình: khoá cuộn trang nền, Esc để thoát, Tab chỉ đi trong khung; thoát xong trả tiêu điểm về nút.
  const wasFull=useRef(false);
  useEffect(()=>{
    if(!full){if(wasFull.current)fullButton.current?.focus({preventScroll:true});wasFull.current=false;return;}
    wasFull.current=true;const root=document.documentElement,previous=root.style.overflow;root.style.overflow='hidden';fullButton.current?.focus({preventScroll:true});
    const key=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){event.preventDefault();setFull(false);return;}
      if(event.key!=='Tab'||!host.current)return;
      const items=[...host.current.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],[tabindex="0"]')];if(!items.length)return;
      const first=items[0],last=items[items.length-1];
      if(!host.current.contains(document.activeElement)){event.preventDefault();first.focus();}
      else if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    };
    document.addEventListener('keydown',key);return()=>{document.removeEventListener('keydown',key);root.style.overflow=previous;};
  },[full]);
  const zoomLabel=zoom===0?'Vừa bề ngang':'Phóng ×'+String(ZOOMS[zoom]).replace('.',',');
  const toggleFull=()=>{if(!full)setPlaceholder(host.current?.offsetHeight??0);setFull(f=>!f);};
  const viewer=<section className={`ep-card ep-pdf-viewer${full?' ep-pdf-full':''}`} ref={host} aria-label="Bản câu hỏi PDF" role={full?'dialog':undefined} aria-modal={full||undefined}><h2>Bản câu hỏi</h2>
    <div className="ep-toolbar"><button type="button" disabled={!doc||index===0} onClick={()=>setIndex(i=>i-1)}>Trang trước</button><span>Trang câu hỏi {index+1}/{file.questionPages.length}</span><button type="button" disabled={!doc||index===file.questionPages.length-1} onClick={()=>setIndex(i=>i+1)}>Trang sau</button></div>
    <div className="ep-toolbar ep-pdf-zoom" role="group" aria-label="Cỡ trang đề"><button type="button" aria-label="Thu nhỏ trang đề" disabled={!doc||zoom===0} onClick={()=>setZoom(z=>Math.max(0,z-1))}>−</button><span aria-live="polite">{zoomLabel}</span><button type="button" aria-label="Phóng to trang đề" disabled={!doc||zoom===ZOOMS.length-1} onClick={()=>setZoom(z=>Math.min(ZOOMS.length-1,z+1))}>+</button><button ref={fullButton} type="button" className="ep-pdf-full-toggle" aria-pressed={full} disabled={!doc&&!full} onClick={toggleFull}>{full?'Thoát toàn màn hình':'Toàn màn hình'}</button></div>
    {busy&&<p role="status">Đang hiển thị bản đề…</p>}{error&&<p role="alert">{error} Chưa mở làm bài khi bản câu hỏi chưa hiển thị. Liên kết nguồn có thể chứa đáp án hoặc mã đề khác.</p>}
    <div className={`ep-question-pdf${zoom>0?' is-zoomed':''}`} ref={sheet} tabIndex={zoom>0?0:undefined} aria-label={zoom>0?'Trang đề đang phóng, cuộn để xem phần khác':undefined}/></section>;
  // Toàn màn hình gắn vào body (lớp trên cùng), không bị đầu trang dính hay vùng cuộn của khung bài làm che/cắt.
  // Chỗ cũ giữ một khối cùng chiều cao để trang nền không nhảy; bài làm và đồng hồ vẫn chạy bình thường.
  return full?<><section className="ep-card ep-pdf-placeholder" style={{minHeight:placeholder||undefined}} aria-label="Bản câu hỏi PDF"><p role="status">Bản đề đang mở toàn màn hình.</p></section>{createPortal(viewer,document.body)}</>:viewer;
}

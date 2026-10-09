import {useEffect,useRef,useState} from 'react';
import {getDocument,GlobalWorkerOptions,AnnotationMode,type PDFDocumentProxy,type RenderTask} from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {fetchQuestionPdf,type QuestionPdf as QuestionPdfFile} from './pdf-source';
GlobalWorkerOptions.workerSrc=workerUrl;
export default function QuestionPdf({file,title,onReady}:{file:QuestionPdfFile;title:string;onReady:(ready:boolean)=>void}) {
  const [doc,setDoc]=useState<PDFDocumentProxy|null>(null),[index,setIndex]=useState(0),[width,setWidth]=useState(600),[error,setError]=useState(''),[busy,setBusy]=useState(true);
  const host=useRef<HTMLDivElement>(null),sheet=useRef<HTMLDivElement>(null),ready=useRef(onReady);ready.current=onReady;
  useEffect(()=>{const target=host.current;if(!target)return;const observer=new ResizeObserver(entries=>setWidth(Math.max(240,Math.floor(entries[0].contentRect.width))));observer.observe(target);return()=>observer.disconnect();},[]);
  useEffect(()=>{let active=true;const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),20000);let task:ReturnType<typeof getDocument>|undefined;
    ready.current(false);setDoc(null);setIndex(0);setError('');setBusy(true);
    void(async()=>{try{const bytes=await fetchQuestionPdf(file,controller.signal);if(!active)return;task=getDocument({data:bytes,enableXfa:false,stopAtErrors:true,useSystemFonts:true,maxImageSize:16000000});const loaded=await task.promise;if(loaded.numPages!==file.totalPages)throw Error('Số trang bản đề không khớp.');if(active){setDoc(loaded);clearTimeout(timeout);}}catch(e){if(active){setError(e instanceof Error?e.message:'Chưa xem được bản đề.');setBusy(false);ready.current(false);}}})();
    return()=>{active=false;controller.abort();clearTimeout(timeout);void task?.destroy().catch(()=>{});};
  },[file]);
  useEffect(()=>{if(!doc||!sheet.current)return;let active=true;let render:RenderTask|undefined;ready.current(false);setBusy(true);setError('');
    void(async()=>{try{const pageNumber=file.questionPages[index];if(!pageNumber)throw Error('Trang câu hỏi chưa hợp lệ.');const page=await doc.getPage(pageNumber);if(!active)return;const natural=page.getViewport({scale:1}),viewport=page.getViewport({scale:Math.min(1050,Math.max(240,width-24))/natural.width}),density=Math.min(2,devicePixelRatio||1,Math.sqrt(6000000/(viewport.width*viewport.height)));
      const canvas=document.createElement('canvas'),context=canvas.getContext('2d',{alpha:false});if(!context)throw Error('Trình duyệt chưa hiển thị được bản đề.');canvas.width=Math.ceil(viewport.width*density);canvas.height=Math.ceil(viewport.height*density);canvas.style.width=Math.ceil(viewport.width)+'px';canvas.style.height=Math.ceil(viewport.height)+'px';canvas.setAttribute('role','img');canvas.setAttribute('aria-label',`${title}, trang câu hỏi ${pageNumber}`);sheet.current?.replaceChildren(canvas);
      render=page.render({canvas,viewport,transform:density!==1?[density,0,0,density,0,0]:undefined,annotationMode:AnnotationMode.DISABLE});await render.promise;if(active){canvas.dataset.questionPage=String(pageNumber);setBusy(false);ready.current(true);}
    }catch(e){if(active){setError(e instanceof Error?e.message:'Chưa hiển thị được trang đề.');setBusy(false);ready.current(false);}}})();return()=>{active=false;render?.cancel();};
  },[doc,file,index,width]);
  return <section className="ep-card" ref={host} aria-label="Bản câu hỏi PDF"><h2>Bản câu hỏi</h2><div className="ep-toolbar"><button type="button" disabled={!doc||index===0} onClick={()=>setIndex(i=>i-1)}>Trang trước</button><span>Trang câu hỏi {index+1}/{file.questionPages.length}</span><button type="button" disabled={!doc||index===file.questionPages.length-1} onClick={()=>setIndex(i=>i+1)}>Trang sau</button></div>{busy&&<p role="status">Đang hiển thị bản đề…</p>}{error&&<p role="alert">{error} Chưa mở làm bài khi bản câu hỏi chưa hiển thị. Liên kết nguồn có thể chứa đáp án hoặc mã đề khác.</p>}<div className="ep-question-pdf" ref={sheet}/></section>;
}

import {useEffect,useRef,useState} from 'react';
import type {PDFDocumentProxy} from 'pdfjs-dist';
import {buildTextIndex,searchIndex,SEARCH_LIMITS,type TextIndex,type SearchResult} from './reader-search';
import './reader-tools.css';
export default function ReaderSearch({doc,onPage}:{doc:PDFDocumentProxy|null;onPage:(page:number)=>void}){
 const [query,setQuery]=useState(''),[busy,setBusy]=useState(false),[progress,setProgress]=useState(0),[error,setError]=useState(''),[result,setResult]=useState<SearchResult|null>(null),[selected,setSelected]=useState(-1),[coverage,setCoverage]=useState<TextIndex|null>(null);
 const cache=useRef<TextIndex|null>(null),request=useRef<{id:number;abort:AbortController}|null>(null),serial=useRef(0),resultRef=useRef<HTMLDivElement>(null);
 useEffect(()=>{cache.current=null;request.current?.abort.abort();serial.current++;setResult(null);setCoverage(null);setSelected(-1);setBusy(false);setProgress(0);setError('');return()=>{request.current?.abort.abort();serial.current++;};},[doc]);
 const cancel=()=>{request.current?.abort.abort();serial.current++;request.current=null;setBusy(false);};
 async function run(){
  if(!doc)return;cancel();setError('');setResult(null);setSelected(-1);setProgress(0);
  try{searchIndex({pages:[],pageCount:0,unreadable:[],clipped:[]},query);}catch{setError('Nhập từ 2 đến 100 ký tự để tìm trong lớp chữ PDF.');return;}
  const id=++serial.current,controller=new AbortController();request.current={id,abort:controller};setBusy(true);
  try{const index=cache.current??await buildTextIndex(doc,controller.signal,n=>{if(serial.current===id)setProgress(n);});if(serial.current!==id)return;cache.current=index;setCoverage(index);const found=searchIndex(index,query);setResult(found);setSelected(-1);}
  catch(e){if(serial.current===id&&!(e instanceof Error&&e.name==='AbortError'))setError('Chưa đọc được lớp chữ. Tài liệu vẫn đọc được; thử tìm lại hoặc xem trang trực tiếp.');}
  finally{if(serial.current===id){setBusy(false);request.current=null;}}
 }
 function choose(index:number){if(!result?.hits.length)return;const n=(index+result.hits.length)%result.hits.length;setSelected(n);onPage(result.hits[n].page);window.setTimeout(()=>resultRef.current?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]')?.scrollIntoView({block:'nearest'}),0);}
 const incomplete=coverage&&(coverage.unreadable.length||coverage.clipped.length);
 return <details className="reader-find"><summary>Tìm chữ trong tài liệu</summary><div className="reader-find-body">
  <form className="reader-find-form" onSubmit={e=>{e.preventDefault();void run();}}><label htmlFor="reader-find-query">Từ hoặc cụm từ</label><input id="reader-find-query" value={query} maxLength={SEARCH_LIMITS.query} placeholder="Ví dụ: hàm số, xác suất…" disabled={!doc} onChange={e=>{cancel();setQuery(e.target.value);setResult(null);setSelected(-1);setError('');}} onKeyDown={e=>{if(e.key==='Escape'){cancel();setQuery('');setResult(null);setError('');}}}/><button type="submit" disabled={!doc||busy}>Tìm trong PDF</button>{busy&&<button type="button" onClick={cancel}>Hủy tìm</button>}</form>
  <p className="reader-find-hint">Có thể gõ không dấu. Chỉ tìm trên lớp chữ sẵn có, không nhận dạng ảnh hoặc suy đoán công thức. Từ tìm không được gửi lên máy chủ hay lưu lại.</p>
  {busy&&<p className="reader-find-status" role="status">Đang đọc lớp chữ: {progress}/{doc?.numPages} trang…</p>}
  {error&&<p role="alert" className="reader-find-error">{error}</p>}
  {result&&<><div className="reader-find-status" role="status" data-results={result.hits.length} data-limited={result.limited}><b>{result.hits.length?`${result.limited?'Hiển thị tối đa ':''}${result.hits.length} kết quả trên ${result.pagesWithMatches} trang`:'Không tìm thấy trong lớp chữ đã đọc.'}</b>{result.limited&&<span> Hãy nhập cụm từ cụ thể hơn.</span>}</div>
   {incomplete?<p className="reader-find-error">Kết quả chưa bao phủ toàn bộ PDF: {coverage!.unreadable.length} trang lỗi đọc và {coverage!.clipped.length} trang bị giới hạn dung lượng lớp chữ.</p>:!coverage?.pages.some(p=>p.text.trim())?<p className="reader-find-hint">Không có lớp chữ để tìm. Nội dung có thể là ảnh quét; vẫn xem nguyên bản trong khung đọc.</p>:null}
   {result.hits.length>0&&<><div className="reader-hit-controls"><button type="button" onClick={()=>choose(selected<0?result.hits.length-1:selected-1)} aria-label="Kết quả trước">←</button><span>{selected<0?'Chọn một kết quả':`${selected+1}/${result.hits.length} · Trang ${result.hits[selected].page}`}</span><button type="button" onClick={()=>choose(selected+1)} aria-label="Kết quả tiếp theo">→</button></div><div ref={resultRef} className="reader-hit-list" aria-label="Kết quả tìm trong PDF">{result.hits.map((hit,n)=><button type="button" className="reader-hit" key={hit.key} data-page={hit.page} aria-pressed={selected===n} onClick={()=>choose(n)}><b>Trang {hit.page}</b><span>…{hit.before}<mark>{hit.match}</mark>{hit.after}…</span></button>)}</div><p className="reader-find-hint">Chọn kết quả để mở đúng trang. Phần tô màu nằm trong trích đoạn tìm, không sửa PDF gốc. Công thức và ký hiệu trong lớp chữ có thể không đầy đủ; đối chiếu trang PDF nguyên bản.</p></>}
  </>}
 </div></details>;
}

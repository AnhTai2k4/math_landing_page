/// <reference path="./react-dom-portal.d.ts" />
import {useCallback,useEffect,useRef,useState,type SyntheticEvent} from 'react';
import {createPortal} from 'react-dom';
import './zoomable-image.css';

// TH-02 (Đợt 4): ảnh câu hỏi thu nhỏ còn khoảng 277 px trên điện thoại (ảnh gốc rộng 1562 px), chữ chỉ còn 4-7 px.
// Bấm ảnh (hoặc nút "Phóng to") mở khung xem toàn màn: ảnh vừa bề ngang, phóng tới 3 lần và cuộn hai chiều.
// Đóng bằng nút, phím Esc hoặc vuốt xuống khi đang ở cỡ vừa màn. Khung xem chỉ là lớp hiển thị: không đổi
// trạng thái bài làm, không đổi URL, không ghi bộ nhớ, nên đáp án đang nhập giữ nguyên.
const LEVELS=[1,1.5,2,3,4] as const;
const levelText=(level:number)=>'Phóng ×'+String(LEVELS[level]).replace('.',',');
// Ảnh đề là dải rộng (1562 px) nên "vừa bề ngang" trên điện thoại vẫn chỉ còn khoảng 24% cỡ gốc. Khi mở, chọn mức
// phóng nhỏ nhất đưa ảnh về từ 55% cỡ gốc trở lên (chữ đọc được); ảnh hình nhỏ hoặc màn rộng thì giữ vừa màn.
const READABLE_SCALE=.55;
export function initialLevel(areaWidth:number,naturalWidth:number|undefined){
  if(!naturalWidth||areaWidth<=0)return 0;
  const fit=Math.min(areaWidth,naturalWidth);
  const index=LEVELS.findIndex(level=>fit*level/naturalWidth>=READABLE_SCALE);
  return index<0?LEVELS.length-1:index;
}

type Props={src:string;alt:string;width?:number;height?:number;label:string;loading?:'lazy'|'eager';onError?:(event:SyntheticEvent<HTMLImageElement>)=>void};

export default function ZoomableImage({src,alt,width,height,label,loading='lazy',onError}:Props){
  const [open,setOpen]=useState(false);
  const trigger=useRef<HTMLButtonElement>(null),image=useRef<HTMLImageElement>(null);
  const wasOpen=useRef(false);
  const close=useCallback(()=>setOpen(false),[]);
  // Trả tiêu điểm về nút "Phóng to" sau khi khung xem đã gỡ (dialog.close() trả tiêu điểm về body trước đó).
  useEffect(()=>{if(wasOpen.current&&!open&&trigger.current?.isConnected)trigger.current.focus({preventScroll:true});wasOpen.current=open;},[open]);
  return <>
    <img ref={image} className="ep-zoomable" src={src} width={width} height={height} alt={alt} loading={loading} decoding="async" onError={onError} onClick={()=>setOpen(true)}/>
    <div className="ep-zoom-row"><button ref={trigger} type="button" className="ep-zoom-open" aria-haspopup="dialog" aria-label={`Phóng to ${label}`} onClick={()=>setOpen(true)}><span aria-hidden="true">⤢</span> Phóng to</button></div>
    {open&&<ZoomDialog src={src} alt={alt} width={width??(image.current?.naturalWidth||undefined)} height={height??(image.current?.naturalHeight||undefined)} label={label} onClose={close}/>}
  </>;
}

function ZoomDialog({src,alt,width,height,label,onClose}:{src:string;alt:string;width?:number;height?:number;label:string;onClose:()=>void}){
  const dialog=useRef<HTMLDialogElement>(null),area=useRef<HTMLDivElement>(null),closeButton=useRef<HTMLButtonElement>(null);
  const [level,setLevel]=useState(0);
  const swipe=useRef<{x:number;y:number;active:boolean;dy:number}|null>(null);
  useEffect(()=>{
    const node=dialog.current;if(!node)return;
    const root=document.documentElement,previous=root.style.overflow;
    if(!node.open){try{node.showModal();}catch{node.setAttribute('open','');}}
    root.style.overflow='hidden';closeButton.current?.focus({preventScroll:true});
    setLevel(initialLevel(area.current?.clientWidth??0,width));
    return()=>{root.style.overflow=previous;if(node.open)node.close();};
  },[]);
  // Giữ điểm giữa vùng đang xem khi đổi mức phóng, để không bị nhảy về góc trên trái.
  const zoomTo=(next:number)=>{
    const box=area.current;if(next===level||next<0||next>=LEVELS.length)return;
    const ratio=LEVELS[next]/LEVELS[level];
    const cx=box?(box.scrollLeft+box.clientWidth/2)*ratio-box.clientWidth/2:0,cy=box?(box.scrollTop+box.clientHeight/2)*ratio-box.clientHeight/2:0;
    setLevel(next);
    window.setTimeout(()=>{if(box){box.scrollLeft=Math.max(0,cx);box.scrollTop=Math.max(0,cy);}},0);
  };
  const reset=(element:HTMLElement|null)=>{if(element){element.style.transform='';element.style.opacity='';}};
  return createPortal(<dialog ref={dialog} className="ep-zoom-dialog" aria-label={`Xem lớn ${label}`} onCancel={event=>{event.preventDefault();onClose();}}>
    <div className="ep-zoom-bar">
      <p className="ep-zoom-title">{label}</p>
      <div className="ep-zoom-tools" role="group" aria-label="Mức phóng">
        <button type="button" onClick={()=>zoomTo(level-1)} disabled={level===0} aria-label="Thu nhỏ">−</button>
        <span aria-live="polite">{level===0?'Vừa màn':levelText(level)}</span>
        <button type="button" onClick={()=>zoomTo(level+1)} disabled={level===LEVELS.length-1} aria-label="Phóng to thêm">+</button>
      </div>
      <button ref={closeButton} type="button" className="ep-zoom-close" onClick={onClose}>Đóng <span aria-hidden="true">✕</span></button>
    </div>
    <div ref={area} className={`ep-zoom-area${level>0?' is-zoomed':''}`} tabIndex={0} aria-label="Vùng ảnh, cuộn để xem phần khác"
      onTouchStart={event=>{const t=event.touches[0];// Vuốt xuống để đóng chỉ khi vùng xem đang ở mép trên (kéo xuống lúc này vốn không cuộn được gì).
        swipe.current=event.touches.length===1&&(area.current?.scrollTop??0)<=0?{x:t.clientX,y:t.clientY,active:true,dy:0}:null;}}
      onTouchMove={event=>{const s=swipe.current,t=event.touches[0];if(!s?.active||!t)return;const dx=t.clientX-s.x,dy=t.clientY-s.y;
        if(dy<-10||Math.abs(dx)>40&&Math.abs(dx)>Math.abs(dy)){s.active=false;reset(area.current?.firstElementChild as HTMLElement|null);return;}
        s.dy=Math.max(0,dy);const img=area.current?.firstElementChild as HTMLElement|null;if(img){img.style.transform=`translateY(${s.dy}px)`;img.style.opacity=String(Math.max(.4,1-s.dy/400));}}}
      onTouchEnd={()=>{const s=swipe.current;swipe.current=null;reset(area.current?.firstElementChild as HTMLElement|null);if(s?.active&&s.dy>90)onClose();}}
      onTouchCancel={()=>{swipe.current=null;reset(area.current?.firstElementChild as HTMLElement|null);}}>
      <img src={src} alt={alt} width={width} height={height} decoding="async" style={{width:`calc(min(100%, ${width??2000}px) * ${LEVELS[level]})`}}/>
    </div>
    <p className="ep-zoom-hint">{level===0?'Bấm + để phóng to. Vuốt xuống, bấm Đóng hoặc phím Esc để quay lại bài.':'Kéo để xem phần khác của ảnh; bấm − để thu nhỏ. Vuốt xuống ở mép trên hoặc bấm Đóng để quay lại bài.'}</p>
  </dialog>,document.body);
}

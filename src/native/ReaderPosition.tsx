import {useEffect,useRef,useState} from 'react';
import type {ReaderFile} from './reader-policy';
import {browserPositionStorage,readPosition,savePosition,forgetPosition,positionKey,type ReadingPosition,type PositionState} from './reader-position';
import './reader-tools.css';
export default function ReaderPosition({file,page,zoom,shown,busy,explicit,onPage}:{file:ReaderFile;page:number;zoom:number;shown:number;busy:boolean;explicit:boolean;onPage:(page:number,zoom:number)=>void}){
 const [status,setStatus]=useState<PositionState>({state:'empty'}),[offer,setOffer]=useState<ReadingPosition|null>(null),[message,setMessage]=useState(''),[initialized,setInitialized]=useState(false);
 const suspended=useRef(false),view=useRef(page+':'+zoom),lastSaved=useRef(''),expected=useRef<string|null>(null),current=useRef({page,zoom});current.current={page,zoom};
 useEffect(()=>{const saved=readPosition(browserPositionStorage(),file);setStatus(saved);const hasOffer=saved.state==='saved'&&!explicit&&(saved.value.page!==page||saved.value.zoom!==zoom);suspended.current=!!hasOffer||saved.state==='invalid'||saved.state==='unavailable';setOffer(hasOffer&&saved.state==='saved'?saved.value:null);setInitialized(true);
  const onStorage=(event:StorageEvent)=>{if(event.key!==positionKey(file))return;const latest=readPosition(browserPositionStorage(),file);setStatus(latest);suspended.current=true;lastSaved.current='';setMessage('Vị trí đọc vừa thay đổi ở thẻ khác. Trang hiện tại không bị chuyển.');setOffer(latest.state==='saved'&&(latest.value.page!==current.current.page||latest.value.zoom!==current.current.zoom)?latest.value:null);};
  window.addEventListener('storage',onStorage);return()=>window.removeEventListener('storage',onStorage);
 },[file.sha256]);
 useEffect(()=>{if(!initialized)return;const key=page+':'+zoom;if(view.current!==key){view.current=key;if(status.state!=='invalid'&&status.state!=='unavailable')suspended.current=false;setOffer(null);setMessage('');}
  if(busy||shown!==page||suspended.current||key===lastSaved.current||(expected.current&&expected.current!==key))return;
  const result=savePosition(browserPositionStorage(),file,page,zoom);setStatus(result);if(result.state==='saved'){lastSaved.current=key;expected.current=null;}else suspended.current=true;
 },[file,page,zoom,shown,busy,initialized]);
 function resume(){if(!offer)return;expected.current=offer.page+':'+offer.zoom;suspended.current=false;lastSaved.current='';onPage(offer.page,offer.zoom);setOffer(null);setMessage('Đang mở lại vị trí đã nhớ trên thiết bị này.');}
 function forget(){const ok=forgetPosition(browserPositionStorage(),file);if(ok){suspended.current=true;lastSaved.current='';expected.current=null;setOffer(null);setStatus({state:'empty'});setMessage('Đã xóa vị trí của PDF này. Chỉ nhớ lại sau khi chuyển trang hoặc đổi mức phóng.');}else{setStatus({state:'unavailable'});setMessage('Không xóa được vị trí vì bộ nhớ trình duyệt không cho phép.');}}
 return <div className="reader-position" data-position-state={status.state} aria-label="Vị trí đọc trên thiết bị">
  <div><b>Nhớ trang trên thiết bị này</b><p>{offer?`Lần trước dừng ở trang ${offer.page} / ${file.pages}.`:status.state==='saved'?`Đã nhớ trang ${status.value.page} / ${file.pages}.`:status.state==='invalid'?'Bản nhớ không hợp lệ; đã giữ nguyên và không áp dụng lên tài liệu.':status.state==='unavailable'?'Trình duyệt không cho phép lưu. PDF vẫn đọc được bình thường.':'Chưa có vị trí đã nhớ.'}</p><small>Chỉ lưu mã tệp, trang, mức phóng và thời gian trên trình duyệt này; không đồng bộ tài khoản. Các mục dùng cùng PDF chia sẻ vị trí.</small></div>
  <div className="reader-position-actions">{offer&&<button type="button" onClick={resume} disabled={busy}>Đọc tiếp trang {offer.page}</button>}{(status.state==='saved'||status.state==='invalid')&&<button type="button" className="reader-forget" onClick={forget}>Xóa vị trí đã nhớ</button>}</div>
  {message&&<p className="reader-position-message" role="status">{message}</p>}
 </div>;
}

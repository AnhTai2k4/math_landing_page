import {useEffect,useRef,useState} from 'react';
import type {ReaderFile} from './reader-policy';
import {bookmarkKey,browserBookmarkStorage,readBookmarks,toggleBookmark,type BookmarkState} from './reader-bookmarks';
import './reader-bookmarks-v2.css';

export default function ReaderBookmarks({file,page,shown,busy,onPage}:{file:ReaderFile;page:number;shown:number;busy:boolean;onPage:(page:number)=>void}){
 const identity=[file.id,file.sha256,file.path,file.bytes,file.pages].join(':');
 const [saved,setSaved]=useState(()=>({identity,status:readBookmarks(browserBookmarkStorage(),file)}));
 const [message,setMessage]=useState('');
 const navigation=useRef<HTMLDivElement>(null);
 const status:BookmarkState=saved.identity===identity?saved.status:{state:'unavailable'};
 const rendered=Number.isInteger(page)&&page>=1&&page<=file.pages&&shown===page&&!busy;
 const marked=status.state==='ready'&&status.pages.includes(page);
 let previous:number|null=null,next:number|null=null;
 if(status.state==='ready'&&Number.isInteger(page)&&page>=1&&page<=file.pages){
  for(const target of status.pages){if(target<page)previous=target;else if(target>page){next=target;break;}}
 }
 const snapshot={identity,page,shown,busy,status};
 const current=useRef<typeof snapshot|null>(snapshot);
 current.current=snapshot;
 const update=(value:BookmarkState)=>setSaved({identity,status:value});

 useEffect(()=>{
  const storage=browserBookmarkStorage();
  update(readBookmarks(storage,file));
  setMessage('');
  let key:string;
  try{key=bookmarkKey(file);}catch{return;}
  const onStorage=(event:StorageEvent)=>{
   if(current.current?.identity!==identity||!storage||(event.key!==key&&event.key!==null)||event.storageArea!==storage)return;
   update(readBookmarks(storage,file));
   setMessage('Dấu trang vừa thay đổi ở thẻ khác. Đã đọc lại danh sách; trang đang xem được giữ nguyên.');
  };
  window.addEventListener('storage',onStorage);
  return()=>window.removeEventListener('storage',onStorage);
 },[file,identity]);
 useEffect(()=>{current.current=snapshot;return()=>{current.current=null;};},[]);

 function openBookmark(target:number){
  if(current.current!==snapshot||!rendered||status.state!=='ready'||!Number.isInteger(target)||target<1||target>file.pages||!status.pages.includes(target))return;
  // Another tab may have changed storage before its storage event was delivered.
  const latest=readBookmarks(browserBookmarkStorage(),file);
  if(latest.state!=='ready'||latest.raw!==status.raw){
   update(latest);
   setMessage('Dấu trang vừa thay đổi hoặc chưa đọc được. Đã thử đọc lại danh sách; chưa chuyển trang.');
   return;
  }
  navigation.current?.focus();
  setMessage('Đã chọn trang '+target+' đã đánh dấu.');
  onPage(target);
 }

 function toggle(){
  if(current.current!==snapshot||!rendered||status.state!=='ready')return;
  const storage=browserBookmarkStorage();
  const next=toggleBookmark(storage,file,page,status.raw);
  if(next.state==='conflict'){
   update(readBookmarks(storage,file));
   setMessage('Dấu trang đã thay đổi ở thẻ khác. Đã đọc lại danh sách, chưa lưu thao tác này. Vui lòng kiểm tra và thử lại.');
  }else if(next.state==='invalid'&&!marked&&status.pages.length>=50){
   // The limit is a rejected action, not a corrupt stored list.
   update(readBookmarks(storage,file));
   setMessage('Đã đủ 50 dấu trang. Hãy mở một trang đã đánh dấu và bỏ dấu trang đó trước khi thêm trang mới.');
  }else{
   update(next);
   setMessage(next.state==='ready'?(marked?'Đã bỏ đánh dấu trang ':'Đã đánh dấu trang ')+page+'.':next.state==='unavailable'?'Chưa xác nhận được thao tác lưu. Hãy đọc lại dấu trang trước khi thử lại.':'Không lưu được vì dữ liệu dấu trang không hợp lệ; dữ liệu được giữ nguyên.');
  }
 }

 return <section className="reader-bookmarks" aria-label="Trang đã đánh dấu" data-bookmark-state={status.state} data-bookmark-version="2">
  <div className="reader-bookmarks-heading"><b>Trang đã đánh dấu</b><button type="button" className="reader-bookmark-toggle" aria-pressed={marked} disabled={!rendered||status.state!=='ready'} onClick={toggle}>{marked?'Bỏ đánh dấu trang ':'Đánh dấu trang '}{page}</button></div>
  <p className="reader-bookmarks-disclosure">Chỉ lưu số trang và mã PDF trên trình duyệt này, tối đa 50 trang mỗi PDF; không đồng bộ tài khoản hoặc thiết bị. Các mục dùng cùng PDF chia sẻ dấu trang.</p>
  <div className="reader-bookmarks-navigation" role="group" aria-label="Đi nhanh giữa các dấu trang" tabIndex={-1} ref={navigation}>
   <button type="button" disabled={!rendered||previous===null} onClick={()=>{if(previous!==null)openBookmark(previous);}}>Dấu trang trước{previous!==null?': trang '+previous:''}</button>
   <button type="button" disabled={!rendered||next===null} onClick={()=>{if(next!==null)openBookmark(next);}}>Dấu trang sau{next!==null?': trang '+next:''}</button>
  </div>
  {status.state==='ready'?status.pages.length===0?<p>Chưa có trang nào được đánh dấu.</p>:<><p>Đi tới dấu gần nhất trước hoặc sau trang {page}, không quay vòng. Hoặc chọn một trang trong danh sách:</p><ul className="reader-bookmarks-list">{status.pages.map(target=><li key={target}><button type="button" aria-label={'Mở trang '+target+' đã đánh dấu'} aria-current={target===page?'page':undefined} disabled={!rendered} onClick={()=>openBookmark(target)}>Trang {target}</button></li>)}</ul></>:<p role="status">{status.state==='invalid'?'Dữ liệu dấu trang không hợp lệ; đã giữ nguyên, không tự sửa hoặc xóa.':'Không truy cập hoặc xác nhận được bộ nhớ trình duyệt. PDF vẫn đọc được bình thường.'}</p>}
  {status.state!=='ready'&&<button type="button" onClick={()=>{if(current.current!==snapshot)return;update(readBookmarks(browserBookmarkStorage(),file));setMessage('Đã thử đọc lại dấu trang; chưa ghi thêm thay đổi.');}}>Đọc lại dấu trang</button>}
  {!rendered&&<p>Chờ trang {page} hiển thị xong để đánh dấu, bỏ dấu hoặc đi tới dấu trang.</p>}
  <p className="reader-bookmarks-message" role="status" aria-live="polite">{message}</p>
 </section>;
}

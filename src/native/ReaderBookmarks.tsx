import {useEffect,useState} from 'react';
import type {ReaderFile} from './reader-policy';
import {bookmarkKey,browserBookmarkStorage,readBookmarks,toggleBookmark,type BookmarkState} from './reader-bookmarks';

export default function ReaderBookmarks({file,page,shown,busy,onPage}:{file:ReaderFile;page:number;shown:number;busy:boolean;onPage:(page:number)=>void}){
 const [status,setStatus]=useState<BookmarkState>(()=>readBookmarks(browserBookmarkStorage(),file));
 const [message,setMessage]=useState('');
 const rendered=shown===page&&!busy;
 const marked=status.state==='ready'&&status.pages.includes(page);

 useEffect(()=>{
  const storage=browserBookmarkStorage(),key=bookmarkKey(file);
  setStatus(readBookmarks(storage,file));
  const onStorage=(event:StorageEvent)=>{
   if(!storage||event.key!==key||event.storageArea!==storage)return;
   setStatus(readBookmarks(storage,file));
   setMessage('Dấu trang vừa thay đổi ở thẻ khác. Đã đọc lại danh sách; trang đang xem được giữ nguyên.');
  };
  window.addEventListener('storage',onStorage);
  return()=>window.removeEventListener('storage',onStorage);
 },[file]);

 function toggle(){
  if(!rendered||status.state!=='ready')return;
  const storage=browserBookmarkStorage();
  const next=toggleBookmark(storage,file,page,status.raw);
  if(next.state==='conflict'){
   setStatus(readBookmarks(storage,file));
   setMessage('Dấu trang đã thay đổi ở thẻ khác. Đã đọc lại danh sách, chưa lưu thao tác này. Vui lòng kiểm tra và thử lại.');
  }else if(next.state==='invalid'&&!marked&&status.pages.length>=50){
   // The limit is a rejected action, not a corrupt stored list.
   setStatus(readBookmarks(storage,file));
   setMessage('Đã đủ 50 dấu trang. Hãy mở một trang đã đánh dấu và bỏ dấu trang đó trước khi thêm trang mới.');
  }else{
   setStatus(next);
   setMessage(next.state==='ready'?(marked?'Đã bỏ đánh dấu trang ':'Đã đánh dấu trang ')+page+'.':next.state==='unavailable'?'Chưa xác nhận được thao tác lưu. Hãy đọc lại dấu trang trước khi thử lại.':'Không lưu được vì dữ liệu dấu trang không hợp lệ; dữ liệu được giữ nguyên.');
  }
 }

 return <section className="reader-bookmarks" aria-label="Trang đã đánh dấu" data-bookmark-state={status.state}>
  <div className="reader-bookmarks-heading"><b>Trang đã đánh dấu</b><button type="button" className="reader-bookmark-toggle" aria-pressed={marked} disabled={!rendered||status.state!=='ready'} onClick={toggle}>{marked?'Bỏ đánh dấu trang ':'Đánh dấu trang '}{page}</button></div>
  <p className="reader-bookmarks-disclosure">Chỉ lưu số trang và mã PDF trên trình duyệt này, tối đa 50 trang mỗi PDF; không đồng bộ tài khoản hoặc thiết bị. Các mục dùng cùng PDF chia sẻ dấu trang.</p>
  {status.state==='ready'?status.pages.length===0?<p>Chưa có trang nào được đánh dấu.</p>:<ul className="reader-bookmarks-list">{status.pages.map(saved=><li key={saved}><button type="button" aria-label={'Mở trang '+saved+' đã đánh dấu'} aria-current={saved===page?'page':undefined} onClick={()=>onPage(saved)}>Trang {saved}</button></li>)}</ul>:<p role="status">{status.state==='invalid'?'Dữ liệu dấu trang không hợp lệ; đã giữ nguyên, không tự sửa hoặc xóa.':'Không truy cập hoặc xác nhận được bộ nhớ trình duyệt. PDF vẫn đọc được bình thường.'}</p>}
  {status.state!=='ready'&&<button type="button" onClick={()=>{setStatus(readBookmarks(browserBookmarkStorage(),file));setMessage('Đã thử đọc lại dấu trang; chưa ghi thêm thay đổi.');}}>Đọc lại dấu trang</button>}
  {!rendered&&<p>Chờ trang {page} hiển thị xong để đánh dấu hoặc bỏ dấu trang.</p>}
  <p className="reader-bookmarks-message" role="status" aria-live="polite">{message}</p>
 </section>;
}

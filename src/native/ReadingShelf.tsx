import {useEffect,useId,useRef,useState} from 'react';
import {Link} from '../migration/navigation';
import {browserPositionStorage,positionKey} from './reader-position';
import {type ReaderFile} from './reader-policy';
import {collectReading,type ReadingCollection} from './reading-shelf';

type Props={files:ReaderFile[];search:string};

export default function ReadingShelf({files,search}:Props){
 // Equivalent fresh arrays do not restart the listener or trigger effect loops.
 // A changed filter, order or manifest starts a fresh scoped collection.
 return <ReadingShelfContents key={JSON.stringify([files,search])} files={files} search={search}/>;
}

function ReadingShelfContents({files,search}:Props){
 const headingId=useId(),scope=useRef({files,search});
 const [reading,setReading]=useState<ReadingCollection|null>(null);
 useEffect(()=>{
  const {files,search}=scope.current,storage=browserPositionStorage(),keys=new Set<string>();
  for(const file of files){try{keys.add(positionKey(file));}catch{/* Ignore invalid manifest rows. */}}
  const refresh=()=>setReading(collectReading(storage,files,search));
  const onStorage=(event:StorageEvent)=>{
   if(storage&&event.storageArea===storage&&(event.key===null||keys.has(event.key)))refresh();
  };
  window.addEventListener('storage',onStorage);
  refresh();
  return()=>window.removeEventListener('storage',onStorage);
 },[]);

 return <section className="ne-reading-shelf" aria-labelledby={headingId}>
  <h2 id={headingId}>Đọc tiếp trên thiết bị này</h2>
  <p>Vị trí đọc chỉ được lưu trong trình duyệt trên thiết bị này, không đồng bộ tài khoản và không thể hiện việc hoàn thành khóa học.</p>
  <div role="status" aria-live="polite" aria-atomic="true">
   {!reading&&<p>Đang đọc vị trí đã lưu trên thiết bị…</p>}
   {reading?.unavailable&&<p>Không truy cập được một phần hoặc toàn bộ vị trí đọc trên thiết bị này. Chưa thể xác định đầy đủ lịch sử đọc.</p>}
   {!!reading?.invalid&&<p>Có {reading.invalid} vị trí đọc không hợp lệ nên chưa hiển thị. Dữ liệu gốc vẫn được giữ nguyên.</p>}
   {reading&&!reading.unavailable&&!reading.invalid&&!reading.items.length&&<p>Chưa có vị trí đọc được lưu trên thiết bị này cho các tài liệu trong danh sách đang lọc.</p>}
  </div>
  {!!reading?.items.length&&<ul>{reading.items.map(({file,position,href})=><li key={file.sha256}>
   <h3>{file.observedContents}</h3>
   <p>Trang {position.page}/{file.pages} · Thu phóng {position.zoom}%</p>
   <p>Lưu trên thiết bị: <time dateTime={new Date(position.at).toISOString()}>{new Date(position.at).toLocaleString('vi-VN')}</time></p>
   {file.sourceMetadataNeedsReview&&<p className="ne-reading-shelf-warning">Nhãn/lớp theo nguồn đang chờ đối chiếu.</p>}
   <Link href={href}>Đọc tiếp trang {position.page}</Link>
  </li>)}</ul>}
 </section>;
}

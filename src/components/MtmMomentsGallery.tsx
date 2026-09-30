import './mtm-moments.css';

const moments = [
  {n:1, alt:'Ảnh nhóm MTM cùng sách và bàn học', label:'Cùng nhau, thêm niềm vui', width:1400,height:933},
  {n:2, alt:'Hai người mặc áo MTM chụp ảnh cùng nhau',label:'Một chút tinh nghịch',width:933,height:1400},
  {n:3, alt:'Ảnh nhóm năm người mặc áo MTM cùng cười',label:'Những nụ cười bên nhau',width:1400,height:933},
  {n:4, alt:'Hai người bên sách và máy tính trong bộ ảnh MTM',label:'Sách vở và những người bạn',width:1400,height:933},
  {n:5, alt:'Ảnh nhóm quay lưng với biểu trưng MTM trên áo',label:'Chung một màu áo',width:1400,height:933},
  {n:6, alt:'Ảnh nhóm MTM; Nguyễn Duy Hoàng ngoài cùng trái, Trần Thanh Anh Tài ngoài cùng phải',label:'Gặp gỡ đội ngũ MTM',width:1400,height:933},
];

export function MtmMomentsGallery(){return <div className="mtm-moments" aria-labelledby="mtm-moments-title">
  <div className="mtm-moments-heading"><div><p className="mtm-eyebrow">KHOẢNH KHẮC MTM</p><h3 id="mtm-moments-title">Cùng nhau học Toán,<br />cùng giữ những niềm vui.</h3></div><span aria-hidden="true" className="mtm-moments-sticker">Hello,<br />MTM! ✦</span></div>
  <div className="mtm-moments-grid">{moments.map(photo=><figure className={`mtm-moment mtm-moment-${photo.n}`} key={photo.n}>
    <img src={`/gallery/mtm-moment-${photo.n}.webp`} alt={photo.alt} width={photo.width} height={photo.height} loading="lazy" decoding="async" />
    <figcaption><span>{photo.label}</span>{photo.n===6&&<small>Trong ảnh: Nguyễn Duy Hoàng — giáo viên cấp 2 (ngoài cùng trái); Trần Thanh Anh Tài — giáo viên cấp 3, HSA (ngoài cùng phải).</small>}</figcaption>
  </figure>)}</div>
</div>}

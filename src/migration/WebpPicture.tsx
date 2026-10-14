// KT-19 (Đợt 3): ảnh WebP đúng cỡ cho trang chủ và danh mục khóa học. Ảnh gốc (PNG/JPG) giữ nguyên trong <img>
// làm dự phòng cho trình duyệt không đọc WebP; tên tệp WebP là <tên gốc>-<bề ngang>w.webp, tạo từ chính ảnh gốc.
import type {ImgHTMLAttributes} from 'react';

const VARIANTS:Record<string,number[]>={
  '/mtm-original-logo.png':[420,640],
  '/migration-assets/source-avatar.jpg':[480,800,1200],
};
const COURSE=/^\/migration-assets\/course-[a-z0-9-]+\.png$/;

/** srcset WebP cho ảnh có bản WebP, hoặc undefined nếu chưa có (khi đó chỉ dùng ảnh gốc). */
export function webpSrcSet(src:string):string|undefined{
  const widths=VARIANTS[src]??(COURSE.test(src)?[640,1012]:undefined);
  if(!widths)return undefined;
  const base=src.replace(/\.(png|jpe?g)$/i,'');
  return widths.map(w=>`${base}-${w}w.webp ${w}w`).join(', ');
}

type Props=ImgHTMLAttributes<HTMLImageElement>&{src:string;sizes:string};
/** <picture> bọc <img> cũ; .mig-picture{display:contents} nên bố cục và CSS của <img> không đổi. */
export function WebpPicture({sizes,...img}:Props){
  const set=webpSrcSet(img.src);
  if(!set)return <img {...img}/>;
  return <picture className="mig-picture"><source type="image/webp" srcSet={set} sizes={sizes}/><img {...img}/></picture>;
}

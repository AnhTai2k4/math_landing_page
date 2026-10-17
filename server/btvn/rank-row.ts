import {AVATARS,PHOTO_MAX_CHARS,validPhoto,validSchool,type AvatarId} from './avatar-http';

/** Phép chiếu công khai dùng chung cho top 10 và hạng của em.
 * Chỉ các trường được duyệt đi ra API; không chuyển mã hoặc điện thoại từ RPC. */
export function publicRankRow(r:any,maxRank=Number.MAX_SAFE_INTEGER){
 if(!r||!Number.isSafeInteger(r.rank)||r.rank<1||r.rank>maxRank||!validSchool(r.fullName)||!r.fullName.trim()||typeof r.className!=='string'||r.className.length>100||!validSchool(r.className)||typeof r.score!=='number'||!Number.isFinite(r.score)||r.score<0||r.score>10||!Number.isSafeInteger(r.submitted)||!Number.isSafeInteger(r.total)||r.total<1||r.submitted<0||r.submitted>r.total)throw Error('Invalid rank row');
 if(r.school!==undefined&&r.school!==null&&!validSchool(r.school))throw Error('Invalid rank school');
 if(r.avatar!==undefined&&r.avatar!==null&&!AVATARS.includes(r.avatar as AvatarId))throw Error('Invalid rank avatar');
 if(r.photo!==undefined&&r.photo!==null&&typeof r.photo!=='string')throw Error('Invalid rank photo');
 if(r.photo_hidden!==undefined&&typeof r.photo_hidden!=='boolean')throw Error('Invalid moderation flag');
 // Ảnh cũ từng cho phép lớn hơn 40k không làm hỏng toàn bảng. Chỉ bỏ ảnh đó;
 // ảnh nhỏ vẫn phải qua đúng bộ kiểm JPEG 192x192 dùng khi lưu hồ sơ.
 const photo=typeof r.photo==='string'&&r.photo.length<=PHOTO_MAX_CHARS?r.photo:null;
 if(photo!==null&&!validPhoto(photo))throw Error('Invalid rank photo');
 const school=typeof r.school==='string'?r.school.normalize('NFC').trim().replace(/\s+/g,' '):'';
 return {rank:r.rank,fullName:r.fullName,className:r.className,school:school&&!['chưa cập nhật','chua cap nhat'].includes(school.toLocaleLowerCase('vi'))?school:null,avatar:r.avatar??null,photo:r.photo_hidden?null:photo||null,score:r.score,submitted:r.submitted,total:r.total};
}
// Phép chiếu ẩn danh được giữ cho nơi chưa có quyền công khai danh tính.
export function anonymousRankRow(r:any,maxRank=10){
 const {rank,className,score,submitted,total}=publicRankRow(r,maxRank);
 return {rank,className,score,submitted,total};
}
export function validRankFilter(cohort:unknown,kind:unknown,cls:unknown){return typeof cohort==='string'&&['2K9','2K10','2K11','2K12','2K13','2K14'].includes(cohort)&&typeof kind==='string'&&['btvn-tuan','btvn-thang','kiem-tra-thang'].includes(kind)&&(cls===undefined||cls===null||typeof cls==='string'&&cls.length<=100&&cls.startsWith(cohort+' '));}

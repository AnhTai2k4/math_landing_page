import {resolveNativeLesson,nativeLessonUrl,publicSnapshot} from '../native/model';
import {courses,findCourse,courseSummary,lessonCount} from './catalogue';
export const OFFICIAL_ORIGIN='https://www.minhthanhmath.vn';
export const PUBLIC_PATHS=['/','/khoa-hoc','/thi-thu','/luyen-tap','/so-tay','/tai-lieu',...courses.map(c=>'/khoa-hoc/'+c.slug)];
export type CatalogState={grade:'10'|'11'|'12'|'all';query:string;order:'roadmap'|'name'};
export function parseCatalogQuery(search:string):CatalogState{
 const p=new URLSearchParams(search),raw=p.get('lop');
 return{grade:(['10','11','12','all'].includes(raw??'')?raw:'12') as CatalogState['grade'],query:(p.get('q')??'').normalize('NFC').replace(/[\u0000-\u001f\u007f]/g,'').slice(0,120),order:p.get('sort')==='name'?'name':'roadmap'};
}
export function catalogURL(state:CatalogState){const p=new URLSearchParams({lop:state.grade});if(state.query)p.set('q',state.query);if(state.order!=='roadmap')p.set('sort',state.order);return'/khoa-hoc?'+p.toString();}
export function normalizePublicPath(path:string){if(!path.startsWith('/')||path.includes('\\'))return'/not-found';return path.replace(/\/+$/,'')||'/';}
export function routeMetadata(pathname:string,hostname:string,search=''){
 const lesson=resolveNativeLesson(pathname,search),resource=pathname.startsWith('/thi-thu/')?publicSnapshot.exams.find(x=>'/thi-thu/'+x.id===pathname):pathname.startsWith('/tai-lieu/')?publicSnapshot.documents.find(x=>'/tai-lieu/'+x.id===pathname):undefined;
 if(lesson||resource){const title=lesson?.lesson.title??resource!.title,description=lesson?.lesson.subtitle||resource?.description||'Nội dung đang được tích hợp trực tiếp vào website MTM; chưa có kết nối dữ liệu tài khoản.';return{known:true,path:pathname,title:title+' | Minh Thành Math',description,url:OFFICIAL_ORIGIN+(lesson?nativeLessonUrl(lesson.course,lesson.lesson):pathname),ogImage:OFFICIAL_ORIGIN+(lesson?.course.image??'/mtm-original-logo.png'),robots:'noindex, follow'};}

 const path=normalizePublicPath(pathname),course=path.startsWith('/khoa-hoc/')?findCourse(path.slice(10)):undefined,known=PUBLIC_PATHS.includes(path);
 const titles:Record<string,string>={'/':'Học cùng MTM','/khoa-hoc':'Khóa học Toán','/luyen-tap':'Luyện tập theo chương','/thi-thu':'Thi thử và bài tập','/so-tay':'Sổ tay học tập','/tai-lieu':'Thư viện học liệu'};
 const descriptions:Record<string,string>={'/':'Minh Thành Math: tìm lộ trình Toán THCS, THPT, HSA và TSA; xem lớp học, lịch học và các cổng học tập.','/khoa-hoc':'Khám phá danh mục khóa học Toán lớp 10, 11, 12; tìm theo chủ đề, xem chương và nội dung bài học từ nguồn MTM.','/luyen-tap':'Luyện Toán theo lớp, chương và dạng bài; làm bài, kiểm điểm từng phần và đọc lời giải sau khi nộp. Lịch sử lưu trên trình duyệt này.','/thi-thu':'Các lối vào phòng thi và bài tập của MTM. Quyền làm bài và lịch sử được quản lý tại hệ thống đã cấp tài khoản.','/so-tay':'Lập kế hoạch học tập, lưu bản nháp trên trình duyệt, xuất và khôi phục sổ tay cá nhân. Chưa đồng bộ tài khoản.','/tai-lieu':'Thư viện tham khảo MTM với tìm kiếm và bộ lọc; tài liệu theo lớp được truy cập qua tài khoản đã cấp.'};
 const production=['minhthanhmath.vn','www.minhthanhmath.vn'].includes(hostname),isSearch=path==='/khoa-hoc'&&!!parseCatalogQuery(search).query;
 return{known,path,title:(course?.title??titles[path]??'Không tìm thấy trang')+' | Minh Thành Math',description:course?`${courseSummary(course)} Xem ${course.sections.length} chương và ${lessonCount(course)} mục bài trong danh mục; học phí và quyền truy cập cần MTM xác nhận.`:descriptions[path]??'Đường dẫn chưa có trong website MTM. Trở lại danh mục khóa học để chọn đúng nội dung.',url:OFFICIAL_ORIGIN+(known?path:'/404'),ogImage:OFFICIAL_ORIGIN+(course?.image??'/mtm-original-logo.png'),robots:production&&known&&path!=='/so-tay'&&!isSearch&&!(path==='/luyen-tap'&&new URLSearchParams(search).has('luot'))?'index, follow':'noindex, follow'};
}

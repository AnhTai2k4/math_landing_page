// KT-06 (Đợt 3): phần nhẹ của Luyện tập (danh mục chương, nhãn, URL), KHÔNG nhập ngân hàng đề.
// Khung trang /luyen-tap vẽ được ngay từ đây; ngân hàng đề nạp sau qua practice-bank.ts.
import curriculum from './curriculum.json';
import type {PracticeBankItem} from './ChapterPractice';

export type Chapter={id:string;title:string;forms:string[];plannedPracticeTests?:number};
export type Track={id:string;label:string;description:string;chapters:Chapter[];sourceUrl:string;sourceLabel:string};
export type PracticeItem=PracticeBankItem&{track:string;reviewStatus?:string;chapter:string;order:number;coverage:string;displayCoverage?:string;isChapterEnd?:boolean;isFoundation?:boolean;sourceEdition?:boolean;sourceSequence?:{fileId:string;lesson:string;test:string;sequence:number;lessonTitle:string}};
export const tracks=curriculum as Track[];
export const foundationLabel=(p:PracticeItem)=>p.track==='10'?'Hệ thống công thức và lý thuyết cả chương':p.track==='11'?p.order===1?'Góc và công thức lượng giác':'Hàm số và phương trình lượng giác':p.order===1?'Đạo hàm, biến thiên và cực trị':'Khảo sát đồ thị và bài toán ứng dụng';
// Tên bài từ file nguồn thường in hoa và có tiền tố "BÀI."; hiển thị lại dạng câu thường.
export const lessonName=(raw:string)=>{const s=raw.replace(/\s+/g,' ').trim().replace(/^BÀI\s*[.:]\s*/i,'');return s===s.toLocaleUpperCase('vi')&&/\p{L}/u.test(s)?s.charAt(0)+s.slice(1).toLocaleLowerCase('vi'):s;};
export const chapterRoman=(c:string)=>({"1":"I","2":"II","3":"III","4":"IV","5":"V","6":"VI","7":"VII","8":"VIII","9":"IX"} as Record<string,string>)[c]??c;
// Lộ trình chương (quy chuẩn 14/10/2026): Bài 1 lý thuyết, chia nhóm theo bài học/chuyên đề, trong nhóm khó dần, cuối cùng kiểm tra chương.
// Số Bài liên tục theo thứ tự trong chapter-sequence.json, chỉ đếm các đề có trong ngân hàng. Giá trị là mảng id (dạng cũ) hoặc {groups}.
export type RouteItem={id:string;level?:string;dangs?:string[]};
export type RouteGroup={title:string;note?:string;items:RouteItem[]};
export const routeGroupsOf=(v:unknown):RouteGroup[]=>Array.isArray(v)?[{title:'',items:(v as string[]).map(id=>({id}))}]:((v as {groups?:RouteGroup[]}|undefined)?.groups??[]);
// "ĐỀ TEST SỐ 01" hoặc "01" → "Đề test số 01"; nhãn khác giữ nguyên.
export const testLabel=(label:string)=>{const s=label.trim(),n=s.match(/^(?:ĐỀ TEST SỐ\s*)?(\d+)$/i)?.[1];return n?'Đề test số '+n.padStart(2,'0'):s;};
export const practiceURL=(track:string,chapter:string,id?:string)=>'/luyen-tap?'+new URLSearchParams({nhom:track,chuong:chapter,...(id?{id}:{})}).toString();

// KT-06 (Đợt 3): phần nhẹ của Luyện tập (danh mục chương, nhãn, URL), KHÔNG nhập ngân hàng đề.
// Khung trang /luyen-tap vẽ được ngay từ đây; ngân hàng đề nạp sau qua practice-bank.ts.
import curriculum from './curriculum.json';
import type {PracticeBankItem} from './ChapterPractice';

export type Chapter={id:string;title:string;forms:string[];plannedPracticeTests?:number};
export type Track={id:string;label:string;description:string;chapters:Chapter[];sourceUrl:string;sourceLabel:string};
export type PracticeItem=PracticeBankItem&{track:string;reviewStatus?:string;chapter:string;order:number;coverage:string;isChapterEnd?:boolean;isFoundation?:boolean;sourceEdition?:boolean;sourceSequence?:{fileId:string;lesson:string;test:string;sequence:number;lessonTitle:string}};
export const tracks=curriculum as Track[];
// Tên bài từ file nguồn thường in hoa và có tiền tố "BÀI."; hiển thị lại dạng câu thường.
export const lessonName=(raw:string)=>{const s=raw.replace(/\s+/g,' ').trim().replace(/^BÀI\s*[.:]\s*/i,'');return s===s.toLocaleUpperCase('vi')&&/\p{L}/u.test(s)?s.charAt(0)+s.slice(1).toLocaleLowerCase('vi'):s;};
// "ĐỀ TEST SỐ 01" hoặc "01" → "Đề số 01" (LT-14: bỏ chữ "test" khó hiểu với học sinh); nhãn khác giữ nguyên.
export const testLabel=(label:string)=>{const s=label.trim(),n=s.match(/^(?:ĐỀ TEST SỐ\s*)?(\d+)$/i)?.[1];return n?'Đề số '+n.padStart(2,'0'):s;};
export const practiceURL=(track:string,chapter:string,id?:string)=>'/luyen-tap?'+new URLSearchParams({nhom:track,chuong:chapter,...(id?{id}:{})}).toString();

import {canonicalNumeric,normalizedShort} from '../exams/assessment';
import type {ExamSection} from '../exams/flexible-profile';
import {validLayout,layoutRows} from './layout';
import {parseKeyPaste} from './model';
export type KeySuggestion={mc:string[];tf:string[][];short:string[];matched:number;messages:string[]};
const empty=():KeySuggestion=>({mc:Array(12).fill(''),tf:Array.from({length:4},()=>Array(4).fill('')),short:Array(6).fill(''),matched:0,messages:[]});
const fold=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/gi,'d').trim().toUpperCase();
function rows(text:string,separator:string){return text.split(/\r?\n/).filter(s=>s.trim()).map(line=>{const out:string[]=[];let cell='',quote=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(quote&&line[i+1]==='"'){cell+='"';i++;}else quote=!quote;}else if(c===separator&&!quote){out.push(cell.trim());cell='';}else cell+=c;}if(quote)throw Error('CSV có ô mở ngoặc kép nhưng chưa đóng.');out.push(cell.trim());return out;});}
export function importKeyText(input:string):KeySuggestion{
 if(input.length>1048576)throw Error('Tệp khóa quá 1 MB.');const text=input.replace(/^\uFEFF/,'').trim();if(!text)throw Error('Tệp chưa có nội dung.');try{return{...parseKeyPaste(text),matched:34,messages:['Đọc được khóa 3 dòng. Đối chiếu mã đề và từng ô trước khi áp dụng.']};}catch{}
 const result=empty(),seen=new Map<string,string>(),ambiguous=new Set<string>();
 function put(part:string,num:string,value:string){const p=fold(part).replace(/^PHAN\s*/,''),n=Number(num),key=p+':'+n;if(!['I','II','III','1','2','3'].includes(p)||!Number.isInteger(n)||n<1||n>(['I','1'].includes(p)?12:['II','2'].includes(p)?4:6))return;const partId=['I','1'].includes(p)?'I':['II','2'].includes(p)?'II':'III',id=partId+':'+n;
 const answer=partId==='I'?fold(value):partId==='II'?fold(value).replace(/[\s,;]+/g,'').replace(/DUNG/g,'D').replace(/SAI/g,'S'):value.trim();if(partId==='I'?!/^[ABCD]$/.test(answer):partId==='II'?!/^[DS]{4}$/.test(answer):answer.length>100||canonicalNumeric(answer)===null)return;
 if(seen.has(id)&&seen.get(id)!==answer){ambiguous.add(id);return;}seen.set(id,answer);}
 const header=text.split(/\r?\n/)[0],separator=header.includes('\t')?'\t':header.includes(';')?';':',';
 for(const row of rows(text,separator))if(row.length===3)put(row[0],row[1],row[2]);
 // PDF/text numbered keys are admitted only with an explicit section, never inferred from bare question numbers.
 let part='';for(const raw of text.split(/\r?\n/)){const line=fold(raw);const heading=line.match(/^PHAN\s+(III|II|I)(?:[.:\s]|$)/);if(heading){part=heading[1];continue;}const match=raw.trim().match(/^(?:Câu\s*)?(\d{1,2})\s*[.):\t-]\s*(.+)$/i);if(part&&match)put(part,match[1],match[2]);}
 for(const [id,value]of seen){if(ambiguous.has(id))continue;const [part,n]=id.split(':');if(part==='I')result.mc[Number(n)-1]=value;else if(part==='II')result.tf[Number(n)-1]=value.split('');else result.short[Number(n)-1]=value;result.matched+=part==='II'?4:1;}
 result.messages.push(`Nhận diện chắc định dạng ${result.matched}/34 ô đáp án. Cần đối chiếu nội dung với nguồn; đây chưa phải kiểm đúng Toán.`);if(ambiguous.size)result.messages.push(`${ambiguous.size} câu có hai đáp án khác nhau: để trống để đối chiếu.`);if(!result.matched)result.messages.push('Chưa nhận diện được khóa. PDF ảnh/quét hoặc bảng khác mẫu cần nhập/dán thủ công; không tự đoán đáp án.');return result;
}
export function keyTemplate(){return 'Phần;Câu;Đáp án\n'+[...Array.from({length:12},(_,i)=>`I;${i+1};`),...Array.from({length:4},(_,i)=>`II;${i+1};`),...Array.from({length:6},(_,i)=>`III;${i+1};`)].join('\n');}

export function layoutKeyTemplate(layout:ExamSection[]){return 'Phần;Câu;Đáp án\n'+layoutRows(layout).map(r=>`${r.part};${r.number};`).join('\n');}
export function importLayoutKey(input:string,layout:ExamSection[],mode='numeric'):KeySuggestion{
 if(!validLayout(layout)||input.length>1048576)throw Error('Cấu trúc không hợp lệ hoặc tệp quá 1 MB.');
 const mapped=layoutRows(layout),result:KeySuggestion={mc:Array(mapped.filter(r=>r.kind==='mc').length).fill(''),tf:Array.from({length:mapped.filter(r=>r.kind==='tf').length},()=>Array(4).fill('')),short:Array(mapped.filter(r=>r.kind==='short').length).fill(''),matched:0,messages:[]},seen=new Map<number,string>(),ambiguous=new Set<number>();
 const text=input.replace(/^\uFEFF/,'').trim();if(!text)throw Error('Tệp chưa có nội dung.');
 const roman=['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];
 function put(part:string,number:string,raw:string){const p=fold(part).replace(/^PHAN\s*/,''),partNumber=/^\d+$/.test(p)?Number(p):roman.indexOf(p)+1,r=mapped.find(q=>q.part===partNumber&&q.number===Number(number));if(!r)return;
 const value=r.kind==='short'?raw.trim():fold(raw).replace(/[\s,;]+/g,'').replace(/DUNG/g,'D').replace(/SAI/g,'S');if(r.kind==='mc'?!/^[ABCD]$/.test(value):r.kind==='tf'?!/^[DS]{4}$/.test(value):value.length>100||!value||normalizedShort(mode,value)===null)return;
 if(seen.has(r.index)&&seen.get(r.index)!==value)ambiguous.add(r.index);else seen.set(r.index,value);}
 const header=text.split(/\r?\n/)[0],separator=header.includes('\t')?'\t':header.includes(';')?';':',';
 for(const row of rows(text,separator))if(row.length===3)put(row[0],row[1],row[2]);
 let part='';for(const raw of text.split(/\r?\n/)){const heading=fold(raw).match(/^PHAN\s+(XII|XI|IX|VIII|VII|VI|IV|III|II|X|V|I|\d{1,2})(?:[.:\s]|$)/);if(heading){part=heading[1];continue;}const m=raw.trim().match(/^(?:Câu\s*)?(\d{1,3})\s*[.):\t-]\s*(.+)$/i);if(part&&m)put(part,m[1],m[2]);}
 for(const [index,value] of seen){if(ambiguous.has(index))continue;const r=mapped[index];if(r.kind==='mc')result.mc[r.kindIndex]=value;else if(r.kind==='tf')result.tf[r.kindIndex]=value.split('');else result.short[r.kindIndex]=value;result.matched+=r.kind==='tf'?4:1;}
 const total=mapped.reduce((n,r)=>n+(r.kind==='tf'?4:1),0);result.messages=[`Nhận diện chắc định dạng ${result.matched}/${total} ô. Đối chiếu mã đề và từng câu trước khi áp dụng; nhận diện không chứng minh đúng Toán.`];if(ambiguous.size)result.messages.push(`${ambiguous.size} câu mâu thuẫn: để trống.`);if(!result.matched)result.messages.push('Không đoán khóa từ ảnh/quét hay số câu không có phần. Dùng CSV mẫu theo cấu trúc này.');return result;
}

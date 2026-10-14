import {cellText,cellLinks,headerKey,type MaterialCell} from './material-cells';
import {createHash} from 'node:crypto';
import {pairedLessonCode} from './lesson-policy';
export type MaterialConfig={sheetId:string;tab:string;programKey:string;columns:{date:string;homework:string;answer:string;material?:string};confirmedSessions?:Record<string,string>};
export type BuildJob={id:string;lessonCode:string;sheetId:string;tab:string;row:number;homework:string;homeworkUrls?:string[];homeworkNote?:string;answer:string;status:'cho_dung'};
/** Một lần đọc học liệu; không tự suy giờ ca, không scheduler và không publish. */
export function detectHomework(headers:string[],rows:MaterialCell[][],config:MaterialConfig,seen:string[]=[],now=Date.now()){
 for(const c of Object.values(config.columns))if(headers.filter(h=>headerKey(h)===headerKey(c)).length!==1)throw Error('Thiếu/trùng cột học liệu');
 const pending:{row:number;reason:string}[]=[],groups=new Map<string,Omit<BuildJob,'id'>>();let parent:{date:string;job:Omit<BuildJob,'id'>}|undefined;
 for(const [i,row] of rows.entries()){
  const cell=(k:keyof MaterialConfig['columns'])=>row[headers.findIndex(h=>headerKey(h)===headerKey(config.columns[k]??''))],get=(k:keyof MaterialConfig['columns'])=>cellText(cell(k)).trim();
  const raw=get('homework'),date=get('date');if(!raw){parent=undefined;continue;}
  const note=headerKey(raw)===headerKey('Phần trắc nghiệm trong phiếu'),urls=cellLinks(cell(note?'material':'homework')),answer=cellLinks(cell('answer'))[0]??'';
  if(!urls.length){pending.push({row:i+2,reason:'Chờ URL thật của học liệu'});parent=undefined;continue;}
  if(!answer&&parent&&(!date||date===parent.date)){
   parent.job.homeworkUrls=[...new Set([...(parent.job.homeworkUrls??[parent.job.homework]),...urls])];continue;
  }
  parent=undefined;
  if(!answer){pending.push({row:i+2,reason:'Chờ đáp án BTVN'});continue;}
  const confirmed=config.confirmedSessions?.[date]??date,finish=Date.parse(confirmed);
  if(!/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(confirmed)||!Number.isFinite(finish)||finish>now){pending.push({row:i+2,reason:'Cần giờ kết thúc ca đã xác minh'});continue;}
  const vnDate=new Date(finish+7*3600000).toISOString().slice(0,10);
  let lessonCode:string;try{lessonCode=pairedLessonCode(config.programKey,vnDate);}catch{pending.push({row:i+2,reason:'Cần cấu hình bài riêng'});continue;}
  const existing=groups.get(lessonCode);
  if(existing){if(existing.answer!==answer||existing.homework!==urls[0])throw Error('Nguồn BTVN cùng bài xung đột');parent={date,job:existing};continue;}
  const job:Omit<BuildJob,'id'>={lessonCode,sheetId:config.sheetId,tab:config.tab,row:i+2,homework:urls[0],homeworkUrls:urls,...(note?{homeworkNote:raw}:{}),answer,status:'cho_dung'};groups.set(lessonCode,job);parent={date,job};
 }
 const known=new Set(seen),jobs:BuildJob[]=[];
 for(const job of groups.values()){
  const source=(job.homeworkUrls?.length??0)>1?job.homeworkUrls:job.homework;
  const id=createHash('sha256').update(JSON.stringify([job.lessonCode,source,job.answer])).digest('hex');
  if(known.has(id))continue;known.add(id);jobs.push({...job,id});
 }
 return {jobs,seen:[...known],pending};
}

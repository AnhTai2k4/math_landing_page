import {createHash} from 'node:crypto';
import {pairedLessonCode} from './lesson-policy';
export type MaterialConfig={sheetId:string;tab:string;programKey:string;columns:{date:string;homework:string;answer:string};confirmedSessions?:Record<string,string>};
export type BuildJob={id:string;lessonCode:string;sheetId:string;tab:string;row:number;homework:string;answer:string;status:'cho_dung'};
/** Một lần chạy, không polling/timer/scheduler. Trả checkpoint mới để người vận hành ghi atomically cùng job. */
export function detectHomework(headers:string[],rows:string[][],config:MaterialConfig,seen:string[]=[],now=Date.now()){
  for(const c of Object.values(config.columns))if(headers.filter(h=>h===c).length!==1)throw new Error('Thiếu/trùng cột học liệu');
  const known=new Set(seen),jobs:BuildJob[]=[];const pending:{row:number;reason:string}[]=[];
  rows.forEach((row,i)=>{
    const get=(k:keyof MaterialConfig['columns'])=>String(row[headers.indexOf(config.columns[k])]??'').trim();
    const homework=get('homework'),answer=get('answer'),date=get('date');if(!homework)return;
    if(!answer){pending.push({row:i+2,reason:'Chờ đáp án BTVN'});return;}
    // Không đoán năm/giờ ca, không tạo việc cho ca tương lai hoặc chưa học xong.
    const confirmed=config.confirmedSessions?.[date]??date;
    const finish=Date.parse(confirmed);if(!/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(confirmed)||!Number.isFinite(finish)||finish>now){pending.push({row:i+2,reason:'Cần giờ kết thúc ca đã xác minh'});return;}
    const vnDate=new Date(finish+7*3600000).toISOString().slice(0,10);
    let lessonCode:string;try{lessonCode=pairedLessonCode(config.programKey,vnDate);}catch{pending.push({row:i+2,reason:'Cần cấu hình bài riêng'});return;}
    const id=createHash('sha256').update(JSON.stringify([lessonCode,homework,answer])).digest('hex');
    if(known.has(id))return;known.add(id);
    jobs.push({id,lessonCode,sheetId:config.sheetId,tab:config.tab,row:i+2,homework,answer,status:'cho_dung'});
  });return {jobs,seen:[...known],pending};
}

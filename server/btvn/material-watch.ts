import {createHash} from 'node:crypto';
import {cellText,cellLinks,headerKey,materialDate,type MaterialCell} from './material-cells';
import {pairedLessonCode} from './lesson-policy';
import {comparableHomeworkNote,materialConflict} from './material-conflict';

export type MaterialConfig={sheetId:string;tab:string;programKey:string;columns:{date:string;homework:string;answer:string;material?:string};confirmedSessions?:Record<string,string>};
export type BuildJob={id:string;lessonCode:string;sheetId:string;tab:string;row:number;homework:string;homeworkUrls?:string[];homeworkNote?:string;answer:string;status:'cho_dung'};
/** Metadata đi kèm seen; SHA cũ không thể cho biết phạm vi hoặc tập URL trước đó. */
export type SeenHomeworkSource={id:string;lessonCode:string;homeworkUrls:string[];homeworkNoteKey:string;answer:string};
type PendingHomework={row:number;reason:string;lessonCode?:string;code?:'source_conflict'|'scope_changed'|'source_changed'|'legacy_scope_unknown'|'legacy_checkpoint_unknown';previousIds?:string[];requiresScopeReview?:boolean;sourceRows?:[number,number];fields?:string[]};
type DraftJob=Omit<BuildJob,'id'>;
const noteKey=headerKey('Phần trắc nghiệm trong phiếu');
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const sortedUrls=(urls:string[])=>[...new Set(urls)].sort();
const sourceId=(source:Omit<SeenHomeworkSource,'id'>)=>hash([source.lessonCode,sortedUrls(source.homeworkUrls),source.answer,source.homeworkNoteKey]);
const jobSource=(job:DraftJob):SeenHomeworkSource=>{
 const source={lessonCode:job.lessonCode,homeworkUrls:sortedUrls(job.homeworkUrls??[job.homework]),homeworkNoteKey:headerKey(job.homeworkNote??''),answer:job.answer};
 return {...source,id:sourceId(source)};
};

function confirmedFinish(value:string){
 const match=/^(\d{4}-\d{2}-\d{2})T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?(?:Z|([+-])([01]\d|2[0-3]):([0-5]\d))$/.exec(value);
 if(!match||!materialDate(match[1]))return NaN;
 if(match[2]){
  const offset=(Number(match[3])*60+Number(match[4]))*(match[2]==='-'?-1:1);
  if(offset < -12*60 || offset > 14*60)return NaN;
 }
 return Date.parse(value);
}

/** Một lần đọc học liệu; không tự suy giờ ca, không scheduler và không publish.
 * Tham số thứ sáu giữ metadata từ receipt/checkpoint. Seen cũ thiếu metadata phải
 * đối soát với receipt nguồn, không suy phạm vi từ SHA và không tự tạo bài thay thế.
 */
export function detectHomework(headers:string[],rows:MaterialCell[][],config:MaterialConfig,seen:string[]=[],now=Date.now(),previousSources:SeenHomeworkSource[]=[]){
 for(const c of Object.values(config.columns))if(headers.filter(h=>headerKey(h)===headerKey(c)).length!==1)throw Error('Thiếu/trùng cột học liệu');
 const pending:PendingHomework[]=[],groups=new Map<string,DraftJob>(),conflicted=new Set<string>();
 let parent:{finish:number;job:DraftJob}|undefined;
 for(const [i,row] of rows.entries()){
  const cell=(k:keyof MaterialConfig['columns'])=>row[headers.findIndex(h=>headerKey(h)===headerKey(config.columns[k]??''))],get=(k:keyof MaterialConfig['columns'])=>cellText(cell(k)).trim();
  const raw=get('homework'),date=get('date');if(!raw){parent=undefined;continue;}
  const note=headerKey(raw)===noteKey,urls=cellLinks(cell(note?'material':'homework')),answer=cellLinks(cell('answer'))[0]??'';
  const finish=confirmedFinish(config.confirmedSessions?.[date]??date);
  const continuation=!!parent&&(!date||finish===parent.finish);
  let lessonCode:string|undefined;
  if(Number.isFinite(finish)){
   const vnDate=new Date(finish+7*3600000).toISOString().slice(0,10);
   try{lessonCode=pairedLessonCode(config.programKey,vnDate);}catch{/* Giữ lý do chờ cấu hình ở dưới. */}
  }
  // Đối soát ghi chú trước URL/đáp án, kể cả ca khác cùng mã bài.
  const scopedParent=continuation?parent?.job:lessonCode?groups.get(lessonCode):undefined;
  if(note&&scopedParent&&comparableHomeworkNote(scopedParent.homeworkNote)!==comparableHomeworkNote(raw)){
    const code=scopedParent.lessonCode;
    pending.push(materialConflict(code,[scopedParent.row,i+2],['homeworkNote']));
    groups.delete(code);conflicted.add(code);parent=undefined;continue;
  }
  if(lessonCode&&conflicted.has(lessonCode)){parent=undefined;continue;}
  if(!urls.length){pending.push({row:i+2,reason:'Chờ URL thật của học liệu'});if(!(note&&continuation))parent=undefined;continue;}
  if(!answer&&parent&&continuation){
   // URL phụ thường kế thừa phạm vi cha.
   parent.job.homeworkUrls=[...new Set([...(parent.job.homeworkUrls??[parent.job.homework]),...urls])];continue;
  }
  parent=undefined;
  if(!answer){pending.push({row:i+2,reason:'Chờ đáp án BTVN'});continue;}
  if(!Number.isFinite(finish)||finish>now){pending.push({row:i+2,reason:'Cần giờ kết thúc ca đã xác minh'});continue;}
  if(!lessonCode){pending.push({row:i+2,reason:'Cần cấu hình bài riêng'});continue;}
  const existing=groups.get(lessonCode);
  if(existing){
   const differences=[existing.answer!==answer?'answer':'',existing.homework!==urls[0]?'homeworkUrl':'',comparableHomeworkNote(existing.homeworkNote)!==comparableHomeworkNote(note?raw:undefined)?'homeworkNote':''].filter(Boolean);
   if(differences.length){
    pending.push(materialConflict(lessonCode,[existing.row,i+2],differences));
    groups.delete(lessonCode);conflicted.add(lessonCode);continue;
   }
   // Giữ thứ tự gặp để hiển thị, còn fingerprint dùng tập URL sắp xếp ổn định.
   existing.homeworkUrls=[...new Set([...(existing.homeworkUrls??[existing.homework]),...urls])];
   parent={finish,job:existing};continue;
  }
  const job:DraftJob={lessonCode,sheetId:config.sheetId,tab:config.tab,row:i+2,homework:urls[0],homeworkUrls:urls,...(note?{homeworkNote:raw}:{}),answer,status:'cho_dung'};
  groups.set(lessonCode,job);parent={finish,job};
 }

 const known=new Set(seen),sources=new Map<string,SeenHomeworkSource>(),jobs:BuildJob[]=[];
 // Chỉ dùng metadata nhất quán với SHA đang có. Không sửa object bên gọi giữ.
 for(const source of previousSources){
  if(source&&typeof source.id==='string'&&typeof source.lessonCode==='string'&&Array.isArray(source.homeworkUrls)&&source.homeworkUrls.every(url=>typeof url==='string')&&typeof source.homeworkNoteKey==='string'&&typeof source.answer==='string'&&known.has(source.id)&&sourceId(source)===source.id){
   sources.set(source.id,{...source,homeworkUrls:sortedUrls(source.homeworkUrls)});
  }
 }
 const prepared=[...groups.values()].map(job=>({job,source:jobSource(job)}));
 // Khóa mới chứa cả scope, nên có thể phục hồi metadata hiện tại khi SHA khớp.
 for(const {source} of prepared)if(known.has(source.id))sources.set(source.id,source);
 const unknownSeen=[...known].filter(id=>!sources.has(id));
 for(const {job,source} of prepared){
  if(known.has(source.id))continue;
  const previous=[...sources.values()].filter(item=>item.lessonCode===job.lessonCode);
  if(previous.length){
   const scopeChanged=previous.some(item=>item.homeworkNoteKey!==source.homeworkNoteKey);
   pending.push({row:job.row,lessonCode:job.lessonCode,code:scopeChanged?'scope_changed':'source_changed',previousIds:previous.map(item=>item.id),...(scopeChanged?{requiresScopeReview:true}:{}),reason:scopeChanged?'Phạm vi BTVN đã đổi; cần đối soát bài cũ trước khi dựng bài thay thế':'Tập URL hoặc đáp án BTVN đã đổi; cần đối soát bài cũ trước khi dựng bài thay thế'});
   continue;
  }
  if(unknownSeen.length){
   const encountered=job.homeworkUrls??[job.homework],legacySources: (string|string[])[]=[job.homework,encountered.length>1?encountered:job.homework,source.homeworkUrls.length>1?source.homeworkUrls:source.homeworkUrls[0]];
   const legacyMatch=legacySources.some(urls=>known.has(hash([job.lessonCode,urls,job.answer])));
   pending.push({row:job.row,lessonCode:job.lessonCode,code:legacyMatch?'legacy_scope_unknown':'legacy_checkpoint_unknown',requiresScopeReview:true,reason:legacyMatch?'Sổ seen cũ khớp nguồn nhưng chưa lưu phạm vi; cần đối soát receipt trước khi chuyển sổ':'Sổ seen còn SHA chưa đối soát; cần receipt nguồn cũ để xác minh thứ tự URL, tập tệp và phạm vi'});
   continue;
  }
  known.add(source.id);sources.set(source.id,source);jobs.push({...job,id:source.id});
 }
 return {jobs,seen:[...known],seenSources:[...sources.values()],pending};
}

export type Task={id:string;text:string;minutes:number;done:boolean};
export type Store={version:1;days:Record<string,Task[]>;goals:Record<string,string>};
export const NOTEBOOK_KEY='mtm:guest-notebook:v1';
export const emptyNotebook=():Store=>({version:1,days:{},goals:{}});
type StoragePort=Pick<Storage,'getItem'|'setItem'>;
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const invalid=():never=>{throw new Error('Bản lưu sổ tay có dữ liệu không hợp lệ. Không ghi đè; hãy xuất bản lưu gốc trước khi xử lý.');};
export function parseNotebook(raw:string|null):Store{
 if(raw===null)return emptyNotebook();
 if(raw.length>1000000)throw new Error('Bản lưu sổ tay vượt giới hạn dung lượng. Hãy xuất bản lưu gốc.');
 let v:unknown;try{v=JSON.parse(raw);}catch{return invalid();}
 if(!record(v)||v.version!==1||!record(v.days)||!record(v.goals)||Object.keys(v).some(k=>!['version','days','goals'].includes(k)))return invalid();
 const output=emptyNotebook();
 for(const [date,tasks]of Object.entries(v.days)){
  const parts=/^(\d{4})-(\d{2})-(\d{2})$/.exec(date);if(!parts)return invalid();
  const d=new Date(date+'T12:00:00Z');if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==date||!Array.isArray(tasks)||tasks.length>30)return invalid();
  const ids=new Set<string>();const parsed:Task[]=[];
  for(const t of tasks){
   if(!record(t)||Object.keys(t).some(k=>!['id','text','minutes','done'].includes(k))||typeof t.id!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(t.id)||ids.has(t.id)||typeof t.text!=='string'||t.text.length>400||!t.text.trim()||!Number.isInteger(t.minutes)||Number(t.minutes)<0||Number(t.minutes)>1440||typeof t.done!=='boolean')return invalid();
   ids.add(t.id);parsed.push({id:t.id,text:t.text,minutes:Number(t.minutes),done:t.done});
  }
  output.days[date]=parsed;
 }
 for(const [month,goal]of Object.entries(v.goals)){
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)||typeof goal!=='string'||goal.length>2000)return invalid();output.goals[month]=goal;
 }
 return output;
}
/** Cross-tab change detection; this is browser storage, not server synchronization. */
export function saveNotebook(storage:StoragePort,expectedRaw:string|null,next:Store):string{
 const encoded=JSON.stringify(next);parseNotebook(encoded);
 if(storage.getItem(NOTEBOOK_KEY)!==expectedRaw)throw new Error('Sổ tay đã thay đổi ở thẻ khác. Tải lại trang trước khi ghi; bản hiện có chưa bị thay thế.');
 storage.setItem(NOTEBOOK_KEY,encoded);return encoded;
}

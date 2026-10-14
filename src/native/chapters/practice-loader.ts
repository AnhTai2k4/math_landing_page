// Bộ nạp nhỏ: chỉ dữ liệu chương đang chọn hoặc đúng một đề; nguồn gốc vẫn là JSON nguyên khối.
import {metadata,loaders} from './generated-bank';
import chapterSequence from './chapter-sequence.json';
import {chapterRoman,foundationLabel,lessonName,routeGroupsOf,type PracticeItem} from './practice-shared';
import {draftKey,readArchive,type Store} from '../exams/store';
export const sequences=chapterSequence as Record<string,unknown>;
export const sequenceNumber=new Map<string,number>();
for(const v of Object.values(sequences))routeGroupsOf(v).flatMap(g=>g.items.map(i=>i.id)).filter(id=>metadata[id]&&!metadata[id].archived).forEach((id,i)=>sequenceNumber.set(id,i+1));
export function present(p:PracticeItem):PracticeItem {
  if(metadata[p.exam.id]?.archived)return p;
  const coverage=p.displayCoverage??(p.isFoundation?foundationLabel(p):p.sourceEdition?lessonName(p.coverage):p.coverage);
  const n=sequenceNumber.get(p.exam.id);
  return {...p,coverage,presentationTitle:n?`Toán ${p.track} · Chương ${chapterRoman(p.chapter)} · Bài ${n}: ${coverage}`:p.presentationTitle??(['HSA','TSA'].includes(p.track)?p.exam.title:`Toán ${p.track} · Chương ${chapterRoman(p.chapter)} · ${p.isChapterEnd?'Kiểm tra kết thúc chương':'Bài '+p.order+': '+coverage}`)};
}
export const chapterIds=(track:string,chapter:string)=>Object.keys(metadata).filter(id=>metadata[id].track===track&&metadata[id].chapter===chapter);
export async function loadItems(ids:readonly string[]) {return Promise.all(ids.filter(id=>Object.hasOwn(loaders,id)).map(id=>loaders[id]().then(present)));}
// Đọc đúng các khoá MTM đã biết, không quét storage khác; sau khi tải đề vẫn dùng validateDraft/readHistory.
export function savedExamId(storage:Store|null,attemptId:string):string|undefined {
  const archive=readArchive(storage);
  if(archive.ok){const saved=archive.value.entries.find(e=>e.draft.attemptId===attemptId);if(saved)return saved.exam.id;}
  if(!storage)return;
  for(const id of Object.keys(metadata)){
    try{const raw=storage.getItem(draftKey(id));if(!raw)continue;const p=JSON.parse(raw);if(p?.examId===id&&p.attemptId===attemptId&&p.submittedAt!==null)return id;}catch{/* đọc lỗi được xử lý lại bởi readHistory */}
  }
}
// React 18 Suspense: cache ngoài component, không giữ state cũ khi đổi chương/id.
const resources=new Map<string,{value?:PracticeItem[];error?:unknown;promise:Promise<void>}>();
export function readItems(key:string,ids:readonly string[]):PracticeItem[] {
  let entry=resources.get(key);
  if(!entry){const next:{value?:PracticeItem[];error?:unknown;promise:Promise<void>}={promise:Promise.resolve()};next.promise=loadItems(ids).then(value=>{next.value=value;},error=>{next.error=error;});resources.set(key,next);entry=next;}
  if(entry.error)throw entry.error;
  if(!entry.value)throw entry.promise;
  return entry.value;
}
export {metadata};

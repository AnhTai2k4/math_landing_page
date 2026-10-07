import {validateReaderFile,type ReaderFile} from './reader-policy';
import {positionKey,readPosition,type PositionStorage,type ReadingPosition} from './reader-position';

export type ReadingCollection={
 items:{file:ReaderFile;position:ReadingPosition;href:string}[];
 invalid:number;
 unavailable:boolean;
};

export function collectReading(storage:PositionStorage|null,files:ReaderFile[],contextSearch:string,now=Date.now()):ReadingCollection{
 const result:ReadingCollection={items:[],invalid:0,unavailable:storage===null};
 const context=new URLSearchParams(contextSearch),category=context.get('muc');
 const query=(context.get('q')??'').normalize('NFC').replace(/\s+/g,' ').replace(/[\u0000-\u001f\u007f]/g,'').slice(0,120);
 const seen=new Set<string>();
 for(const file of files){
  let key:string;
  try{validateReaderFile(file);key=positionKey(file);}catch{continue;}
  // One read per PDF; the first valid row in the filtered order owns its link.
  if(seen.has(key))continue;
  seen.add(key);
  const saved=readPosition(storage,file,now);
  if(saved.state==='unavailable'){result.unavailable=true;continue;}
  if(saved.state==='invalid'){result.invalid++;continue;}
  if(saved.state!=='saved')continue;
  // The shared decoder tolerates clock skew; the shelf excludes future saves.
  if(saved.value.at>now){result.invalid++;continue;}
  const params=new URLSearchParams({trang:String(saved.value.page),zoom:String(saved.value.zoom)});
  if(category!==null&&['all','grade-10','grade-11','grade-12'].includes(category))params.set('muc',category);
  if(query.trim())params.set('q',query);
  result.items.push({file,position:saved.value,href:'/tai-lieu/'+file.id+'?'+params.toString()});
 }
 // Array.sort is stable: equal timestamps retain the provided filtered order.
 result.items.sort((a,b)=>b.position.at-a.position.at);
 return result;
}

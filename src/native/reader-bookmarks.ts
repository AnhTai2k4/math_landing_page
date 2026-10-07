import {validateReaderFile,type ReaderFile} from './reader-policy';

export type BookmarkStorage=Pick<Storage,'getItem'|'setItem'>;
export type BookmarkState={state:'ready';pages:number[];raw:string|null}|{state:'invalid'|'unavailable'};
export type BookmarkToggleState=BookmarkState|{state:'conflict'};
const MAX_BOOKMARKS=50,MAX_RAW_LENGTH=2048;

export function bookmarkKey(file:ReaderFile):string{
 validateReaderFile(file);
 return 'mtm:public-reader:bookmarks:v1:'+file.sha256;
}

function decodeBookmarks(raw:string|null,file:ReaderFile):BookmarkState{
 if(raw===null)return {state:'ready',pages:[],raw:null};
 if(typeof raw!=='string'||raw.length>MAX_RAW_LENGTH)return {state:'invalid'};
 let value:unknown;
 try{value=JSON.parse(raw);}catch{return {state:'invalid'};}
 if(!value||typeof value!=='object'||Array.isArray(value))return {state:'invalid'};
 const record=value as Record<string,unknown>,keys=Object.keys(record);
 if(keys.length!==3||!keys.every(key=>['v','hash','pages'].includes(key))||record.v!==1||record.hash!==file.sha256||!Array.isArray(record.pages)||record.pages.length>MAX_BOOKMARKS)return {state:'invalid'};
 const pages:number[]=[];
 for(const page of record.pages){
  if(!Number.isInteger(page)||page<1||page>file.pages||(pages.length>0&&page<=pages[pages.length-1]))return {state:'invalid'};
  pages.push(page);
 }
 return {state:'ready',pages,raw};
}

export function readBookmarks(storage:BookmarkStorage|null,file:ReaderFile):BookmarkState{
 let key:string;
 try{key=bookmarkKey(file);}catch{return {state:'invalid'};}
 try{return storage?decodeBookmarks(storage.getItem(key),file):{state:'unavailable'};}catch{return {state:'unavailable'};}
}

export function toggleBookmark(storage:BookmarkStorage|null,file:ReaderFile,page:number,expectedRaw:string|null):BookmarkToggleState{
 let key:string;
 try{key=bookmarkKey(file);}catch{return {state:'invalid'};}
 if(!Number.isInteger(page)||page<1||page>file.pages)return {state:'invalid'};
 if(!storage)return {state:'unavailable'};
 try{
  const currentRaw=storage.getItem(key);
  if(currentRaw!==expectedRaw)return {state:'conflict'};
  const current=decodeBookmarks(currentRaw,file);
  if(current.state!=='ready')return current;
  const marked=current.pages.includes(page);
  if(!marked&&current.pages.length>=MAX_BOOKMARKS)return {state:'invalid'};
  const pages=marked?current.pages.filter(saved=>saved!==page):[...current.pages,page].sort((a,b)=>a-b);
  const raw=JSON.stringify({v:1,hash:file.sha256,pages});
  if(raw.length>MAX_RAW_LENGTH)return {state:'invalid'};
  storage.setItem(key,raw);
  return storage.getItem(key)===raw?{state:'ready',pages,raw}:{state:'unavailable'};
 }catch{return {state:'unavailable'};}
}

export function browserBookmarkStorage():Storage|null{
 try{return window.localStorage;}catch{return null;}
}

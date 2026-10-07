import {validateReaderFile,ZOOM_LEVELS,type ReaderFile} from './reader-policy';
export type ReadingPosition={v:1;hash:string;page:number;zoom:number;at:number};
export type PositionState={state:'saved';value:ReadingPosition}|{state:'empty'|'invalid'|'unavailable'};
export type PositionStorage=Pick<Storage,'getItem'|'setItem'|'removeItem'>;
export const positionKey=(file:ReaderFile)=>{validateReaderFile(file);return'mtm:public-reader:position:v1:'+file.sha256;};
export function decodePosition(raw:string|null,file:ReaderFile,now=Date.now()):PositionState{
 validateReaderFile(file);if(raw===null)return{state:'empty'};if(typeof raw!=='string'||raw.length>512)return{state:'invalid'};let value:unknown;try{value=JSON.parse(raw);}catch{return{state:'invalid'};}
 if(!value||typeof value!=='object'||Array.isArray(value))return{state:'invalid'};
 const x=value as Record<string,unknown>;if(Object.keys(x).length!==5||!Object.keys(x).every(k=>['v','hash','page','zoom','at'].includes(k))||x.v!==1||x.hash!==file.sha256||!Number.isInteger(x.page)||Number(x.page)<1||Number(x.page)>file.pages||!ZOOM_LEVELS.includes(x.zoom as typeof ZOOM_LEVELS[number])||!Number.isSafeInteger(x.at)||Number(x.at)<0||!Number.isFinite(now)||Number(x.at)>now+300000)return{state:'invalid'};
 return{state:'saved',value:x as ReadingPosition};
}
export function readPosition(storage:PositionStorage|null,file:ReaderFile,now=Date.now()):PositionState{
 try{return storage?decodePosition(storage.getItem(positionKey(file)),file,now):{state:'unavailable'};}catch{return{state:'unavailable'};}
}
export function savePosition(storage:PositionStorage|null,file:ReaderFile,page:number,zoom:number,now=Date.now()):PositionState{
 const raw=JSON.stringify({v:1,hash:file.sha256,page,zoom,at:now});const checked=decodePosition(raw,file,now);if(checked.state!=='saved')return checked;
 try{if(!storage)return{state:'unavailable'};if(readPosition(storage,file,now).state==='invalid')return{state:'invalid'};storage.setItem(positionKey(file),raw);return storage.getItem(positionKey(file))===raw?checked:{state:'unavailable'};}catch{return{state:'unavailable'};}
}
/** Explicit delete only, scoped to this PDF hash. Never clear other browser data. */
export function forgetPosition(storage:PositionStorage|null,file:ReaderFile):boolean{
 try{if(!storage)return false;storage.removeItem(positionKey(file));return storage.getItem(positionKey(file))===null;}catch{return false;}
}
export function browserPositionStorage():PositionStorage|null{try{return window.localStorage;}catch{return null;}}

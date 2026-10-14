import type {Store} from './store';

export type RoomAux = {active: number; marked: number[]; notes: Record<string,string>; font: number; dark: boolean};
export const emptyAux = (): RoomAux => ({active:0,marked:[],notes:{},font:1,dark:false});
export const auxKey = (attemptId:string) => `mtm:exam-aux:v1:${attemptId}`;
/** Chỉ dữ liệu tiện ích. Không bao giờ sửa/chuyển đổi Draft hay history v1. */
export function readAux(store:Store|null,attemptId:string,count:number):RoomAux {
  try {
    const raw=store?.getItem(auxKey(attemptId));
    if(!raw||raw.length>100000)return emptyAux();
    const v=JSON.parse(raw);
    if(!v||typeof v!=='object'||Array.isArray(v))return emptyAux();
    const index=(n:unknown):n is number=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=0&&n<count;
    const notes:Record<string,string>={};
    if(v.notes&&typeof v.notes==='object'&&!Array.isArray(v.notes))for(let i=0;i<count;i++)if(typeof v.notes[i]==='string')notes[i]=v.notes[i].slice(0,2000);
    return {active:index(v.active)?v.active:0,marked:Array.isArray(v.marked)?[...new Set<number>(v.marked.filter(index))]:[],notes,font:[1,1.15,1.3].includes(v.font)?v.font:1,dark:v.dark===true};
  } catch {return emptyAux();}
}
export function writeAux(store:Store|null,attemptId:string,value:RoomAux):boolean {
  try {if(!store)return false;const raw=JSON.stringify(value);store.setItem(auxKey(attemptId),raw);return store.getItem(auxKey(attemptId))===raw;}catch{return false;}
}
/** Chặn cả modifier, IME và mọi control nhập, kể cả phần tử con contenteditable. */
export function roomShortcut(event:Pick<KeyboardEvent,'key'|'ctrlKey'|'altKey'|'metaKey'|'isComposing'>,editing:boolean):string|null {
  if(editing||event.ctrlKey||event.altKey||event.metaKey||event.isComposing)return null;
  const key=event.key.toLowerCase();return ['a','b','c','d','arrowleft','arrowright','m','?'].includes(key)?key:null;
}
export const warningBand=(seconds:number)=>seconds>600?0:seconds>300?10:seconds>60?5:1;

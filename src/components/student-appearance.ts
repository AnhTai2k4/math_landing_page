import {useEffect,useState} from 'react';
export type StudentAppearance={avatar:'orbit'|'spark'|'prism'|'wave';photo:string};
export const DEFAULT_APPEARANCE:StudentAppearance={avatar:'orbit',photo:''};
export const APPEARANCE_EVENT='mtm:student-appearance';
const PREFIX='mtm:appearance:v1:';
export function appearanceIdentity(identity:string){const separator=identity.indexOf('|');if(separator<1)return '';const name=identity.slice(0,separator).replace(/\([^)]*\)/g,'');const className=identity.slice(separator+1);return [name,className].map(part=>part.normalize('NFC').replace(/\s+/g,' ').trim().toLocaleLowerCase('vi-VN')).join('|');}
export function readAppearance(key:string):StudentAppearance{
 try{const value=JSON.parse(localStorage.getItem(key)||'null');if(!value||!['orbit','spark','prism','wave'].includes(value.avatar))return DEFAULT_APPEARANCE;return{avatar:value.avatar,photo:typeof value.photo==='string'&&value.photo.length<180000&&/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(value.photo)?value.photo:''};}catch{return DEFAULT_APPEARANCE;}
}
/** Appearance is local to this verified identity and device. No names or login codes are stored. */
export function useStudentAppearance(identity:string){
 const [entry,setEntry]=useState<{identity:string;key:string;value:StudentAppearance}>({identity:'',key:'',value:DEFAULT_APPEARANCE});
 useEffect(()=>{let active=true;setEntry({identity,key:'',value:DEFAULT_APPEARANCE});const normalized=appearanceIdentity(identity);if(!normalized||normalized.startsWith('|')||!crypto.subtle)return;void crypto.subtle.digest('SHA-256',new TextEncoder().encode(normalized)).then(bytes=>{if(!active)return;const key=PREFIX+Array.from(new Uint8Array(bytes),n=>n.toString(16).padStart(2,'0')).join('');setEntry({identity,key,value:readAppearance(key)});}).catch(()=>{});return()=>{active=false;};},[identity]);
 const key=entry.identity===identity?entry.key:'';
 useEffect(()=>{if(!key)return;const refresh=()=>setEntry(current=>current.key===key?{...current,value:readAppearance(key)}:current);const storage=(event:StorageEvent)=>{if(event.key===key||event.key===null)refresh();};window.addEventListener('storage',storage);window.addEventListener(APPEARANCE_EVENT,refresh);return()=>{window.removeEventListener('storage',storage);window.removeEventListener(APPEARANCE_EVENT,refresh);};},[key]);
 const save=(value:StudentAppearance)=>{if(!key)throw Error('Chưa sẵn sàng lưu diện mạo. Em thử lại sau.');try{localStorage.setItem(key,JSON.stringify(value));window.dispatchEvent(new Event(APPEARANCE_EVENT));}catch{throw Error('Trình duyệt chưa lưu được ảnh. Em chọn avatar hoặc giải phóng bộ nhớ rồi thử lại.');}};
 return {appearance:entry.identity===identity?entry.value:DEFAULT_APPEARANCE,save,ready:!!key};
}

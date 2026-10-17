import {useCallback,useEffect,useRef,useState} from 'react';
export type StudentAppearance={avatar:'orbit'|'spark'|'prism'|'wave';photo:string};
export type AppearanceRecord={profileKey:string;revision:number;school:string;appearance:StudentAppearance;photoHidden?:boolean};
export const STUDENT_PHOTO_MAX_CHARS=40000;
/** Nén trước khi gửi để ảnh đại diện nhẹ trên cả bảng xếp hạng. */
export function compactStudentPhoto(encode:(quality:number)=>string){
 for(const quality of [.85,.72,.6,.48,.36,.24,.12]){const photo=encode(quality);if(photo.length<=STUDENT_PHOTO_MAX_CHARS)return photo;}
 throw Error('Ảnh còn quá lớn sau khi thu nhỏ. Em chọn ảnh khác.');
}
export const DEFAULT_APPEARANCE:StudentAppearance={avatar:'orbit',photo:''};
export const APPEARANCE_EVENT='mtm:student-appearance';
export const SESSION_EVENT='mtm:student-session',SYNC_KEY='mtm:appearance:refresh:v2';
let accountEpoch=0,lastSessionNonce='';
const notifyOtherTabs=(kind:'session'|'profile')=>{try{localStorage.setItem(SYNC_KEY,JSON.stringify({kind,nonce:crypto.randomUUID()}));}catch{/* Optional notification, never stores profile data. */}};
/** Cùng tín hiệu cho học sinh lưu hồ sơ và giáo vụ thay trạng thái ảnh. */
export function studentAppearanceChanged(){window.dispatchEvent(new Event(APPEARANCE_EVENT));notifyOtherTabs('profile');}
/** Authenticated API owns identity. Browser storage contains a refresh nonce only. */
export function studentSessionChanged(){accountEpoch++;window.dispatchEvent(new Event(SESSION_EVENT));notifyOtherTabs('session');}
export function validAppearanceRecord(value:unknown):value is AppearanceRecord{
 if(!value||typeof value!=='object')return false;const r=value as AppearanceRecord,a=r.appearance;
 return typeof r.profileKey==='string'&&/^[a-zA-Z0-9_-]{12,100}$/.test(r.profileKey)&&Number.isSafeInteger(r.revision)&&r.revision>=0&&typeof r.school==='string'&&r.school.length<=160&&!/[\u0000-\u001f\u007f-\u009f]/.test(r.school)&&(r.photoHidden===undefined||typeof r.photoHidden==='boolean')&&!!a&&['orbit','spark','prism','wave'].includes(a.avatar)&&typeof a.photo==='string'&&(a.photo===''||a.photo.length<=STUDENT_PHOTO_MAX_CHARS&&/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(a.photo));
}
async function requestAppearance(body:unknown,signal?:AbortSignal):Promise<AppearanceRecord>{
 let response:Response;try{response=await fetch('/api/btvn/avatar',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:signal??AbortSignal.timeout(12000)});}catch(error){if(signal?.aborted)throw error;throw Error('Chưa kết nối được. Ảnh chưa được lưu, em thử lại.');}
 const data=await response.json().catch(()=>null);
 if(!response.ok)throw Error(response.status===401?'Phiên đăng nhập đã hết. Em vào lại BTVN.':response.status===409?'Ảnh đã đổi trên thiết bị khác. Em tải ảnh mới nhất rồi chỉnh lại.':data?.message||'Chưa lưu được ảnh. Em thử lại.');
 if(!validAppearanceRecord(data))throw Error('Chưa đọc được hồ sơ ảnh. Em thử lại.');return data;
}
/** identity is an in-memory view invalidation hint, never an account lookup or storage key. */
export function useStudentAppearance(identity:string){
 const [entry,setEntry]=useState<{identity:string;epoch:number;record:AppearanceRecord|null}>({identity:'',epoch:-1,record:null}),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
 const latest=useRef(identity),sequence=useRef(0);latest.current=identity;
 useEffect(()=>{
  let active=true;const controller=new AbortController();
  const refresh=async(clear=false)=>{const n=++sequence.current,epoch=accountEpoch;if(clear)setEntry({identity,epoch,record:null});setError('');try{const record=await requestAppearance({action:'read'},controller.signal);if(active&&n===sequence.current&&epoch===accountEpoch&&latest.current===identity)setEntry({identity,epoch,record});}catch(cause){if(active&&!controller.signal.aborted&&n===sequence.current){setError(cause instanceof Error?cause.message:'Chưa tải được ảnh.');setEntry({identity,epoch,record:null});}}};
  void refresh(true);
  const changed=()=>void refresh(),session=()=>void refresh(true),storage=(event:StorageEvent)=>{if(event.key===SYNC_KEY){let message:{kind?:string;nonce?:string}={};try{message=JSON.parse(event.newValue||'null')??{};}catch{}if(message.kind==='session'){if(message.nonce!==lastSessionNonce){lastSessionNonce=message.nonce||'';accountEpoch++;}void refresh(true);}else void refresh();}},visible=()=>{if(document.visibilityState==='visible')void refresh();};
  window.addEventListener(APPEARANCE_EVENT,changed);window.addEventListener(SESSION_EVENT,session);window.addEventListener('storage',storage);window.addEventListener('focus',changed);document.addEventListener('visibilitychange',visible);
  return()=>{active=false;controller.abort();sequence.current++;window.removeEventListener(APPEARANCE_EVENT,changed);window.removeEventListener(SESSION_EVENT,session);window.removeEventListener('storage',storage);window.removeEventListener('focus',changed);document.removeEventListener('visibilitychange',visible);};
 },[identity,attempt]);
 const record=entry.identity===identity&&entry.epoch===accountEpoch?entry.record:null;
 const save=async(value:StudentAppearance,school:string,base:{profileKey:string;revision:number})=>{
  if(!record)throw Error('Chưa tải được hồ sơ. Em thử tải lại ảnh.');if(base.profileKey!==record.profileKey)throw Error('Tài khoản đã thay đổi. Em mở lại hồ sơ.');const epoch=accountEpoch,n=++sequence.current;
  const saved=await requestAppearance({action:'save',revision:base.revision,expectedProfileKey:base.profileKey,appearance:value,school:school.normalize('NFC').trim().replace(/\s+/g,' ')});
  if(epoch!==accountEpoch||latest.current!==identity||saved.profileKey!==record.profileKey)throw Error('Tài khoản đã thay đổi. Em mở lại hồ sơ.');
  if(n===sequence.current)setEntry({identity,epoch,record:saved});studentAppearanceChanged();
 };
 const retry=useCallback(()=>setAttempt(n=>n+1),[]);
 return {appearance:record?.appearance??DEFAULT_APPEARANCE,school:record?.school??'',photoHidden:record?.photoHidden??false,profileKey:record?.profileKey??'',revision:record?.revision??0,save,ready:!!record,error,retry};
}

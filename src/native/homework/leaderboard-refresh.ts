import {APPEARANCE_EVENT,SESSION_EVENT,SYNC_KEY} from '../../components/student-appearance';

export const LEADERBOARD_POLL_MS=45_000;
export const LEADERBOARD_REFRESH_KEY='mtm:leaderboard:refresh:v1';
export type LeaderboardRefreshReason='poll'|'visible'|'focus'|'profile'|'session'|'submitted';
export type LeaderboardRefresh={reason:LeaderboardRefreshReason;revision:number};
type Listener=(event:LeaderboardRefresh)=>void;
type Environment={
  window:Pick<Window,'addEventListener'|'removeEventListener'>&{localStorage?:Pick<Storage,'setItem'>};
  document:Pick<Document,'addEventListener'|'removeEventListener'|'visibilityState'>;
  setTimer:(callback:()=>void,delay:number)=>unknown;
  clearTimer:(timer:unknown)=>void;
  nonce:()=>string;
};
let requestRevision=0;
/** Không giữ dữ liệu kết quả hoặc hồ sơ cá nhân sau khi request kết thúc. */
const inFlight=new Map<string,Promise<{ok:boolean;status:number;data:unknown}>>();
export function invalidateLeaderboardRequests(){return ++requestRevision;}
export async function requestLeaderboard<T>(url:string,init:RequestInit={}){
  const key=JSON.stringify([requestRevision,url,init.method??'GET',init.credentials??'same-origin',init.body??'']);
  let request=inFlight.get(key);
  if(!request){
    // Signal của một component không được huỷ request đang được component khác dùng.
    const {signal:_,...options}=init;
    request=fetch(url,{...options,cache:'no-store',signal:AbortSignal.timeout(15_000)}).then(async response=>({ok:response.ok,status:response.status,data:response.ok?await response.json():null}));
    inFlight.set(key,request);
    const current=request;
    void request.finally(()=>{if(inFlight.get(key)===current)inFlight.delete(key);}).catch(()=>{});
  }
  return await request as {ok:boolean;status:number;data:T|null};
}

/** Một timer dùng chung cho mọi bảng đang mở trong tab; tab ẩn không có timer polling. */
export function createLeaderboardRefreshHub(environment:Environment){
  const listeners=new Set<Listener>();let timer:unknown=null;
  const emit=(reason:LeaderboardRefreshReason)=>{
    // Poll/focus tiếp tục dùng request đang chạy; chỉ một thay đổi đã xác nhận mới bỏ lượt cũ.
    const event={reason,revision:reason==='submitted'||reason==='session'||reason==='profile'?invalidateLeaderboardRequests():requestRevision};
    for(const listener of listeners)listener(event);
  };
  const stopTimer=()=>{if(timer!==null){environment.clearTimer(timer);timer=null;}};
  const schedule=()=>{
    stopTimer();
    if(listeners.size&&environment.document.visibilityState==='visible')timer=environment.setTimer(()=>{timer=null;if(environment.document.visibilityState==='visible')emit('poll');schedule();},LEADERBOARD_POLL_MS);
  };
  const visible=()=>{stopTimer();if(environment.document.visibilityState==='visible'){emit('visible');schedule();}};
  const profile=()=>emit('profile'),session=()=>emit('session'),focus=()=>emit('focus');
  const storage=(event:Event)=>{
    const item=event as StorageEvent;
    if(item.key===LEADERBOARD_REFRESH_KEY){
      try{const message=JSON.parse(item.newValue||'null');if(message?.kind==='submitted'&&typeof message.nonce==='string')emit('submitted');}catch{/* Storage chỉ là tín hiệu làm mới tùy chọn. */}
    }else if(item.key===SYNC_KEY){
      try{if(JSON.parse(item.newValue||'null')?.kind==='session')session();else profile();}catch{profile();}
    }
  };
  const start=()=>{
    environment.window.addEventListener(APPEARANCE_EVENT,profile);environment.window.addEventListener(SESSION_EVENT,session);
    environment.window.addEventListener('storage',storage);environment.window.addEventListener('focus',focus);
    environment.document.addEventListener('visibilitychange',visible);schedule();
  };
  const stop=()=>{
    stopTimer();environment.window.removeEventListener(APPEARANCE_EVENT,profile);environment.window.removeEventListener(SESSION_EVENT,session);
    environment.window.removeEventListener('storage',storage);environment.window.removeEventListener('focus',focus);
    environment.document.removeEventListener('visibilitychange',visible);
  };
  return {
    subscribe(listener:Listener){listeners.add(listener);if(listeners.size===1)start();return()=>{listeners.delete(listener);if(!listeners.size)stop();};},
    submitted(){
      emit('submitted');
      // Không ghi tên, mã học sinh, điểm, lớp, cookie hoặc nội dung bài làm.
      try{environment.window.localStorage?.setItem(LEADERBOARD_REFRESH_KEY,JSON.stringify({kind:'submitted',nonce:environment.nonce()}));}catch{/* Không chặn nộp bài nếu trình duyệt chặn storage. */}
    },
  };
}
let browserHub:ReturnType<typeof createLeaderboardRefreshHub>|undefined;
function hub(){
  if(!browserHub&&typeof window!=='undefined'&&typeof document!=='undefined')browserHub=createLeaderboardRefreshHub({window,document,setTimer:(callback,delay)=>setTimeout(callback,delay),clearTimer:timer=>clearTimeout(timer as ReturnType<typeof setTimeout>),nonce:()=>globalThis.crypto?.randomUUID?.()??String(Date.now())+Math.random().toString(36).slice(2)});
  return browserHub;
}
export function subscribeLeaderboardRefresh(listener:Listener){return hub()?.subscribe(listener)??(()=>{});}
/** Chỉ gọi sau khi máy chủ xác nhận một lượt nộp thành công. */
export function notifyLeaderboardSubmitted(){hub()?.submitted();}

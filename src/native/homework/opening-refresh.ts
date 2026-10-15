import type {HomeworkLesson} from './btvn-contract';

/** Một lần đọc lại tại mốc mở gần nhất, thử lại sau lỗi; không polling từng giây. */
export function scheduleOpeningRefresh(lessons:HomeworkLesson[],refresh:()=>Promise<void>,now=Date.now,timer:{set:(fn:()=>void,delay:number)=>unknown;clear:(id:any)=>void}={set:setTimeout,clear:clearTimeout}) {
  const opening=Math.min(...lessons.filter(l=>l.locked&&Number.isFinite(l.opensAt)).map(l=>l.opensAt!));
  let stopped=false,id:unknown;
  const run=()=>{if(stopped)return;if(now()<opening){schedule();return;}void refresh().then(()=>{if(!stopped)id=timer.set(run,30000);}).catch(()=>{if(!stopped)id=timer.set(run,30000);});};
  const schedule=()=>{id=timer.set(run,Math.max(0,Math.min(2147483647,opening-now()+50)));};
  if(Number.isFinite(opening))schedule();
  return ()=>{stopped=true;timer.clear(id);};
}

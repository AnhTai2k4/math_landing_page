import type {HomeworkState,HomeworkLesson} from './btvn-contract';

/** Chỉ đồng bộ danh sách và mốc giờ, không đụng bản đang làm hoặc biên nhận. */
export function mergeOpeningState(previous:HomeworkState,next:HomeworkState):HomeworkState{
  if(next.saveOnly||previous.lessonCode!==next.lessonCode)return previous;
  if(Number.isFinite(previous.serverNow)&&Number.isFinite(next.serverNow)&&next.serverNow!<previous.serverNow!)return previous;
  const clock=Number.isFinite(next.serverNow)&&Number.isFinite(next.clientReceivedAt)?{serverNow:next.serverNow,clientReceivedAt:next.clientReceivedAt}:{};
  return {...previous,lessons:next.lessons??previous.lessons,...clock};
}

/** Một lần đọc lại tại mốc mở gần nhất, thử lại sau lỗi; không polling từng giây. */
export function scheduleOpeningRefresh(lessons:HomeworkLesson[],refresh:()=>Promise<void>,now=Date.now,timer:{set:(fn:()=>void,delay:number)=>unknown;clear:(id:any)=>void}={set:(fn,delay)=>setTimeout(fn,delay),clear:id=>clearTimeout(id)}) {
  const opening=Math.min(...lessons.filter(l=>l.locked&&Number.isFinite(l.opensAt)).map(l=>l.opensAt!));
  let stopped=false,id:unknown;
  const run=()=>{if(stopped)return;if(now()<opening){schedule();return;}void refresh().then(()=>{if(!stopped)id=timer.set(run,30000);}).catch(()=>{if(!stopped)id=timer.set(run,30000);});};
  // Server còn giữ bài sau mốc mở thì chờ, tránh effect mới tạo chuỗi request tức thời.
  const schedule=()=>{const remaining=opening-now();id=timer.set(run,remaining>0?Math.min(2147483647,remaining+50):30000);};
  if(Number.isFinite(opening))schedule();
  return ()=>{stopped=true;timer.clear(id);};
}

import type {Draft} from '../exams/store';
import type {HomeworkState} from './btvn-contract';

export type RemoteSaveStatus={pending:boolean;saving:boolean;failed:boolean;message:string};
export const REMOTE_SAVE_INITIAL:RemoteSaveStatus={pending:false,saving:false,failed:false,message:''};
export const REMOTE_LEAVE_MESSAGE='Có đáp án chưa được máy chủ MTM xác nhận. Rời trang có thể mất phần đang giữ. Em muốn rời trang?';

/** Map chỉ giữ RAM. Chỉ ACK của bản mới nhất hoặc kết quả nộp từ máy chủ mới xác nhận lưu. */
export function createHomeworkSaver(options:{
  send:(draft:Draft)=>Promise<HomeworkState>;
  onSaved:(state:HomeworkState)=>void;
  onStatus:(status:RemoteSaveStatus)=>void;
  delay?:number;
}){
  let latest:{seq:number;draft:Draft}|null=null,seq=0,ack=0,terminal=false,attached=true;
  let timer:ReturnType<typeof setTimeout>|undefined,queue=Promise.resolve();
  const enqueued=new Set<number>();
  const publish=(saving:boolean,failed:boolean,message:string)=>{
    if(attached)options.onStatus({pending:seq>ack,saving,failed,message});
  };
  const clearTimer=()=>{if(timer!==undefined)clearTimeout(timer);timer=undefined;};
  const sendLatest=()=>{
    clearTimer();const item=latest;
    if(!item||terminal||enqueued.has(item.seq))return;
    enqueued.add(item.seq);
    publish(true,false,item.draft.submittedAt===null?'Đang lưu bài trên máy chủ MTM…':'Đang gửi bài đến máy chủ MTM…');
    queue=queue.then(async()=>{
      if(terminal)return;
      try{
        const next=await options.send(item.draft);
        if(next.draft?.attemptId!==item.draft.attemptId)throw new Error('Máy chủ chưa xác nhận đúng lượt làm bài. Giữ trang mở và gửi lại.');
        ack=Math.max(ack,item.seq);
        if(next.draft.submittedAt!==null){terminal=true;ack=seq;clearTimer();}
        if(terminal||item.seq===seq){
          publish(false,false,terminal?'Máy chủ MTM đã nhận bài.':'Đã lưu bài trên máy chủ MTM.');
          if(attached)options.onSaved(next);
        }
      }catch(error){
        if(item.seq===seq)publish(false,true,error instanceof Error?error.message:'Chưa gửi được. Giữ trang mở và thử lại.');
      }finally{enqueued.delete(item.seq);}
    });
  };
  return {
    update(draft:Draft){
      if(terminal)return;
      latest={seq:++seq,draft};clearTimer();
      publish(true,false,'Đang chờ máy chủ MTM lưu đáp án…');
      if(draft.submittedAt!==null)sendLatest();else timer=setTimeout(sendLatest,options.delay??500);
    },
    retry:sendLatest,
    pending:()=>seq>ack,
    // Rời trang đã được xác nhận: cố gửi bản mới nhất, không cập nhật component đã tháo.
    dispose(){attached=false;if(timer!==undefined)sendLatest();},
    settled:()=>queue,
  };
}

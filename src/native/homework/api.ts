import {requireBackend} from '../admin/backend';
import type {HomeworkApi} from './types';
export class HomeworkError extends Error{constructor(public code:string,message:string){super(message);}}
async function call<T>(operation:string,args:Record<string,unknown>):Promise<T>{const r=await requireBackend().functions.invoke('mtm-homework-access',{body:{operation,...args}});if(r.error){const status=r.error.context?.status,code=status===409?'40001':status===401?'42501':status===429?'RATE':'NETWORK';throw new HomeworkError(code,code==='40001'?'Bài đã thay đổi ở phiên khác. Tải lại bài để lấy đáp án mới nhất.':code==='42501'?'Phiên hoặc quyền xem bài đã hết. Nhập lại mã hoặc liên hệ giáo viên.':code==='RATE'?'Mã đang được kiểm tra quá nhiều lần. Chờ một phút rồi thử lại.':'Chưa thực hiện được. Giữ bài đang nhập và thử lại khi có kết nối.');}return r.data as T;}
const args=(session:string)=>({session});
export const homeworkApi:HomeworkApi={
 resolve:code=>call('resolve',{code}),
 confirm:challenge=>call('confirm',{challenge}),
 logout:session=>call('logout',args(session)),
 assignments:session=>call('assignments',args(session)),
 history:session=>call('history',args(session)),
 async leaderboard(id,month){const r=await requireBackend().rpc('mtm_hw_leaderboard',{p_class_id:id,p_month:month});if(r.error)throw new HomeworkError('NETWORK','Chưa tải được bảng tháng.');return r.data;},
 start:(session,id)=>call('start',{...args(session),assignment:id}),
 save:(session,id,revision,answers)=>call('save',{...args(session),attempt:id,revision,answers}),
 submit:(session,id,revision,answers,key)=>call('submit',{...args(session),attempt:id,revision,answers,submissionKey:key}),
 result:(session,id)=>call('result',{...args(session),attempt:id}),
 async pdf(session,attempt,kind){const data=await call<Blob>('pdf',{session,attempt,kind});if(!(data instanceof Blob)||data.type!=='application/pdf')throw new HomeworkError('PDF','Chưa tải được PDF riêng. Thử lại; bài đang làm vẫn được giữ.');return data;}
};

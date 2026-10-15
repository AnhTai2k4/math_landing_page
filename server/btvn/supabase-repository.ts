import {randomBytes} from 'node:crypto';
import {HomeworkService,HomeworkError,GATE_ERROR} from './service';
import {MemoryHomeworkRepository,scoresCsv,type StudentWork} from './repository';
import type {HomeworkState,HomeworkLesson,LessonMaterial,GateInput} from '../../src/native/homework/btvn-contract';
import type {PracticeExam} from '../../src/native/exams/data';
import type {Answers} from '../../src/native/exams/store';
import {publicClassNames} from './class-config';
import {hydratePrivateAssets,SIGNED_ASSET_SECONDS,type PrivateAsset} from './private-assets';
import {concealMonthlySolutions} from './monthly-policy';
import {lessonOpensAt,visibleLesson} from './opening-policy';

export interface RpcTransport {rpc(name:string,args:Record<string,unknown>):Promise<{data:unknown;error:null|{code?:string}}>}
export type DurableSnapshot={revision:number;work:StudentWork;exam?:PracticeExam;material?:LessonMaterial;lessons:LessonMaterial[]};
function monthlyCards(lessons:LessonMaterial[],now:number,className:string){return lessons.map(l=>{const visible=visibleLesson(l,className,now),row=l as Partial<HomeworkLesson>;
  const card={...visible,dueAt:row.dueAt??null,bestScore:visible.locked?null:row.bestScore??null,late:visible.locked?null:row.late??null,submittedAt:visible.locked?null:row.submittedAt??null,available:visible.locked?false:row.available===true};
  return l.kind==='kiem-tra-thang'&&now<(l.closesAt??Infinity)?{...card,materialUrl:null,handoutUrl:null,homeworkUrl:null,homeworkUrls:[],videoId:null,videoUrl:null}:card;});}
/** Server-only. Không liệt kê học sinh, không giữ mã thô trong repository.
 * Mỗi request đọc snapshot có quyền; CAS DB là điểm commit duy nhất.
 * Edge Function giữ resolver cũ + limiter chung; transport phải trỏ đúng Edge đã có. */
export class SupabaseHomeworkRepository {
  constructor(private db:RpcTransport,private edge:(body:Record<string,unknown>)=>Promise<any>,private clock=Date.now,private signAsset?:(path:string,seconds:number)=>Promise<string>){}
  async login(gate:GateInput,details?:{classMismatch?:boolean}){
    const keys=gate&&typeof gate==='object'?Object.keys(gate):[];
    if(keys.length===1&&keys[0]==='studentCode'&&typeof (gate as any).studentCode==='string'){
      const code=(gate as {studentCode:string}).studentCode.replace(/^HS-/i,'');
      const resolved=await this.edge({operation:'resolve',code});
      if(!resolved?.ok||!resolved.challenge)throw new HomeworkError(401,GATE_ERROR);
      const confirmed=await this.edge({operation:'confirm',challenge:resolved.challenge});
      if(!confirmed?.ok||!confirmed.session)throw new HomeworkError(401,GATE_ERROR);
      return confirmed.session as string;
    }
    if(keys.length!==3||!['fullName','phone','className'].every(k=>keys.includes(k)))throw new HomeworkError(401,GATE_ERROR);
    const result=await this.edge({operation:'forgot',...gate});
    if(!result?.ok||!result.session)throw new HomeworkError(401,GATE_ERROR);
    if(details)details.classMismatch=result.classMismatch===true;
    return result.session as string;
  }
  private async rpc<T>(name:string,args:Record<string,unknown>):Promise<T>{
    const out=await this.db.rpc(name,args);if(out.error)throw new HomeworkError(out.error.code==='42501'?401:out.error.code==='40001'?409:503,out.error.code==='42501'?GATE_ERROR:out.error.code==='40001'?'Bài đã thay đổi ở tab khác. Tải lại để tiếp tục.':'Chưa kết nối được máy chủ. Em thử lại sau.');return out.data as T;
  }
  async logout(session:string){await this.rpc('mtm_btvn_logout',{p_session:session});}
  async classNames(){return publicClassNames(await this.rpc<unknown>('mtm_btvn_classes',{}));}
  async issueMissingCode(studentId:string,days=90){return this.rpc<{ok:boolean;code?:string;preserved?:boolean}>('mtm_btvn_issue_missing_code',{p_student_id:studentId,p_days:days});}
  async scoresFile(lessonCode:string){const rows=await this.rpc<StudentWork[]>('mtm_btvn_admin_scores',{p_lesson:lessonCode});return scoresCsv(rows,lessonCode);}
  async reconcileDue(lessonCode:string,studentId:string,startsAt:number,sourceIdentity:string){
    if(!Number.isFinite(startsAt)||startsAt<=0||!sourceIdentity)throw new Error('Thiếu ca thực học đã xác minh');
    return this.rpc('mtm_btvn_set_due',{p_student_id:studentId,p_lesson:lessonCode,p_starts_at:new Date(startsAt).toISOString(),p_source_identity:sourceIdentity});
  }
  async call(session:string,action:'state'|'select'|'start'|'save'|'submit',lessonCode?:string,attemptId?:string,answers?:Answers):Promise<HomeworkState>{
    // Hai lần thử lại chỉ khi CAS báo xung đột; mọi lỗi quyền/lưu khác dừng ngay.
    for(let retry=0;retry<3;retry++){
      const snapshot=await this.rpc<DurableSnapshot>('mtm_btvn_read',{p_session:session,p_lesson:lessonCode??null});
      const now=this.clock(),className=snapshot.work.student.className;
      if(snapshot.material&&now<lessonOpensAt(snapshot.material,className)){
        if(action!=='state'&&action!=='select')throw new HomeworkError(409,'Bài chưa mở. BTVN chỉ mở làm sau buổi học.');
        return {exam:null,kind:snapshot.material.kind,opensAt:lessonOpensAt(snapshot.material,className),closesAt:snapshot.material.closesAt,solutionsAvailable:false,canStart:false,fullName:snapshot.work.student.fullName,className,lessonCode:snapshot.material.lessonCode,dueAt:snapshot.work.student.nextActualClassAt??null,maxAttempts:snapshot.material.kind==='kiem-tra-thang'?1:5,attemptsUsed:0,draft:null,receipts:[],bestScore:null,demo:false,lessons:monthlyCards(snapshot.lessons,now,className) as HomeworkState['lessons']};
      }
      if(!snapshot.exam||!snapshot.material){
        if(snapshot.lessons.length||snapshot.exam||snapshot.material)throw new HomeworkError(503,'Dữ liệu buổi học chưa sẵn sàng.');
        if(action!=='state')throw new HomeworkError(404,'Lớp em chưa có BTVN trên web.');
        return {exam:null,fullName:snapshot.work.student.fullName,className:snapshot.work.student.className,lessonCode:'',dueAt:null,maxAttempts:5,attemptsUsed:0,draft:null,receipts:[],bestScore:null,demo:false,lessons:[]};
      }
      const monthly=snapshot.material.kind==='kiem-tra-thang';
      const code=randomBytes(16).toString('hex'),work={...snapshot.work,student:{...snapshot.work.student,studentCode:code}};
      const memory=new MemoryHomeworkRepository([]);memory.put(work);
      const service=new HomeworkService(memory,snapshot.exam,0,'private',snapshot.material.lessonCode,this.clock,[snapshot.material]);
      const token=service.login({studentCode:code},'internal');
      const next=action==='start'?service.start(token):action==='save'?service.save(token,attemptId??'',answers??{}):action==='submit'?service.submit(token,attemptId??'',answers??{}):service.state(token);
      next.demo=false;
      if(monthly){next.kind='kiem-tra-thang';next.opensAt=snapshot.material.opensAt;next.closesAt=snapshot.material.closesAt;next.solutionsAvailable=now>=snapshot.material.closesAt!;next.canStart=now<snapshot.material.closesAt!;}
      // Hạn/điểm mỗi thẻ lấy từ snapshot có quyền, không suy từ lịch lớp.
      next.lessons=monthlyCards(snapshot.lessons,now,className) as HomeworkState['lessons'];
      if(action==='state'||action==='select'){
        const visible=monthly&&!next.solutionsAvailable?concealMonthlySolutions(snapshot.exam):snapshot.exam;
        next.exam=visible;
        if(this.signAsset){const assets=await this.rpc<PrivateAsset[]>('mtm_btvn_assets',{p_session:session,p_lesson:snapshot.material.lessonCode});const signedAt=this.clock();next.exam=await hydratePrivateAssets(visible,assets,this.signAsset);if(assets.length)next.assetsExpiresAt=signedAt+SIGNED_ASSET_SECONDS*1000;}
        return next;
      }
      const updated=memory.get(code)!;
      const committed=await this.rpc<{ok:boolean}>('mtm_btvn_commit',{p_session:session,p_lesson:snapshot.material.lessonCode,p_revision:snapshot.revision,p_drafts:updated.drafts,p_receipts:updated.receipts});
      if(committed.ok){
        // Save chỉ xác nhận bản vừa commit, không đọc/ký lại đề và tài sản.
        if(action==='save')return {...next,exam:null,lessons:undefined,saveOnly:true,revision:snapshot.revision+1};
        return this.call(session,'state',snapshot.material.lessonCode);
      }
    }
    throw new HomeworkError(409,'Bài đã thay đổi ở tab khác. Tải lại để tiếp tục.');
  }
}

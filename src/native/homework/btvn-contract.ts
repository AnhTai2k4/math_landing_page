import type {PracticeExam} from '../exams/data';
import type {Draft, Answers} from '../exams/store';

export type GateInput = {studentCode:string}|{fullName:string; phone:string; className:string};
export type HomeworkReceipt = {attemptId:string; attemptNumber:number; submittedAt:number; elapsedSeconds:number; score:number; late:boolean|null; timedOut:boolean};
export type LessonMaterial = {lessonCode:string;classNames:string[];classDates?:Record<string,string>;date:string;title:string;videoId:string|null;videoUrl?:string|null;homeworkUrls?:string[];homeworkNote?:string;homeworkTitle?:string;materialUrl:string|null;handoutUrl:string|null;homeworkUrl:string|null};
export type HomeworkLesson = LessonMaterial & {dueAt:number|null;bestScore:number|null;late:boolean|null;submittedAt:number|null;available:boolean};
export type HomeworkState = {exam:PracticeExam|null; classMismatch?:boolean; fullName:string; className:string; lessonCode:string; dueAt:number|null; maxAttempts:number; attemptsUsed:number; draft:Draft|null; receipts:HomeworkReceipt[]; bestScore:number|null; demo:boolean;lessons?:HomeworkLesson[]};
export type HomeworkAction = 'login'|'state'|'start'|'save'|'submit'|'logout'|'select';
/** Giao diện duy nhất giữa trình duyệt và máy chủ; không chứa danh sách học sinh. */
export interface HomeworkGateway {
  call(action:HomeworkAction, body?:{lessonCode?:string;gate?:GateInput;attemptId?:string;answers?:Answers}):Promise<HomeworkState>;
}

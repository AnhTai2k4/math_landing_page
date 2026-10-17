import type {ReactNode} from 'react';
import type {PracticeExam,PracticeQuestion} from './data';
import type {Store} from './store';
export type PracticeAttemptProps = {exam: PracticeExam; previousExam?:PracticeExam; catalogUrl: string; storeOverride?:Store;questionReader?:ReactNode;renderText?:(text:string)=>ReactNode;renderSolutionExtra?:(q:PracticeQuestion)=>ReactNode;contextLabel?:string;audienceLabel?:string;displayTitle?:string;kind?:'practice'|'exam';isHomework?:boolean;homeworkSelfCheck?:ReactNode;deadlineAt?:number;clockOffsetMs?:number;newAttemptsClosed?:string;storageNotice?:string;saveStatus?:string;savePending?:boolean;onRetrySave?:()=>void;onAcceptClosed?:()=>void;onRetake?:()=>void};

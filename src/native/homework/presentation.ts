import type {HomeworkState,LessonMaterial} from './btvn-contract';
export const isDemoVideo=(id:string)=>id==='abcdefghijk';
export const displayClassName=(state:HomeworkState)=>state.demo&&/^LOP-TEST-/i.test(state.className)?'Lớp học thử':state.className;
export function homeworkTitle(state:HomeworkState){return state.exam?.title??'Bài tập về nhà';}
export function lessonHomeworkTitle(lesson:LessonMaterial){return lesson.homeworkTitle?.trim()||lesson.homeworkNote?.trim()||'Bài tập về nhà';}
export function lessonCaption(lesson:LessonMaterial,demo=false){return 'Buổi học '+lesson.date.slice(8,10)+'/'+lesson.date.slice(5,7)+': '+(demo?lesson.title.replace(/^Bài mẫu thử: /,''):lesson.title);}
export function homeworkLessonCaption(state:HomeworkState){const lesson=state.lessons?.find(l=>l.lessonCode===state.lessonCode);return lesson?lessonCaption(lesson,state.demo):null;}

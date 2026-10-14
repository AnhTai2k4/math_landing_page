import type {HomeworkState} from './btvn-contract';
export const isDemoVideo=(id:string)=>id==='abcdefghijk';
export const displayClassName=(state:HomeworkState)=>state.demo&&/^LOP-TEST-/i.test(state.className)?'Lớp học thử':state.className;
export function homeworkTitle(state:HomeworkState){
  const lesson=state.lessons?.find(l=>l.lessonCode===state.lessonCode);
  return lesson?`BTVN buổi ${lesson.date.slice(8,10)}/${lesson.date.slice(5,7)} · ${state.demo?lesson.title.replace(/^Bài mẫu thử: /,''):lesson.title}`:'Bài tập về nhà';
}

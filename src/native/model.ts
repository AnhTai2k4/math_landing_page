import {courses,findCourse,type Course,type Lesson} from '../migration/catalogue';
import snapshot from './public-content.json';
export const publicSnapshot=snapshot;
export function nativeLessonUrl(course:Course,lesson:Lesson){return '/bai-hoc/'+encodeURIComponent(lesson.slug)+'?courseSlug='+encodeURIComponent(course.slug);}
export function resolveNativeLesson(pathname:string,search:string){
 if(!pathname.startsWith('/bai-hoc/'))return undefined;
 let slug:string;try{slug=decodeURIComponent(pathname.slice('/bai-hoc/'.length));}catch{return undefined;}
 const p=new URLSearchParams(search);if(p.getAll('courseSlug').length!==1)return undefined;const course=findCourse(p.get('courseSlug')??'');if(!course)return undefined;
 const entries=course.sections.flatMap(chapter=>chapter.lessons.map(lesson=>({lesson,chapter}))),index=entries.findIndex(x=>x.lesson.slug===slug);if(index<0)return undefined;
 return{course,...entries[index],entries,index,previous:entries[index-1],next:entries[index+1]};
}
export const nativePathForExam=(id:string)=>'/thi-thu/'+encodeURIComponent(id);
export const nativePathForDocument=(id:string)=>'/tai-lieu/'+encodeURIComponent(id);
export function nativeRouteKnown(path:string,search:string){return path.startsWith('/bai-hoc/')?!!resolveNativeLesson(path,search):path.startsWith('/thi-thu/')?snapshot.exams.some(x=>nativePathForExam(x.id)===path):path.startsWith('/tai-lieu/')&&path!=='/tai-lieu/tham-khao'?snapshot.documents.some(x=>nativePathForDocument(x.id)===path):false;}
export const nativeCourseMetadata=(c:Course)=>snapshot.courses.find(x=>x.slug===c.slug);
export const fullLessonCount=courses.reduce((n,c)=>n+c.sections.reduce((m,s)=>m+s.lessons.length,0),0);
export const NATIVE_COMPLETION={catalogue:'LOCAL_PUBLIC_UI_IMPLEMENTED',lessonNavigation:'LOCAL_METADATA_IMPLEMENTED',video:'NOT_CONNECTED',comments:'NOT_CONNECTED',login:'NOT_CONNECTED',exams:'METADATA_ONLY_NO_GRADING',documents:'LOCAL_VERIFIED_PUBLIC_PDFS_ONLY',documentAccountSync:'NOT_CONNECTED',privateDocumentAccess:'NOT_MIGRATED',notebook:'LOCAL_DRAFT_NOT_ACCOUNT_SYNC',published:false} as const;

import {readLessonMaterials,type LessonSourceConfig} from './lesson-materials';
const columns={className:'Lớp',date:'Ngày',title:'Bài',material:'Tài liệu',handout:'Handout',video:'Video xem lại',homework:'BTVN'};
/** Hoàn toàn giả, không phải học liệu của lớp thật. */
export const demoLessonConfig:LessonSourceConfig={sheetId:'FAKE-MATERIALS-1',tab:'TAB-GIA',programKey:'lop-test-12',paired:false,classNames:['LOP-TEST-12'],columns};
export const demoLessons=readLessonMaterials(Object.values(columns),[
  ['LOP-TEST-12','2026-10-14','Bài mẫu thử: Hàm số và đồ thị','','','https://youtu.be/abcdefghijk','https://example.invalid/btvn-1'],
  ['LOP-TEST-12','2026-10-12','Bài mẫu thử: Ôn tập','','','','https://example.invalid/btvn-2'],
  ['LOP-TEST-12','2026-10-09','Bài mẫu thử: Video và BTVN','https://example.invalid/tai-lieu','https://example.invalid/handout','https://youtu.be/abcdefghijk','https://example.invalid/btvn-3'],
],demoLessonConfig).lessons.map((lesson,index)=>({...lesson,lessonCode:index===0?'buoi-mau-01':lesson.lessonCode}));

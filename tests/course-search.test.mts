import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {courses,normal} from '../src/migration/catalogue';
import {nativeLessonUrl} from '../src/native/model';
import {courseSearch} from '../src/native/course-search';

const course=courses.find(c=>c.slug==='step-1-nen-tang-toan-12')!;
const opened=new Set([course.sections[1].id,course.sections[4].id]);
const search=(query:string)=>courseSearch(course.sections,query,opened);

test('Actual source regression: tiem can retains ordinal 03 and six original lessons',()=>{
 const chapter=course.sections[0];
 const oldMatches=chapter.lessons.filter(l=>normal(l.title+' '+l.subtitle).includes('tiem can'));
 assert.equal(oldMatches.length,1);
 assert.equal(chapter.lessons.indexOf(oldMatches[0])+1,3);
 const result=search('tiem can');
 assert.equal(result.chapters.length,1);
 assert.equal(result.matchCount,1);
 assert.equal(result.chapters[0].chapter.lessons.length,6);
 assert.equal(String(result.chapters[0].lessons[0].ordinal).padStart(2,'0'),'03');
 assert.equal(result.chapters[0].lessons[0].lesson,chapter.lessons[2]);
});

test('Vietnamese accents, stroked D, case and decomposed Unicode match the same source lesson',()=>{
 const expected=search('duong tiem can');
 for(const query of ['ĐƯỜNG TIỆM CẬN','Đường tiệm cận'.normalize('NFD'),'đường TIỆM cận']){
  assert.deepEqual(search(query),expected);
 }
 assert.equal(expected.chapters[0].lessons[0].ordinal,3);
});

test('Leading, trailing and repeated whitespace including tabs and newlines is normalized',()=>{
 for(const query of ['  tiem can  ','tiem   can','\ttiem\ncan\u00a0']){
  assert.deepEqual(search(query),search('tiem can'));
 }
});

test('Whitespace-only searches behave as cleared state without forcing chapters open',()=>{
 for(const query of [' ','\t\n','\u00a0  '])assert.deepEqual(search(query),search(''));
 assert.equal(search('').searching,false);
});

test('Subtitle-only match retains original title, identity and ordinal',()=>{
 const result=search('GTLN, GTNN');
 assert.equal(result.matchCount,1);
 assert.equal(result.chapters[0].lessons[0].lesson,course.sections[0].lessons[1]);
 assert.equal(result.chapters[0].lessons[0].ordinal,2);
});

test('Matches across chapters retain chapter order, original counts and within-chapter ordinals',()=>{
 const result=search('bai tap cuoi chuong');
 assert.deepEqual(result.chapters.map(x=>x.chapter.id),course.sections.map(s=>s.id));
 assert.deepEqual(result.chapters.map(x=>x.chapter.lessons.length),[6,4,3,4,5,3]);
 assert.deepEqual(result.chapters.map(x=>x.lessons.map(l=>l.ordinal)),[[6],[4],[3],[4],[5],[3]]);
 assert.equal(result.matchCount,6);
});

test('All source courses preserve source order, metadata and lesson URLs before and after filtering',()=>{
 for(const c of courses){
  const all=courseSearch(c.sections,'',new Set());
  assert.deepEqual(all.chapters.map(x=>x.chapter),c.sections);
  for(const item of all.chapters){
   assert.deepEqual(item.lessons.map(x=>x.lesson),item.chapter.lessons);
   for(const {lesson,ordinal} of item.lessons){
    const filtered=courseSearch(c.sections,lesson.title,new Set());
    const found=filtered.chapters.find(x=>x.chapter===item.chapter)!.lessons.find(x=>x.lesson===lesson)!;
    assert.equal(found.ordinal,ordinal);
    assert.equal(nativeLessonUrl(c,found.lesson),nativeLessonUrl(c,item.chapter.lessons[ordinal-1]));
   }
  }
 }
});

test('Clear after a match or no match restores the chosen accordion state and complete syllabus',()=>{
 const before=search('');
 assert.deepEqual(before.chapters.map(x=>x.expanded),[false,true,false,false,true,false]);
 assert.ok(search('tiem can').chapters.every(x=>x.expanded));
 assert.deepEqual(search(''),before);
 assert.equal(search('missing-lesson-xyz').chapters.length,0);
 assert.deepEqual(search(''),before);
 assert.equal(before.matchCount,25);
 assert.deepEqual([...opened],[course.sections[1].id,course.sections[4].id]);
});

test('No-match and empty-source searches do not fabricate lessons',()=>{
 assert.deepEqual(search('missing-lesson-xyz'),{searching:true,chapters:[],matchCount:0});
 assert.deepEqual(courseSearch([],'',opened),{searching:false,chapters:[],matchCount:0});
 assert.deepEqual(courseSearch([],'tiem can',opened),{searching:true,chapters:[],matchCount:0});
});

test('Filtering accepts frozen source data and leaves it byte-equivalent',()=>{
 const source=structuredClone(courses),before=JSON.stringify(source);
 const freeze=(value:object)=>{for(const child of Object.values(value))if(child&&typeof child==='object')freeze(child);Object.freeze(value);};
 freeze(source);
 for(const c of source)for(const query of ['tiem can','  ','bai tap cuoi chuong','missing-lesson-xyz','']){
  courseSearch(c.sections,query,opened);
 }
 assert.equal(JSON.stringify(source),before);
});

// Source contracts supplement pure-state tests; real focus/tab interaction needs a browser.
const ui=readFileSync(new URL('../src/native/NativeCourses.tsx',import.meta.url),'utf8');
test('Clear control is labelled, uses a native button and focuses the referenced input',()=>{
 assert.match(ui,/<input ref=\{searchInput\} aria-label="Tìm kiếm bài học"/);
 assert.match(ui,/<button type="button" aria-label="Xóa tìm kiếm bài học" onClick=\{clearSearch\}/);
 assert.match(ui,/const clearSearch=\(\)=>\{setQuery\(''\);searchInput.current\?\.focus\(\);\};/);
});

test('UI renders source counts and ordinals separately from announced matches',()=>{
 assert.match(ui,/courseSearch\(c.sections,query,opened\)/);
 assert.match(ui,/\{s.lessons.length\} bài học\{searching&&` · \$\{lessons.length\} khớp tìm kiếm`\}/);
 assert.match(ui,/String\(ordinal\).padStart\(2,'0'\)/);
 assert.match(ui,/<div role="status" aria-atomic="true">/);
 assert.match(ui,/href=\{nativeLessonUrl\(c,l\)\}/);
});

test('Search expansion does not toggle saved state; existing tab keyboard controls remain',()=>{
 assert.match(ui,/aria-disabled=\{searching\|\|undefined\}/);
 assert.match(ui,/onClick=\{\(\)=>\{if\(searching\)return;setOpened/);
 assert.match(ui,/tabIndex=\{tab===key\?0:-1\}/);
 for(const key of ['Home','End','ArrowLeft','ArrowRight'])assert.ok(ui.includes(`e.key==='${key}'`));
 assert.match(ui,/document.getElementById\('ne-tab-'\+next\)\?\.focus\(\)/);
});

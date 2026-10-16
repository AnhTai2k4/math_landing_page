import assert from 'node:assert/strict';
import cases from './fixtures/btvn-material-dates.json';
import {materialDate} from '../server/btvn/material-cells';
import {readLessonMaterials,type LessonSourceConfig} from '../server/btvn/lesson-materials';

// Chung fixture tổng hợp với Python, không truy cập Sheet hoặc dữ liệu thật.
for(const entry of cases){
 const schoolYear='schoolYear' in entry?entry.schoolYear:undefined;
 assert.equal(materialDate(entry.value,schoolYear),entry.expected,entry.name);
}

// Các cách gõ cùng ngày phải tạo cùng buổi học ở mặt học liệu web.
const config:LessonSourceConfig={sheetId:'FAKE-SHEET',tab:'FAKE-TAB',programKey:'fake',paired:false,classNames:['LỚP GIẢ'],columns:{className:'Lớp',date:'Ngày',title:'Tên bài',material:'Tài liệu',handout:'Phiếu',homework:'BTVN'}};
const headers=['Lớp','Ngày','Tên bài','Tài liệu','Phiếu','BTVN'];
for(const entry of cases){
 const schoolYear='schoolYear' in entry?entry.schoolYear:undefined;
 const result=readLessonMaterials(headers,[['LỚP GIẢ',entry.value,'Bài giả','','','']],{...config,schoolYear});
 assert.equal(result.lessons.length,entry.expected?1:0,`Tạo buổi: ${entry.name}`);
 if(entry.expected){
  assert.equal(result.lessons[0].lessonCode,`fake-${entry.expected}`,entry.name);
  assert.deepEqual(result.pending,[],entry.name);
 }
}

assert.equal(materialDate('15/10',{startYear:2026,startMonth:13}),null,'Không suy năm từ cấu hình tháng hỏng');
assert.equal(materialDate('15/10',{startYear:2026.5,startMonth:8}),null,'Không suy năm từ cấu hình năm không nguyên');
console.log(`${cases.length} ca ngày dùng chung và ${cases.length} ca mặt học liệu web đạt.`);

// R106: trạng thái buổi, danh sách chọn bài, lịch sử nộp và khung cắt ảnh đại diện.
import assert from 'node:assert/strict';
import {explorerLessons,formatScore,lessonStatus,selectedReceipts,submissionHistory} from '../src/native/homework/R104Dashboard';
import {CENTER_CROP,cropSquare,sameAppearance} from '../src/components/StudentAppearance';
import type {HomeworkLesson,HomeworkState} from '../src/native/homework/btvn-contract';

const NOW=Date.UTC(2026,9,17,3);
const lesson=(code:string,date:string,extra:Partial<HomeworkLesson>={}):HomeworkLesson=>({lessonCode:code,classNames:['2K9'],date,title:'Buổi '+code,videoId:null,materialUrl:null,handoutUrl:null,homeworkUrl:null,dueAt:null,bestScore:null,late:null,submittedAt:null,available:true,...extra});

// Trạng thái theo giờ lớp, không tự mở bài chưa tới giờ.
assert.equal(lessonStatus(lesson('a','2026-10-20',{opensAt:NOW+1000}),NOW),'locked');
assert.equal(lessonStatus(lesson('a','2026-10-16',{opensAt:NOW-1000}),NOW),'open');
assert.equal(lessonStatus(lesson('a','2026-10-16',{available:false}),NOW),'preparing');
assert.equal(lessonStatus(lesson('a','2026-10-16',{submittedAt:NOW-5}),NOW),'submitted');
assert.equal(lessonStatus(lesson('a','2026-10-16',{submittedAt:NOW-5,bestScore:8.5}),NOW),'scored');
assert.equal(lessonStatus(lesson('a','2026-10-16',{kind:'kiem-tra-thang',closesAt:NOW-1}),NOW),'closed');
assert.equal(lessonStatus(lesson('a','2026-10-16',{kind:'kiem-tra-thang',closesAt:NOW+1}),NOW),'open');

// Danh sách mới nhất ở trên; lọc Đã mở bỏ buổi khóa.
const lessons=[lesson('a','2026-10-13',{submittedAt:NOW-90,bestScore:9}),lesson('b','2026-10-16',{submittedAt:NOW-10,late:true}),lesson('c','2026-10-20',{opensAt:NOW+1})];
assert.deepEqual(explorerLessons(lessons,NOW,'all').map(l=>l.lessonCode),['c','b','a']);
assert.deepEqual(explorerLessons(lessons,NOW,'opened').map(l=>l.lessonCode),['b','a']);
assert.deepEqual(lessons.map(l=>l.lessonCode),['a','b','c'],'không đổi thứ tự mảng gốc');

// Lịch sử chỉ lấy buổi có thời điểm nộp thật, mới nhất trước.
assert.deepEqual(submissionHistory(lessons).map(l=>l.lessonCode),['b','a']);
assert.deepEqual(submissionHistory([lesson('x','2026-10-01',{submittedAt:Number.NaN})]),[]);

// Biên nhận chỉ gắn với buổi đang chọn có trong danh sách.
const state=(lessonCode:string,receipts:HomeworkState['receipts']):HomeworkState=>({exam:null,fullName:'',className:'2K9',lessonCode,dueAt:null,maxAttempts:3,attemptsUsed:receipts.length,draft:null,receipts,bestScore:null,demo:false,lessons});
const receipt=(n:number,at:number)=>({attemptId:'r'+n,attemptNumber:n,submittedAt:at,elapsedSeconds:60,score:null,late:false,timedOut:false});
assert.equal(selectedReceipts(state('b',[])),null);
assert.equal(selectedReceipts(state('khong-co',[receipt(1,NOW)])),null);
assert.deepEqual(selectedReceipts(state('b',[receipt(1,NOW-50),receipt(2,NOW-5)]))?.receipts.map(r=>r.attemptNumber),[2,1]);

assert.equal(formatScore(8.5),'8,5');
assert.equal(formatScore(10),'10');

// Khung cắt: giữa, sát mép và giá trị lỗi đều nằm trong ảnh.
assert.deepEqual(cropSquare(400,200,CENTER_CROP),{sx:100,sy:0,side:200});
assert.deepEqual(cropSquare(400,200,{zoom:1,x:-1,y:0}),{sx:0,sy:0,side:200});
assert.deepEqual(cropSquare(400,200,{zoom:1,x:1,y:0}),{sx:200,sy:0,side:200});
assert.deepEqual(cropSquare(200,200,{zoom:2,x:1,y:-1}),{sx:100,sy:0,side:100});
const wild=cropSquare(300,500,{zoom:9,x:5,y:Number.NaN});
assert.ok(wild.side===100&&wild.sx+wild.side<=300&&wild.sy+wild.side<=500&&wild.sx>=0&&wild.sy>=0);

assert.ok(sameAppearance({avatar:'orbit',photo:''},{avatar:'orbit',photo:''}));
assert.ok(!sameAppearance({avatar:'orbit',photo:''},{avatar:'spark',photo:''}));
assert.ok(!sameAppearance({avatar:'orbit',photo:'data:image/jpeg;base64,AA=='},{avatar:'orbit',photo:''}));
console.log('exams-r106-dashboard: ok');

import assert from 'node:assert/strict';
import {readAux,writeAux,emptyAux,auxKey,roomShortcut,warningBand} from '../src/native/exams/room-aux';
import {PRACTICE_EXAMS} from '../src/native/exams/data';
import {createDraft,saveDraft,readDraft,draftKey} from '../src/native/exams/store';
import {FakeStore,suite} from './exams-harness.mts';
const {test,finish}=suite('F');
test('Kho phụ thiếu/hỏng/không phải object/bị chặn đọc luôn bỏ qua',()=>{
  for(const raw of [undefined,'{','null','[]','"text"','a'.repeat(100001)]){
    const store=new FakeStore(raw===undefined?{}:{[auxKey('a')]:raw});
    assert.deepEqual(readAux(store,'a',22),emptyAux());
  }
  const denied=new FakeStore();denied.failGet=true;assert.deepEqual(readAux(denied,'a',22),emptyAux());
});
test('Phục hồi câu/đánh dấu/nháp/cỡ chữ; bỏ chỉ số ngoài đề và nội dung quá dài',()=>{
  const store=new FakeStore();const aux={active:17,marked:[0,17],notes:{17:'Tách hai trường hợp'},font:1.15,dark:true};
  assert.equal(writeAux(store,'a',aux),true);assert.deepEqual(readAux(store,'a',22),aux);
  store.setItem(auxKey('a'),JSON.stringify({active:22,marked:[-1,0,0,21,22,'1'],notes:{0:'a'.repeat(3000),22:'b'},font:99,dark:'true'}));
  assert.deepEqual(readAux(store,'a',22),{active:0,marked:[0,21],notes:{0:'a'.repeat(2000)},font:1,dark:false});
});
test('Tách từng attempt và báo lỗi ghi kho phụ, không làm hỏng bài',()=>{
  const store=new FakeStore();writeAux(store,'a',{...emptyAux(),active:5});assert.equal(readAux(store,'b',22).active,0);
  store.failSet='quota';assert.equal(writeAux(store,'a',emptyAux()),false);assert.equal(writeAux(null,'a',emptyAux()),false);
});
test('Kho bài đang làm và lịch sử giữ nguyên từng byte sau mọi thao tác kho phụ',()=>{
  const store=new FakeStore(),exam=PRACTICE_EXAMS[0],made=createDraft(exam,'bytes',Date.UTC(2026,9,14));assert.ok(made.ok);
  assert.ok(saveDraft(store,exam,made.value,null).ok);store.setItem('mtm:exam:v1:history','[  "giữ nguyên khoảng trắng" ]');
  const before=new Map([...store.data].filter(([k])=>k.startsWith('mtm:exam:v1:')));
  for(let i=0;i<exam.questions.length;i++)writeAux(store,'bytes',{...emptyAux(),active:i,marked:[i],notes:{[i]:'Nháp riêng'},dark:true,font:1.3});
  readAux(store,'bytes',22);store.setItem(auxKey('bytes'),'hỏng');readAux(store,'bytes',22);
  assert.deepEqual(new Map([...store.data].filter(([k])=>k.startsWith('mtm:exam:v1:'))),before);
  assert.equal(store.getItem(draftKey(exam.id)),before.get(draftKey(exam.id)));assert.ok(readDraft(store,exam).ok);
});
test('Phím tắt ngừng khi nhập ô ngắn/nháp/contenteditable, modifier hoặc IME',()=>{
  for(const key of ['A','B','C','D','ArrowLeft','ArrowRight','M','?']){
    const event={key,ctrlKey:false,metaKey:false,altKey:false,isComposing:false};
    assert.equal(roomShortcut(event,true),null);assert.equal(roomShortcut(event,false),key.toLowerCase());
    for(const modifier of ['ctrlKey','metaKey','altKey','isComposing'])assert.equal(roomShortcut({...event,[modifier]:true},false),null);
  }
  assert.equal(roomShortcut({key:'Enter',ctrlKey:false,metaKey:false,altKey:false,isComposing:false},false),null);
});
test('Cảnh báo đúng ngưỡng 10/5/1 phút, không cảnh báo trước mốc',()=>{
  assert.deepEqual([601,600,301,300,61,60,1,0].map(warningBand),[0,10,10,5,5,1,1,1]);
});
finish();

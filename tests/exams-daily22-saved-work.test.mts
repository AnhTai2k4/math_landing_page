import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {all,mount,text,root} from './daily19-ui-harness.mts';
import {suite} from './exams-harness.mts';
const {test,finish}=suite('D22-SAVED-'),file='src/native/chapters/PracticeSavedWork.tsx';
const history=Array.from({length:5},(_,i)=>({attemptId:'luot-gia-'+i,examId:i%2?'b':'a',title:i%2?'Bài B bản lưu':'Bài A bản lưu',href:'/luyen-tap?nhom=10&chuong=1&luot=luot-gia-'+i,submittedAt:1000+i*1000}));

test('Bài chưa nộp: mới nhất trước, thu gọn/hiện đủ, link và thời hạn giữ nguyên',()=>{
  const items=history.map((h,i)=>({id:h.attemptId,title:h.title,href:h.href.replace('luot=','id='),updatedAt:h.submittedAt,deadline:10000+i})),before=JSON.stringify(items);
  const m=mount(file,{items,incomplete:false},'PracticeResume');try{
    let links=all(m.tree,n=>n.type?.name==='Link');assert.equal(links.length,3);assert.equal(links[0].props.href,items[4].href);
    assert.match(text(m.tree),/Đồng hồ vẫn chạy/);assert.match(text(m.tree),/bài hết giờ/);
    m.click('Xem cả 5 bài chưa nộp');links=all(m.tree,n=>n.type?.name==='Link');assert.equal(links.length,5);
    assert.equal(all(m.tree,n=>n.type==='time').length,10);assert.ok(links.every(n=>n.props.href.includes('&id=')));
    m.click('Thu gọn còn 3 bài');assert.equal(all(m.tree,n=>n.type?.name==='Link').length,3);assert.equal(JSON.stringify(items),before);
  }finally{m.unmount();}
});

test('Đọc lưu lỗi không khẳng định không có bài, không tự mở/nộp hoặc ghi lưu',()=>{
  const m=mount(file,{items:[],incomplete:true},'PracticeResume');try{
    assert.match(text(m.tree),/có thể thiếu bài/);assert.match(text(m.tree),/phần đọc được/);assert.doesNotMatch(text(m.tree),/Chưa có bài chưa nộp/);
    assert.equal(all(m.tree,n=>n.type?.name==='Link').length,0);
  }finally{m.unmount();}
  const code=readFileSync(join(root,file),'utf8');assert.doesNotMatch(code,/localStorage|setItem|removeItem|submitDraft|createDraft|fetch\(/);
});

test('Lịch sử: lọc đúng bài, đổi mới/cũ, giữ nguyên link lượt và dữ liệu, đặt lại',()=>{
  const before=JSON.stringify(history),m=mount(file,{items:history,messages:[],label:'chương'},'PracticeHistory');try{
    let links=all(m.tree,n=>n.type?.name==='Link');assert.equal(links[0].props.href,history[4].href);
    let selects=all(m.tree,n=>n.type==='select');selects[0].props.onChange({target:{value:'b'}});m.draw();
    links=all(m.tree,n=>n.type?.name==='Link');assert.deepEqual(links.map(n=>n.props.href),[history[3].href,history[1].href]);assert.match(text(m.tree),/Hiện 2\/5/);
    selects=all(m.tree,n=>n.type==='select');selects[1].props.onChange({target:{value:'oldest'}});m.draw();
    assert.deepEqual(all(m.tree,n=>n.type?.name==='Link').map(n=>n.props.href),[history[1].href,history[3].href]);
    m.click('Đặt lại bộ lọc lịch sử');assert.equal(all(m.tree,n=>n.type?.name==='Link').length,5);assert.equal(all(m.tree,n=>n.type?.name==='Link')[0].props.href,history[4].href);
    assert.equal(JSON.stringify(history),before);assert.equal(all(m.tree,n=>n.type==='label').length,2);
  }finally{m.unmount();}
});

test('Lịch sử cảnh báo lỗi, trống, filter mất bài và giữ nhãn phiên bản từng dòng',()=>{
  const items=[{...history[0],title:'Bài A phiên bản cũ'},{...history[2],title:'Bài A phiên bản mới'},history[1]],m=mount(file,{items,messages:['Không đọc được nguồn GIẢ.'],label:'chủ đề'},'PracticeHistory');try{
    assert.match(text(m.tree),/Không đọc được nguồn GIẢ/);assert.match(text(m.tree),/Bài A phiên bản cũ/);assert.match(text(m.tree),/Bài A phiên bản mới/);
    all(m.tree,n=>n.type==='select')[0].props.onChange({target:{value:'b'}});m.draw();assert.match(text(m.tree),/Hiện 1\/3/);
    m.draw({items:items.slice(0,2),messages:[],label:'chủ đề'});assert.equal(all(m.tree,n=>n.type==='select')[0].props.value,'');assert.match(text(m.tree),/Hiện 2\/2/);
    m.draw({items:[],messages:[],label:'chủ đề'});assert.match(text(m.tree),/Chưa có bài đã nộp ở đây/);assert.equal(all(m.tree,n=>n.type==='select').length,0);
  }finally{m.unmount();}
});

test('Lịch sử rỗng khi đọc lỗi không khẳng định chưa có lượt nộp',()=>{
  const m=mount(file,{items:[],messages:['Không đọc được lịch sử GIẢ. Bản cũ được giữ nguyên.'],label:'chương'},'PracticeHistory');try{
    assert.match(text(m.tree),/Chưa tìm thấy bài đã nộp trong phần đọc được/);
    assert.doesNotMatch(text(m.tree),/Chưa có bài đã nộp/);
    assert.equal(all(m.tree,n=>n.props.role==='alert').length,1);
    assert.equal(all(m.tree,n=>n.type?.name==='Link').length,0);
    m.draw({items:[],messages:[],label:'chương'});
    assert.match(text(m.tree),/Chưa có bài đã nộp ở đây/);
  }finally{m.unmount();}
});

test('Bài dở và lịch sử HSA/TSA dùng nhãn chủ đề, giữ đúng liên kết',()=>{
  const items=[{id:'bai-gia',title:'Bài chủ đề GIẢ',href:'/luyen-tap?nhom=HSA&chuong=1&id=bai-gia',updatedAt:1000,deadline:10000}];
  const resume=mount(file,{items,incomplete:false,label:'chủ đề'},'PracticeResume');try{
    assert.match(text(resume.tree),/Bài chưa nộp trong chủ đề/);
    assert.doesNotMatch(text(resume.tree),/trong chương/);
    assert.equal(all(resume.tree,n=>n.type?.name==='Link')[0].props.href,items[0].href);
    resume.draw({items:[],incomplete:false,label:'chủ đề'});
    assert.match(text(resume.tree),/Chưa có bài chưa nộp trong chủ đề/);
  }finally{resume.unmount();}
  const saved=mount(file,{items:history,messages:[],label:'chủ đề'},'PracticeHistory');try{
    assert.match(text(saved.tree),/Hiện 5\/5 lượt đã nộp trong chủ đề/);
    assert.doesNotMatch(text(saved.tree),/trong chương/);
  }finally{saved.unmount();}
});
finish({note:'Tương tác hook bằng lượt GIẢ; không đọc bộ nhớ trình duyệt thật hoặc xác nhận ảnh.'});

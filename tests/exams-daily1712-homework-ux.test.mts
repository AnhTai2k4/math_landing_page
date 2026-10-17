import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {all,mount,root,text} from './daily19-ui-harness.mts';
import {suite} from './exams-harness.mts';
const {test,finish}=suite('D1712-WARMUP-UX-'),file='src/native/homework/HomeworkWarmup.tsx';
const choose=(m:any,value:string)=>{all(m.tree,(n:any)=>n.type==='select')[0].props.onChange({target:{value}});m.draw();};
const enter=(m:any,value:string)=>{all(m.tree,(n:any)=>n.type==='input')[0].props.onChange({target:{value}});m.draw();};
const confirmation=(m:any)=>all(m.tree,(n:any)=>n.props?.className==='btvn-warmup-confirmation')[0];

test('Xin xác nhận trước khi đổi; tiếp tục giữ nguyên phần nhập, thẻ và trọng tâm',()=>{
  const m=mount(file);
  try{
    m.click('Bắt đầu 3 thẻ');enter(m,'3');
    const oldInput=all(m.tree,n=>n.type==='input')[0].props.onChange;
    const oldCheck=all(m.tree,n=>n.type==='button'&&text(n)==='Đối chiếu và xem từng bước')[0].props.onClick;
    choose(m,'signs');
    const box=confirmation(m);assert.ok(box);assert.equal(box.props.role,'group');assert.equal(m.focused.type,'div');assert.match(m.focused.text,/Đổi sang Dấu và phép biến đổi/);
    assert.equal(all(m.tree,n=>n.type==='select')[0].props.value,'conditions');
    assert.equal(all(m.tree,n=>n.type==='input')[0].props.value,'3');assert.equal(all(m.tree,n=>n.type==='input')[0].props.disabled,true);
    assert.match(text(box),/xóa lượt thẻ hiện tại, gồm cả phần đang nhập/);
    oldInput({target:{value:'100'}});oldCheck();m.draw();
    assert.equal(all(m.tree,n=>n.type==='input')[0].props.value,'3');assert.equal(all(m.tree,n=>n.props?.className==='btvn-warmup-solution').length,0);
    m.click('Tiếp tục lượt thẻ hiện tại');assert.equal(confirmation(m),undefined);assert.equal(m.focused.type,'input');
    assert.equal(all(m.tree,n=>n.type==='input')[0].props.value,'3');assert.equal(all(m.tree,n=>n.type==='input')[0].props.disabled,false);
    m.click('Đối chiếu và xem từng bước');assert.match(text(m.tree),/Kết quả khớp/);assert.match(text(m.tree),/Thẻ 1\/3/);
  }finally{m.unmount();}
});

test('Chỉ xóa khi chấp nhận, trả focus đúng; callback cũ không xóa hoặc thay nội dung lượt mới',()=>{
  const m=mount(file);
  try{
    m.click('Bắt đầu 3 thẻ');enter(m,'17');const oldInput=all(m.tree,n=>n.type==='input')[0].props.onChange;
    choose(m,'signs');const oldAccept=all(m.tree,n=>n.type==='button'&&text(n)==='Đổi trọng tâm và xóa lượt thẻ')[0].props.onClick;
    const oldKeep=all(m.tree,n=>n.type==='button'&&text(n)==='Tiếp tục lượt thẻ hiện tại')[0].props.onClick;
    m.click('Đổi trọng tâm và xóa lượt thẻ');assert.equal(all(m.tree,n=>n.type==='article').length,0);assert.equal(m.focused.type,'select');assert.equal(all(m.tree,n=>n.type==='select')[0].props.value,'signs');
    m.click('Bắt đầu 3 thẻ');enter(m,'11');oldInput({target:{value:'100'}});m.draw();assert.equal(all(m.tree,n=>n.type==='input')[0].props.value,'11');assert.match(text(m.tree),/3 − 2\(x − 4\)/);
    choose(m,'conditions');oldAccept();oldKeep();m.draw();assert.ok(confirmation(m));assert.equal(all(m.tree,n=>n.type==='select')[0].props.value,'signs');
    m.click('Tiếp tục lượt thẻ hiện tại');assert.equal(all(m.tree,n=>n.type==='input')[0].props.value,'11');
    choose(m,'conditions');m.click('Đổi trọng tâm và xóa lượt thẻ');m.click('Bắt đầu 3 thẻ');assert.equal(all(m.tree,n=>n.type==='input')[0].props.value,'');assert.match(text(m.tree),/x − 3/);
  }finally{m.unmount();}
});

test('Escape giữ lời giải và tiến độ; không cho callback chuyển thẻ chạy khi còn chờ xác nhận',()=>{
  const m=mount(file);
  try{
    m.click('Bắt đầu 3 thẻ');enter(m,'3');m.click('Đối chiếu và xem từng bước');m.click('Sang thẻ tiếp');
    enter(m,'-4');m.click('Đối chiếu và xem từng bước');const oldNext=all(m.tree,n=>n.type==='button'&&text(n)==='Sang thẻ tiếp')[0].props.onClick;
    choose(m,'solutions');oldNext();m.draw();assert.match(text(m.tree),/Thẻ 2\/3/);assert.equal(all(m.tree,n=>n.type==='button'&&text(n)==='Sang thẻ tiếp')[0].props.disabled,true);
    let prevented=0;confirmation(m).props.onKeyDown({key:'Escape',preventDefault(){prevented++;}});m.draw();
    assert.equal(prevented,1);assert.equal(confirmation(m),undefined);assert.equal(m.focused.type,'div');assert.match(m.focused.text,/Kết quả khớp/);assert.match(text(m.tree),/Em đã nhập: -4/);
    m.click('Sang thẻ tiếp');assert.match(text(m.tree),/Thẻ 3\/3/);enter(m,'3');m.click('Đối chiếu và xem từng bước');m.click('Xem tổng kết thẻ');assert.match(text(m.tree),/Khớp đáp án từ lần nhập: 3\/3/);
    choose(m,'solutions');assert.equal(confirmation(m),undefined);assert.equal(all(m.tree,n=>n.type==='article').length,0);assert.equal(all(m.tree,n=>n.type==='select')[0].props.value,'solutions');m.click('Bắt đầu 3 thẻ');assert.match(text(m.tree),/\(x − 2\)\(x \+ 3\)/);
  }finally{m.unmount();}
});

test('Giữ v1, lời nhắc và xác nhận truy cập bằng bàn phím, CSS chỉ áp dụng tiện ích, không mạng/storage',()=>{
  const m=mount(file);try{
    assert.equal(all(m.tree,n=>n.props?.className==='btvn-warmup')[0].props['data-version'],'v1');m.click('Bắt đầu 3 thẻ');
    choose(m,'khong-co');choose(m,'conditions');assert.equal(confirmation(m),undefined);
    choose(m,'signs');const box=confirmation(m);assert.equal(box.props.tabIndex,-1);
    for(const key of ['aria-labelledby','aria-describedby'])assert.equal(all(box,n=>n.props?.id===box.props[key]).length,1);
    assert.equal(all(box,n=>n.type==='button').length,2);assert.match(text(m.tree),/nhấn Escape/);
  }finally{m.unmount();}
  const code=readFileSync(join(root,file),'utf8');assert.doesNotMatch(code,/window\.confirm|fetch\(|localStorage|sessionStorage|\u2014/);
  const css=readFileSync(join(root,'src/native/homework/warmup.css'),'utf8');assert.match(css,/btvn-warmup-confirmation/);assert.match(css,/:focus-visible/);assert.doesNotMatch(css,/\.mig-home|body\s*\{|:root\s*\{/);
});
finish({note:'4 nhóm hành vi: giữ phần nhập, xác nhận xóa, Escape/focus, khóa và callback cũ; hook harness chưa thay QA trình duyệt.'});

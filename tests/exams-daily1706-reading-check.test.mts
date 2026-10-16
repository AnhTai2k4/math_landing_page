import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {all,load,mount,React,require,root,text} from './daily19-ui-harness.mts';
import {suite} from './exams-harness.mts';
const {test,finish}=suite('D1706-READ-'),file='src/native/ReadingSelfCheck.tsx';
const fields=(m:any)=>all(m.tree,n=>n.type==='textarea');
function fill(m:any,values=['Điều kiện x khác 0','Thay giá trị rồi kiểm điều kiện','Chưa có']){
  values.forEach((value,index)=>{fields(m)[index].props.onChange({target:{value}});m.draw();});
}
function submit(m:any){all(m.tree,n=>n.type==='form')[0].props.onSubmit({preventDefault(){}});m.draw();}
const choices=(m:any)=>all(m.tree,n=>n.type==='select');
function rate(m:any,index:number,value:string){choices(m)[index].props.onChange({target:{value}});m.draw();}

test('Phiếu trống hoặc chỉ có khoảng trắng không chuyển bước, điền đủ mới đối chiếu',()=>{
  const m=mount(file);try{
    assert.equal(fields(m).length,3);assert.equal(choices(m).length,0);submit(m);
    assert.equal(all(m.tree,n=>n.props?.role==='alert').length,1);assert.equal(m.focused.type,'textarea');
    fill(m,['  ','Ví dụ giả','Chưa có']);submit(m);assert.equal(choices(m).length,0);
    fields(m)[0].props.onChange({target:{value:'Điều kiện giả để thử'}});m.draw();submit(m);
    assert.equal(choices(m).length,3);assert.equal(fields(m).length,0);assert.equal(m.focused.type,'div');
    assert.ok(choices(m).every(n=>n.props.value===''));assert.match(text(m.tree),/tự đánh giá 0\/3/);
    const region=all(m.tree,n=>n.props?.role==='region')[0];assert.equal(all(m.tree,n=>n.props?.id===region.props['aria-labelledby']).length,1);
  }finally{m.unmount();}
});

test('Thiếu mục nào thì focus mục trống đầu tiên, nối đúng lỗi và nhập lại bỏ báo lỗi',()=>{
  for(const values of [
    ['Điều kiện giả','', 'Chưa có'],
    ['Điều kiện giả','Ví dụ giả','  '],
    ['Điều kiện giả',' ',''],
    ['',' ','Chưa có'],
  ]){
    const m=mount(file);try{
      fill(m,values);submit(m);
      const missing=values.findIndex(value=>!value.trim()),error=all(m.tree,n=>n.props?.role==='alert')[0];
      assert.equal(m.focused.id,fields(m)[missing].props.id);assert.ok(error.props.id);
      for(const [index,field] of fields(m).entries()){
        assert.equal(field.props['aria-invalid'],!values[index].trim());
        const descriptions=field.props['aria-describedby'].split(' ');
        assert.equal(descriptions.includes(error.props.id),!values[index].trim());
        for(const id of descriptions)assert.equal(all(m.tree,n=>n.props?.id===id).length,1);
      }
      submit(m);assert.equal(m.focused.id,fields(m)[missing].props.id);
      fields(m)[missing].props.onChange({target:{value:'Ghi chú giả đã bổ sung'}});m.draw();
      assert.equal(all(m.tree,n=>n.props?.role==='alert').length,0);
      assert.ok(fields(m).every(field=>field.props['aria-invalid']===false));
      assert.ok(fields(m).every(field=>!field.props['aria-describedby'].includes(error.props.id)));
      const nextMissing=fields(m).findIndex(field=>!field.props.value.trim());
      submit(m);
      if(nextMissing!==-1)assert.equal(m.focused.id,fields(m)[nextMissing].props.id);
      else{assert.equal(choices(m).length,3);assert.equal(m.focused.type,'div');}
    }finally{m.unmount();}
  }
});

test('Ba tự đánh giá có kết quả rõ, sửa giữ nội dung và đổi ghi chú xóa đánh giá cũ',()=>{
  const m=mount(file);try{
    fill(m);submit(m);rate(m,0,'sure');rate(m,1,'review');rate(m,2,'sure');assert.match(text(m.tree),/1 mục cần đọc lại/);
    rate(m,1,'sure');assert.match(text(m.tree),/Em tự đánh dấu cả ba mục/);assert.doesNotMatch(text(m.tree),/100%|đạt điểm|3 câu đúng/);
    m.click('Sửa điều vừa nhớ');assert.equal(m.focused.id,fields(m)[0].props.id);assert.equal(fields(m)[2].props.value,'Chưa có');submit(m);
    assert.ok(choices(m).every(n=>n.props.value==='sure'));
    m.click('Sửa điều vừa nhớ');fields(m)[1].props.onChange({target:{value:'Ví dụ đã sửa'}});m.draw();submit(m);
    assert.ok(choices(m).every(n=>n.props.value===''));assert.match(text(m.tree),/Ví dụ đã sửa/);
  }finally{m.unmount();}
});

test('Lượt mới cần xác nhận, hủy giữ nguyên nội dung và đánh giá, xác nhận trả phiếu trắng',()=>{
  const m=mount(file);try{
    fill(m);submit(m);rate(m,1,'review');m.click('Lượt tự kiểm mới');
    assert.equal(all(m.tree,n=>n.props?.role==='group').length,1);assert.match(text(m.tree),/Điều kiện x khác 0/);assert.equal(m.focused.text,'Xác nhận lượt mới');
    m.click('Giữ phiếu hiện tại');assert.equal(choices(m)[1].props.value,'review');assert.match(text(m.tree),/Điều kiện x khác 0/);assert.equal(m.focused.text,'Lượt tự kiểm mới');
    m.click('Lượt tự kiểm mới');m.click('Xác nhận lượt mới');assert.equal(choices(m).length,0);assert.ok(fields(m).every(n=>n.props.value===''));assert.equal(m.focused.id,fields(m)[0].props.id);
    assert.equal(all(m.tree,n=>n.props?.role==='group').length,0);submit(m);assert.equal(choices(m).length,0);
  }finally{m.unmount();}
});

test('Giới hạn độ dài, escape nội dung, nhãn nối đúng và remount không giữ phiếu cũ',()=>{
  const m=mount(file);try{
    fill(m,['<script>alert(1)</script>','a'.repeat(1300),'Chưa có']);assert.equal(fields(m)[1].props.value.length,1200);
    assert.ok(fields(m).every(n=>n.props.maxLength===1200));
    for(const field of fields(m))assert.equal(all(m.tree,n=>n.type==='label'&&n.props.htmlFor===field.props.id).length,1);
    submit(m);for(const choice of choices(m))assert.equal(all(m.tree,n=>n.type==='label'&&n.props.htmlFor===choice.props.id).length,1);
    const html=require('react-dom/server').renderToStaticMarkup(m.tree);assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>/);
  }finally{m.unmount();}
  const fresh=mount(file);try{assert.ok(fields(fresh).every(n=>n.props.value===''));}finally{fresh.unmount();}
});

test('Tích hợp PDF Tài liệu, tải lười sau mở và ranh lỗi không làm mất trình đọc',()=>{
  const code=readFileSync(join(root,'src/native/NativeResources.tsx'),'utf8');
  assert.match(code,/ReadingSelfCheck=lazy\(\(\)=>import\('\.\/ReadingSelfCheck'\)\)/);
  assert.match(code,/!exam&&<ReadingCheckTool key=\{pdfFile\.id\}/);
  assert.match(code,/pdfFile=\!exam&&detail/);
  const m=mount('src/native/NativeResources.tsx',{},'ReadingCheckTool','export {ReadingCheckTool};');try{
    assert.equal(all(m.tree,n=>n.type===React.Suspense).length,0);
    const details=all(m.tree,n=>n.type==='details')[0];details.props.onToggle({currentTarget:{open:false}});m.draw();assert.equal(all(m.tree,n=>n.type===React.Suspense).length,0);
    details.props.onToggle({currentTarget:{open:true}});m.draw();assert.equal(all(m.tree,n=>n.type===React.Suspense).length,1);
    assert.match(text(m.tree),/Tự kiểm sau khi đọc/);
  }finally{m.unmount();}
  const Boundary=load('src/native/NativeResources.tsx',undefined,'export {ReadingCheckBoundary};').ReadingCheckBoundary;
  const boundary=new Boundary({children:'Nội dung giả'});assert.equal(boundary.render(),'Nội dung giả');boundary.state=Boundary.getDerivedStateFromError();assert.match(text(boundary.render()),/vẫn có thể đọc PDF/);
});

test('SSR, CSS scoped và không storage, timer, mạng, dependency hoặc em dash',()=>{
  const html=require('react-dom/server').renderToStaticMarkup(React.createElement(load(file).default));assert.match(html,/không lưu hoặc gửi đi/);assert.match(html,/Chưa có/);assert.equal((html.match(/<textarea/g)||[]).length,3);
  const code=readFileSync(join(root,file),'utf8');assert.doesNotMatch(code,/fetch\(|localStorage|sessionStorage|setInterval|setTimeout|dangerouslySetInnerHTML|\u2014/);
  const css=readFileSync(join(root,'src/native/reading-self-check.css'),'utf8');assert.match(css,/min-height:44px/);assert.match(css,/:focus-visible/);assert.match(css,/#213269/);assert.match(css,/#FFCF24/);assert.match(css,/overflow-wrap:anywhere/);
  const postcss=require('postcss'),parsed=postcss.parse(css);parsed.walkRules((rule:any)=>assert.ok(rule.selector.startsWith('.native-ui .reading-self-check')));
  const toolCss=readFileSync(join(root,'src/native/reading-check-tool.css'),'utf8');assert.match(toolCss,/min-height:44px/);assert.match(toolCss,/:focus-visible/);
});

test('Dựng NativeResources thật: chỉ chi tiết tài liệu có PDF mới hiện tiện ích',()=>{
  const previous=Object.getOwnPropertyDescriptor(globalThis,'location');Object.defineProperty(globalThis,'location',{configurable:true,value:{hash:''}});
  const id=JSON.parse(readFileSync(join(root,'src/native/reader-files.json'),'utf8')).files[0].id;
  const cases=[
    {kind:'documents',pathname:'/tai-lieu',show:0},
    {kind:'documents',pathname:'/tai-lieu/fixture-not-found',show:0},
    {kind:'exams',pathname:'/thi-thu',show:0},
    {kind:'documents',pathname:'/tai-lieu/'+id,show:1},
    {kind:'documents',pathname:'/tai-lieu/'+id,show:0,extra:'readerFiles.files=[];'},
  ];
  try{for(const c of cases){
    const m=mount('src/native/NativeResources.tsx',{kind:c.kind,pathname:c.pathname,search:''},'default',c.extra??'');try{
      const tools=all(m.tree,n=>n.type?.name==='ReadingCheckTool');assert.equal(tools.length,c.show,c.pathname);if(c.show)assert.equal(tools[0].key,id);
    }finally{m.unmount();}
  }}finally{if(previous)Object.defineProperty(globalThis,'location',previous);else delete (globalThis as any).location;}
});
finish({note:'8 nhóm kiểm dùng ghi chú giả, hook/SSR và metadata PDF công khai; không thay QA trực quan trình duyệt.'});

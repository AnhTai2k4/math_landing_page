// Chrome thật, chỉ dữ liệu demo local. Không gọi cloud, không đổi đề hoặc chấm điểm máy chủ.
// node scripts/check-btvn-mobile.mjs --phase before|after [--width 360 | --widths 390,1366,1920] [--keep-server]
import {createServer} from 'vite';
import {spawn} from 'node:child_process';
import {mkdirSync,writeFileSync,existsSync,readFileSync,realpathSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';

const args=process.argv.slice(2),phase=args.includes('--phase')?args[args.indexOf('--phase')+1]:'after';
if(!['before','after'].includes(phase))throw Error('Dùng --phase before hoặc --phase after.');
const output=resolve('.qa-temp/ho-so'),images=join(output,'anh',phase);mkdirSync(images,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const chromePath=process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe';
if(!existsSync(chromePath))throw Error('Chưa tìm thấy Chrome thật.');
// Ba trang tổng hợp tự tạo để phân biệt trang mặc định với trang đúng của câu.
// Đây là dữ liệu kiểm UI, không phải đề hoặc bản chép nội dung của học sinh.
function makePdf(){
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [4 0 R 6 0 R 8 0 R] /Count 3 >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
 for(let page=1;page<=3;page++){
  const stream=`BT /F1 22 Tf 45 780 Td (MTM - SYNTHETIC UI QA - PAGE ${page}) Tj 0 -45 Td /F1 16 Tf (${page===3?'TARGET PAGE FOR THE CURRENT QUESTION':'OTHER PAGE - DO NOT DEFAULT HERE'}) Tj 0 -40 Td (Three-page fixture. UI verification only.) Tj ET`;
  objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5+(page-1)*2} 0 R >>`,`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);
 }
 let body='%PDF-1.4\n',offsets=[0];for(const [i,obj] of objects.entries()){offsets.push(Buffer.byteLength(body));body+=`${i+1} 0 obj\n${obj}\nendobj\n`;}const xref=Buffer.byteLength(body);body+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;return Buffer.from(body);
}
const pdf=makePdf(),sha=createHash('sha256').update(pdf).digest('hex'),pdfPath='/qa-exam-assets/'+sha+'.pdf';writeFileSync(join(output,'de-tong-hop-qa.pdf'),pdf);
process.env.MTM_BTVN_DEMO='1';process.env.MTM_R106_PREVIEW='1';process.env.MTM_BTVN_CSV=join(output,`ket-qua-demo-${phase}.csv`);
let server,chrome,ws;const report={phase,at:new Date().toISOString(),browser:'Chrome headless thật qua CDP',syntheticOnly:true,localOnly:true,pdfFixture:{url:pdfPath,sha256:sha,bytes:pdf.length,totalPages:3,targetPage:3,questionGroups:[3,1,16,6,9],note:'PDF và 35 câu tổng hợp chỉ để kiểm UI trong response phía client; không thay đổi đề gốc trên máy chủ.'},shots:[],checks:[],errors:[]};
try{
 report.baselineCommit=existsSync(join(output,'baseline-src','HEAD.txt'))?readFileSync(join(output,'baseline-src','HEAD.txt'),'utf8').trim():null;
 server=await createServer({cacheDir:join(output,'vite-cache'),server:{host:'127.0.0.1',port:5247,strictPort:true,open:false,watch:{ignored:['**/.qa-temp/**','**/.qa-build/**','**/build/**','**/dist/**']},fs:{allow:[resolve('.'),realpathSync(resolve('node_modules'))]}},plugins:[{name:'ho-so-original-source',enforce:'pre',transform(code,id){if(phase!=='before')return;const path=id.split('?')[0].replaceAll('\\','/'),root=resolve('.').replaceAll('\\','/');if(path.startsWith(root+'/src/')){const original=join(output,'baseline-src',path.slice(root.length+1));if(existsSync(original))return {code:readFileSync(original,'utf8'),map:null};}}},{name:'ho-so-pdf-fixture',resolveId(id){if(id==='/qa-ho-so-fixture.mjs')return '\0qa-ho-so-fixture';},load(id){if(id==='\0qa-ho-so-fixture')return `import React from 'react';import{createRoot}from'react-dom/client';import MathText from '/src/native/math/MathText.tsx';import authored from '/src/native/math/mathtype-authored.json';import FitTable from '/src/native/exams/FitTable.tsx';export function mount(node){const formula='$'+Array.from({length:35},(_,i)=>'x_{'+i+'}').join('+')+'=1$';const mathml=authored.filter(x=>!x.latex.includes('begin')).sort((a,b)=>b.mathml.replace(/<[^>]*>/g,'').length-a.mathml.replace(/<[^>]*>/g,'').length)[0];const root=createRoot(node);root.render(React.createElement(React.Fragment,null,React.createElement('p',null,'Dữ liệu tổng hợp kiểm giao diện, không phải đề thật.'),React.createElement('p',{'data-qa-formula':'katex'},'KaTeX dài: ',React.createElement(MathText,{text:formula})),React.createElement('p',{'data-qa-formula':'authored'},'MathML từ kho biên tập: ',React.createElement(MathText,{text:'$'+mathml.latex+'$'})),React.createElement(FitTable,{table:{headers:Array.from({length:10},(_,i)=>'Cột '+(i+1)),rows:[Array.from({length:10},()=> '1234567890')],caption:'Bảng tổng hợp kiểm cuộn trong khung'},renderCell:t=>React.createElement(MathText,{text:t})})));return()=>root.unmount();}`;},configureServer(s){s.middlewares.use((req,res,next)=>{if(req.url===pdfPath){res.writeHead(200,{'Content-Type':'application/pdf','Content-Length':String(pdf.length)});res.end(pdf);}else next();});}}]});await server.listen();
 const base='http://127.0.0.1:5247';report.base=base;
 const port=9437;chrome=spawn(chromePath,['--headless=new','--no-sandbox','--disable-gpu','--disable-extensions','--hide-scrollbars','--remote-debugging-address=127.0.0.1',`--remote-debugging-port=${port}`,`--user-data-dir=${join(process.env.TEMP||output,'mtm-ho-so-chrome-'+phase)}`,'about:blank'],{stdio:'ignore',windowsHide:true});
 let target;for(let i=0;i<70;i++){try{target=(await(await fetch(`http://127.0.0.1:${port}/json`)).json()).find(t=>t.type==='page');if(target)break;}catch{}await sleep(150);}if(!target)throw Error('Không kết nối được Chrome.');
 ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r));let id=0;const pending=new Map();ws.addEventListener('message',e=>{const d=JSON.parse(e.data);if(d.id){const p=pending.get(d.id);if(p){pending.delete(d.id);d.error?p.reject(Error(JSON.stringify(d.error))):p.resolve(d.result);}}});
 const send=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));});
 const evaluate=async(code)=>{const r=await send('Runtime.evaluate',{expression:`(async()=>{${code}})()`,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||JSON.stringify(r.exceptionDetails));return r.result?.value;};
 const waitFor=async(code,description)=>{for(let i=0;i<100;i++){if(await evaluate(`return !!(${code})`))return;await sleep(150);}report.diagnostic=await evaluate(`return {description:${JSON.stringify(description)},body:document.body.innerText,buttons:[...document.querySelectorAll('button')].map(e=>({text:e.textContent,disabled:e.disabled}))}`);const screen=await send('Page.captureScreenshot',{format:'png'});writeFileSync(join(output,'diagnostic-'+phase+'.png'),Buffer.from(screen.data,'base64'));throw Error('Chờ quá hạn: '+description);};
 const click=async(selector)=>evaluate(`const b=document.querySelector(${JSON.stringify(selector)});if(!b)throw Error('Thiếu '+${JSON.stringify(selector)});b.click();return b.textContent;`);
 await send('Page.enable');await send('Runtime.enable');await send('Network.enable');
 await send('Emulation.setFocusEmulationEnabled',{enabled:true});
 // Chỉ sửa response trong trình duyệt. Khóa gửi save/submit khi đang xem fixture.
 await send('Page.addScriptToEvaluateOnNewDocument',{source:`(()=>{const original=window.fetch;window.fetch=async(...args)=>{const fixture=location.search.includes('qa-pdf=1'),api=String(args[0]).endsWith('/api/btvn');if(fixture&&api&&args[1]?.body&&['save','submit'].includes(JSON.parse(args[1].body).action))throw Error('Không gửi bài tổng hợp QA lên máy chủ demo');const response=await original(...args);if(fixture&&api&&response.ok){const data=await response.clone().json();if(data.exam){const e=data.exam,byKind=kind=>e.questions.find(q=>q.kind===kind),parts=[{label:'Bài tập tự luận',kind:'self',count:3},{label:'Ví dụ',kind:'self',count:1},{label:'Phần I · Trắc nghiệm',kind:'mc',count:16},{label:'Phần II · Đúng / Sai',kind:'tf',count:6},{label:'Phần III · Trả lời ngắn',kind:'short',count:9}];let n=0;e.questions=parts.flatMap(part=>Array.from({length:part.count},()=>{const q=structuredClone(byKind(part.kind)||byKind('mc'));q.id='mtm-qa-ui-'+(++n);q.kind=part.kind;q.sourcePdfPage=3;q.sourceRef='Dữ liệu tổng hợp kiểm giao diện, câu '+n+', trang 3';if(q.sourceContent)q.sourceContent.questions=q.sourceContent.questions.map(segment=>({...segment,sourcePage:1}));if(q.kind==='self'){q.maxMillipoints=0;delete q.answer;delete q.choices;delete q.acceptedAnswers;}if(n===34)delete q.sourcePdfPage;if(n===35)q.sourcePdfPage=99;return q;}));e.id='mtm-custom-qa-room-35';if(data.draft){data.draft.examId=e.id;data.draft.rubricVersion='MTM-BTVN-10-v1';}e.sections=parts;e.questionCount=e.questions.length;e.rubricVersion='MTM-BTVN-10-v1';e.title='KIỂM GIAO DIỆN · 35 câu tổng hợp, không phải đề thật';e.sourcePdf=${JSON.stringify({url:pdfPath,verified:true,sha256:sha,bytes:pdf.length,totalPages:3,questionPages:[1,2,3]})};const headers=new Headers(response.headers);headers.delete('content-length');return new Response(JSON.stringify(data),{status:response.status,headers});}}return response;};})();`});
 function measureInBrowser(){
  const scope=document.querySelector('[role="alertdialog"]')||document.querySelector('dialog[open]')||document.querySelector('.fr-sheet.is-open')||document.querySelector('.fr-room')||document.querySelector('.btvn-session')||document.body;
  const label=e=>e.tagName.toLowerCase()+'.'+String(e.className?.baseVal??e.className??'').replace(/\s+/g,'.').slice(0,110);
  const bounds=e=>{if(!e)return null;const r=e.getBoundingClientRect();return {left:+r.left.toFixed(1),right:+r.right.toFixed(1),top:+r.top.toFixed(1),bottom:+r.bottom.toFixed(1),width:+r.width.toFixed(1),height:+r.height.toFixed(1)};};
  const rendered=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none'&&!e.closest('[inert],.katex-mathml,.fr-sr-only,.sr-only,[hidden]')&&!(s.position==='absolute'&&(s.clip!=='auto'||s.clipPath!=='none'));};
  // Chỉ bỏ qua phần trong khung cuộn chủ đích; overflow:hidden của trang không được coi là đã sửa tràn.
  const scrollParent=e=>{for(let p=e.parentElement;p&&p!==document.body;p=p.parentElement){const s=getComputedStyle(p);if(/auto|scroll/.test(s.overflowX)&&p.clientWidth+1<p.scrollWidth)return p;}return null;};
  const horizontallyReachable=e=>{const r=e.getBoundingClientRect();for(let p=e.parentElement;p&&p!==document.body;p=p.parentElement){const s=getComputedStyle(p),b=p.getBoundingClientRect();if(/auto|scroll|hidden|clip/.test(s.overflowX)&&(r.right<=b.left||r.left>=b.right))return false;}return true;};
  const elements=[...scope.querySelectorAll('*')].filter(rendered);
  const outside=elements.filter(e=>{const r=e.getBoundingClientRect();return(r.left<-.75||r.right>innerWidth+.75)&&!scrollParent(e)&&!e.matches('.fr-scrim');}).slice(0,35).map(e=>({element:label(e),...bounds(e),width:e.clientWidth,scrollWidth:e.scrollWidth,text:e.textContent?.trim().slice(0,75)}));
  const controls=elements.filter(e=>e.matches('button,input,select,textarea,summary,a.btvn-btn,a.btvn-home-link')&&!e.matches('.fr-scrim')&&horizontallyReachable(e)).map(e=>{const nativeChoice=e.matches('input[type=radio],input[type=checkbox]'),associated=nativeChoice?[...(e.labels??[])].filter(rendered).sort((a,b)=>b.getBoundingClientRect().width*b.getBoundingClientRect().height-a.getBoundingClientRect().width*a.getBoundingClientRect().height)[0]:null,target=associated||e;return {element:label(e),hitTarget:label(target),text:(e.getAttribute('aria-label')||target.textContent||'').trim().slice(0,70),...bounds(target),font:parseFloat(getComputedStyle(target).fontSize)};});
  const images=elements.filter(e=>e.matches('img,canvas')).map(e=>({element:label(e),...bounds(e),parentWidth:e.parentElement.clientWidth,naturalWidth:e.naturalWidth||e.width,insideHorizontalScroller:!!scrollParent(e),zoomDialog:!!e.closest('.ep-zoom-dialog'),questionAsset:!!e.closest('.fr-paper .mtm-source-content,.fr-paper .ep-question-pdf')}));
  const localScrollers=elements.filter(e=>e.matches('.mtm-formula,.ep-table-wrap,.ep-formula-line,.ep-question-pdf,.fr-sheet:not(.is-open)')).map(e=>{const before=e.scrollLeft;e.scrollLeft=100000;const moved=e.scrollLeft>0;e.scrollLeft=before;const s=getComputedStyle(e);return {element:label(e),...bounds(e),clientWidth:e.clientWidth,scrollWidth:e.scrollWidth,overflowX:s.overflowX,hasOverflow:e.scrollWidth>e.clientWidth+1,canScrollX:moved,authored:e.classList.contains('mtm-math-authored'),tableVertical:e.classList.contains('ep-table-vertical')};});
  const contentGutter=(e,name)=>{if(!e||!rendered(e))return null;const r=e.getBoundingClientRect(),s=getComputedStyle(e),left=r.left+parseFloat(s.paddingLeft),right=innerWidth-r.right+parseFloat(s.paddingRight),minimum=innerWidth<760?16:24;return {name,element:label(e),left:+left.toFixed(1),right:+right.toFixed(1),minimum,passes:left>=minimum-.75&&right>=minimum-.75};};
  const room=document.querySelector('.fr-room'),preparation=!room&&document.querySelector('.ep-attempt'),paper=room?.querySelector('.fr-paper'),workspace=room?.querySelector('.fr-workspace'),dock=room?.querySelector('.fr-answer-dock'),input=room?.querySelector('#fr-quick-short');
  const sheet=room?.querySelector('.fr-sheet'),top=room?.querySelector('.fr-top'),paperBounds=bounds(paper),sheetBounds=sheet&&rendered(sheet)?bounds(sheet):null;
  const desktopLayout=room&&innerWidth>=1024&&paperBounds&&sheetBounds?{sheet:sheetBounds,top:bounds(top),sheetOnRight:sheetBounds.left>=paperBounds.right-1,groupCenterOffset:+Math.abs((Math.min(paperBounds.left,sheetBounds.left)+Math.max(paperBounds.right,sheetBounds.right))/2-innerWidth/2).toFixed(1),topCenterOffset:top?+Math.abs((top.getBoundingClientRect().left+top.getBoundingClientRect().right)/2-innerWidth/2).toFixed(1):null}:null;
  const questionNumbers=[...room?.querySelectorAll('.fr-grid button')??[]].map(e=>Number(e.textContent.match(/^\s*(\d+)/)?.[1]));
  const sourceViewer={inlineCanvas:room?.querySelectorAll('.fr-paper .ep-question-pdf canvas').length??0,dialogOpen:!!document.querySelector('.fr-source-dialog[open]'),dialogPage:document.querySelector('.fr-source-dialog[open] canvas')?.getAttribute('data-question-page')??null,button:room?.querySelector('.fr-source-open')?.textContent??null};
  const gutters=[contentGutter(preparation,'chuẩn bị'),contentGutter(paper,'nội dung phòng')].filter(Boolean);
  const dockBounds=dock&&rendered(dock)?bounds(dock):null,workspaceBounds=bounds(workspace),inputBounds=input&&rendered(input)?bounds(input):null;
  const keyboardInput=inputBounds&&{...inputBounds,font:getComputedStyle(input).fontSize,active:input===document.activeElement,focusMatches:input.matches(':focus'),documentHasFocus:document.hasFocus(),viewportScale:visualViewport?.scale,roomViewportHeight:room?.style.getPropertyValue('--btvn-viewport-height'),visible:inputBounds.top>=Math.max(0,workspaceBounds?.top??0)-1&&inputBounds.bottom<=Math.min(visualViewport?.height??innerHeight,dockBounds?.top??Infinity,workspaceBounds?.bottom??Infinity)+1};
  const dockOverlap=!!dockBounds&&!!workspaceBounds&&dockBounds.top<workspaceBounds.bottom-.75;
  const formulaPresence={katex:!!scope.querySelector('[data-qa-formula="katex"] .katex-html'),authoredMathml:!!scope.querySelector('[data-qa-formula="authored"] .mtm-math-authored math'),fitTable:!!scope.querySelector('.qa-stress .ep-table-wrap')};
  return {viewport:{width:innerWidth,height:innerHeight,visualHeight:visualViewport?.height},rootWidth:document.documentElement.clientWidth,rootScrollWidth:document.documentElement.scrollWidth,bodyScrollWidth:document.body.scrollWidth,scope:label(scope),scopeWidth:scope.clientWidth,scopeScrollWidth:scope.scrollWidth,overflowX:document.documentElement.scrollWidth>innerWidth+1||scope.scrollWidth>scope.clientWidth+1,outside,smallControls:controls.filter(c=>c.width<43.5||c.height<43.5),smallControlFonts:controls.filter(c=>c.font<15.99),images,localScrollers,gutters,formulaPresence,desktopLayout,questionNumbers,sourceViewer,dock:dockBounds&&{...dockBounds,overlapsReadingArea:dockOverlap},workspace:workspaceBounds,paper:paper&&{...bounds(paper),height:paper.clientHeight,scrollHeight:paper.scrollHeight,paddingBottom:getComputedStyle(paper).paddingBottom},input:keyboardInput,alerts:[...scope.querySelectorAll('[role=alert]')].map(e=>e.textContent)};
 }
 const measure=()=>evaluate(`return (${measureInBrowser.toString()})()`);
 const check=async(name,expression,note)=>{const actual=await evaluate(expression);report.checks.push({width:current.width,name,passes:!!actual,note});persistReport();if(phase==='after'&&!actual)throw Error(name+': '+note);};
 let current;
 const persistReport=()=>writeFileSync(join(output,`bao-cao-${phase}.json`),JSON.stringify(report,null,2)+'\n');
 async function capture(name,note=''){
  await sleep(220);const metrics=await measure(),file=`${current.width}-${name}.png`,shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
  writeFileSync(join(images,file),Buffer.from(shot.data,'base64'));report.shots.push({name,viewport:{...current},file:'anh/'+phase+'/'+file,note,metrics});
  console.log(`${phase} ${current.width} ${name}: ngang=${metrics.overflowX}, ngoài=${metrics.outside.length}`);persistReport();
 }
 const gotoQ=async(part,index)=>{
  const changed=await evaluate(`const b=document.querySelectorAll('.fr-grid')[${part}]?.querySelectorAll('button')[${index}];if(!b)return false;b.click();return true;`);
  if(!changed)throw Error(`Không tìm thấy câu phần ${part+1}, số ${index+1}`);await sleep(180);
  await waitFor(`![...document.querySelectorAll('.fr-paper .mtm-source-content img')].some(i=>!i.complete||!i.naturalWidth)`,'ảnh câu hỏi hiển thị');
 };
 async function login(code){
  await evaluate(`const i=document.querySelector('input[type=password]');const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(i,${JSON.stringify(code)});i.dispatchEvent(new Event('input',{bubbles:true}));`);
  await sleep(90);await evaluate(`document.querySelector('.btvn-gate').requestSubmit()`);
  await waitFor(`document.querySelector('.r104-hw-today')||document.querySelector('.r104-hw-dashboard')||document.querySelector('.btvn-me')`,'đăng nhập demo');
 }
 async function openOverview(){
  await evaluate(`const d=document.querySelector('#r104-lesson-list');if(d)d.open=true;const b=[...document.querySelectorAll('.btvn-card button')].find(b=>/^(Làm BTVN|Xem kết quả|Xem bài đã nộp)$/.test(b.textContent.trim())&&!b.disabled);if(!b)throw Error('Không có nút mở BTVN');b.click()`);
  await waitFor(`document.querySelector('#btvn-summary')`,'tổng quan bài');
 }
 async function openPreparation(){
  await evaluate(`const b=[...document.querySelectorAll('#btvn-summary button')].find(b=>/^(Bắt đầu làm bài|Làm lượt tiếp)$/.test(b.textContent.trim())&&!b.disabled);if(!b)throw Error('Không có nút mở bước chuẩn bị');b.click()`);
  await waitFor(`document.querySelector('.ep-attempt')`,'bố cục đề và phiếu trước bắt đầu');
 }
 async function enterRoom(){
  await waitFor(`document.querySelector('.fr-room')||document.querySelector('.ep-mobile-start button:not(:disabled)')`,'bước bắt đầu hoặc phòng đang làm');
  if(!await evaluate(`return !!document.querySelector('.fr-room')`))await click('.ep-mobile-start button');
  await waitFor(`document.querySelector('.fr-room')`,'phòng làm bài');
  await waitFor(`![...document.querySelectorAll('.fr-paper .mtm-source-content img')].some(i=>!i.complete||!i.naturalWidth)`,'ảnh đề thật hiển thị');
 }
 let viewportIndex=0;
 const widths=[{width:360,height:780},{width:390,height:844},{width:412,height:915},{width:1366,height:900},{width:1920,height:1080}];
 const selectedWidths=args.includes('--widths')?args[args.indexOf('--widths')+1].split(',').map(Number):args.includes('--width')?[Number(args[args.indexOf('--width')+1])]:null;
 if(selectedWidths?.some(width=>!widths.some(v=>v.width===width)))throw Error('Chiều rộng QA không được hỗ trợ.');
 for(current of widths.filter(v=>selectedWidths===null||selectedWidths.includes(v.width))){
  await send('Emulation.setDeviceMetricsOverride',{...current,deviceScaleFactor:1,mobile:current.width<760});await send('Emulation.setTouchEmulationEnabled',{enabled:current.width<760});
  await send('Storage.clearDataForOrigin',{origin:base,storageTypes:'all'});await send('Network.clearBrowserCookies');await send('Page.navigate',{url:base+'/btvn'});
  await waitFor(`document.querySelector('input[type=password]')&&!document.querySelector('[role=status]')?.textContent.includes('Đang kiểm tra')`,'cổng BTVN');
  await capture('cong-vao');await login('HS-TEST-0'+(viewportIndex++%3+1));await capture('danh-sach-buoi');
  await evaluate(`const d=document.querySelector('#r104-lesson-list');if(d)d.open=true;d?.scrollIntoView();`);await capture('toan-bo-buoi');
  await openOverview();await capture('chuan-bi');await openPreparation();await capture('bo-cuc-de-phieu','Bố cục đề và phiếu trước khi vào portal, kiểm lề trái/phải trên máy tính.');await enterRoom();
  await capture('phong-tn-anh');if(!args.includes('--focus-only')){await click('.ep-zoom-open');await waitFor(`document.querySelector('dialog[open]')`,'ảnh lớn');await capture('anh-phong-to');await click('.ep-zoom-close');
  await gotoQ(1,0);await capture('phong-dung-sai-4-y');
  await evaluate(`document.querySelector('.fr-quick-tf')?.scrollIntoView({block:'start'})`);await capture('dung-sai-du-4-y','Bốn ý và tám nút Đúng/Sai trong phiếu trả lời thật.');
  await gotoQ(2,0);await capture('phong-tra-loi-ngan');
  await evaluate(`document.querySelector('#fr-quick-short')?.focus();`);
  await send('Emulation.setDeviceMetricsOverride',{width:current.width,height:current.width<760?Math.max(420,current.height-310):current.height,deviceScaleFactor:1,mobile:current.width<760});
  await sleep(350);await capture('ban-phim-mo','Mô phỏng viewport bị bàn phím rút ngắn bằng Chrome CDP, chưa thay thế kiểm máy vật lý.');
  await evaluate(`document.activeElement?.blur()`);await send('Emulation.setDeviceMetricsOverride',{...current,deviceScaleFactor:1,mobile:current.width<760});await sleep(200);
  await capture('dieu-huong-cau');
  if(current.width<1024){await click('.fr-sheet-toggle');await capture('phieu-tra-loi');await click('.fr-sheet-close');}else await capture('phieu-tra-loi');await gotoQ(0,0);
  await evaluate(`const p=document.querySelector('.btvn-question');const s=document.createElement('section');s.className='ep-source-text qa-stress';p.append(s);const fixture=await import('/qa-ho-so-fixture.mjs');window.qaUnmount=fixture.mount(s);`);
  await waitFor(`document.querySelector('.qa-stress .mtm-math-authored math')&&document.querySelector('.qa-stress .katex-html')&&document.querySelector('.qa-stress table')`,'KaTeX, MathML biên tập và bảng thật');
  await evaluate(`document.querySelector('.qa-stress')?.scrollIntoView({block:'start'})`);await capture('cong-thuc-bang-tong-hop','MathText render KaTeX dài, MathML có thật trong kho biên tập và FitTable với dữ liệu stress tổng hợp.');
  await evaluate(`document.querySelector('.qa-stress .ep-table-toggle')?.click()`);await capture('bang-cuon-ngang','Chọn dạng ngang qua nút FitTable nếu bảng tự chuyển dọc; kiểm cuộn trong khung bảng.');
  await evaluate(`window.qaUnmount?.();document.querySelector('.qa-stress')?.remove()`);await gotoQ(0,0);
  }
  // 35 câu/5 nhóm và PDF ba trang chỉ có trong response tổng hợp phía client.
  await send('Page.navigate',{url:base+'/btvn?qa-pdf=1'});
  await waitFor(`document.querySelector('.ep-question-pdf canvas')`,'PDF vẽ thật trước vào phòng');await enterRoom();
  await gotoQ(2,2);await evaluate(`document.querySelector('.fr-workspace').scrollTop=0;document.querySelector('.fr-paper').scrollTop=0`);
  await capture('35-cau-dieu-huong','35 câu tổng hợp chia 3/1/16/6/9 để phát hiện lặp số câu và nhầm chip phần.');
  await check('35 câu có số liên tục, không trùng',`const nums=[...document.querySelectorAll('.fr-grid button')].map(e=>Number(e.textContent.match(/^\\s*(\\d+)/)?.[1]));return nums.length===35&&nums.every((n,i)=>n===i+1);`,'Dãy 1..35 duy nhất trên thanh điều hướng.');
  if(phase==='before'){
   await waitFor(`document.querySelector('.fr-room .ep-question-pdf canvas')&&!document.querySelector('.fr-room .ep-pdf-viewer [role=status]')`,'PDF cũ tự lặp dưới câu hỏi');
   await evaluate(`document.querySelector('.fr-pdf-document')?.scrollIntoView({block:'start'})`);await capture('phong-pdf','Bản gốc tự dựng PDF dưới câu và mở trang mặc định, trong khi trang đúng là 3.');
  }else{
   await check('PDF không tự dựng dưới câu hỏi',`return !document.querySelector('.fr-paper .ep-question-pdf canvas')&&!document.querySelector('.fr-source-dialog[open]');`,'Chỉ có ảnh/cắt câu, PDF chưa mount khi chưa bấm nút.');
   await capture('phong-pdf-chua-mo','PDF gốc chưa dựng, chỉ có nút Xem phiếu gốc.');
   await click('.fr-source-open');await waitFor(`document.querySelector('.fr-source-dialog[open] canvas[data-question-page="3"]')&&!document.querySelector('.fr-source-dialog[open] [role=status]')`,'phiếu gốc mở đúng trang 3');
   await check('Phiếu gốc mở đúng trang 3',`return document.querySelector('.fr-source-dialog[open] canvas')?.dataset.questionPage==='3'&&!document.querySelector('.fr-paper .ep-question-pdf canvas');`,'Không lấy crop.sourcePage=1 thay cho sourcePdfPage=3.');
   await capture('phong-pdf-trang-3','Bấm riêng mới mở PDF, canvas xác nhận data-question-page=3.');
   await click('.fr-source-close');await check('Đóng phiếu gỡ viewer',`return !document.querySelector('.fr-source-dialog')&&!document.querySelector('.fr-paper .ep-question-pdf canvas');`,'Viewer chỉ sống trong lần mở phiếu.');
   await gotoQ(2,3);await check('Đổi câu không tự mở lại PDF',`return !document.querySelector('.fr-source-dialog')&&!document.querySelector('.fr-paper .ep-question-pdf canvas');`,'Đổi câu tiếp tục chỉ hiện nội dung câu.');
   await capture('phong-pdf-da-dong','Đã đóng phiếu và đổi câu, không còn PDF dưới câu.');
  }
  // Trở về response demo gốc trước khi nộp. Không vượt gate hoặc sửa trạng thái React.
  await send('Page.navigate',{url:base+'/btvn'});
  await waitFor(`location.search===''&&document.querySelector('.btvn-session')&&!document.querySelector('.ep-question-pdf')`,'response demo gốc không gắn PDF');
  await enterRoom();await gotoQ(0,0);
  await waitFor(`document.querySelector('.fr-room .fr-submit:not(:disabled)')`,'bài gốc sẵn sàng nộp');
  await evaluate(`const b=[...document.querySelectorAll('.fr-room button')].find(b=>b.textContent.trim()==='Nộp bài'&&!b.disabled&&b.getBoundingClientRect().height>0);if(!b)throw Error('Không có nút nộp khả dụng');b.click()`);
  await waitFor(`document.querySelector('[role=alertdialog]')`,'xác nhận nộp');await capture('xac-nhan-nop');
  await evaluate(`const b=[...document.querySelectorAll('[role=alertdialog] button')].find(b=>b.textContent.trim()==='Vẫn nộp bài');if(!b)throw Error('Không thấy nút xác nhận');b.click()`);
  await waitFor(`!document.querySelector('.fr-room')&&document.querySelector('.btvn-score-big')`,'kết quả máy chủ demo');await capture('ket-qua');
  await evaluate(`document.querySelector('.btvn-score-big')?.scrollIntoView({block:'center'})`);await capture('ket-qua-chi-tiet','Điểm và biên nhận do máy chủ demo trả sau nộp thật qua UI.');
 }
 report.errors=report.shots.flatMap(s=>{
  const m=s.metrics,problems=[];
  if(m.overflowX||m.outside.length)problems.push(`tràn ngang=${m.overflowX}, ${m.outside.length} phần tử ngoài viewport không có khung cuộn`);
  for(const image of m.images)if(image.questionAsset&&!image.zoomDialog&&image.width>image.parentWidth+1)problems.push(`ảnh/PDF ${image.element} rộng ${image.width} vượt khung ${image.parentWidth}`);
  for(const g of m.gutters)if(!g.passes)problems.push(`lề ${g.name}: trái ${g.left}, phải ${g.right}, tối thiểu ${g.minimum}`);
  if(s.viewport.width<760){if(m.smallControls.length)problems.push(`${m.smallControls.length} nút/ô nhập nhỏ hơn 44 px`);if(m.smallControlFonts.length)problems.push(`${m.smallControlFonts.length} điều khiển có chữ dưới 16 px`);}
  if(m.dock?.overlapsReadingArea)problems.push('thanh dưới chồng vùng đọc');
  if(m.desktopLayout&&!m.sourceViewer.dialogOpen){
   if(!m.desktopLayout.sheetOnRight)problems.push('phiếu trả lời chưa hiện ở cột bên phải đề');
   if(m.desktopLayout.groupCenterOffset>2)problems.push(`đề và phiếu lệch tâm ${m.desktopLayout.groupCenterOffset} px`);
   if(m.desktopLayout.topCenterOffset>2)problems.push(`thanh trên lệch tâm ${m.desktopLayout.topCenterOffset} px`);
  }
  if(s.name==='ban-phim-mo'&&m.input?.active&&!m.input.visible)problems.push('ô nhập bị che khi viewport bàn phím thu lại');
  if(s.name==='cong-thuc-bang-tong-hop'&&!Object.values(m.formulaPresence).every(Boolean))problems.push('thiếu renderer KaTeX/MathML/FitTable thật trong fixture');
  if(s.name==='cong-thuc-bang-tong-hop'&&s.viewport.width<760&&!m.localScrollers.some(sc=>sc.element.includes('mtm-formula')&&!sc.authored&&sc.hasOverflow&&sc.canScrollX))problems.push('công thức KaTeX dài chưa cuộn ngang trong khung riêng');
  if(s.name==='bang-cuon-ngang')for(const sc of m.localScrollers)if(sc.hasOverflow&&!sc.canScrollX)problems.push(`khung ${sc.element} có nội dung dài nhưng không cuộn ngang được`);
  return problems.map(problem=>`${s.viewport.width}/${s.name}: ${problem}.`);
 });
 report.errors.push(...report.checks.filter(check=>!check.passes).map(check=>`${check.width}/${check.name}: ${check.note}`));
 persistReport();console.log(`Đã chụp ${report.shots.length} ảnh Chrome thật. ${report.errors.length} lỗi định lượng.`);
 if(phase==='after'&&report.errors.length)process.exitCode=1;
 if(args.includes('--keep-server')){console.log('Giữ server local tại '+base+'; dừng bằng Ctrl+C.');await new Promise(()=>{});}
}catch(error){report.errors.push(error.stack||String(error));writeFileSync(join(output,`bao-cao-${phase}.json`),JSON.stringify(report,null,2)+'\n');console.error(error);process.exitCode=1;}
finally{ws?.close();chrome?.kill();await server?.close();}

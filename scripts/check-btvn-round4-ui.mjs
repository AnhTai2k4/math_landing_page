import {build} from 'esbuild';
import {writeFileSync,readFileSync,mkdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const out='T:/Claude/SanPham/btvn-web-diem-danh/phieu-a/qa-dot-4';mkdirSync(out,{recursive:true});
const lessons=[
  {lessonCode:'fake-1',date:'2026-10-14',title:'Hàm số và đồ thị',videoId:'abcdefghijk',materialUrl:'https://example.invalid/tai-lieu',handoutUrl:'https://example.invalid/handout',bestScore:null,late:null,submittedAt:null,dueAt:Date.parse('2026-10-16T19:30:00+07:00'),available:true},
  {lessonCode:'fake-2',date:'2026-10-12',title:'Ôn tập kiểm tra giữa kì',videoId:null,bestScore:null,late:null,submittedAt:null,dueAt:null,available:true},
  {lessonCode:'fake-3',date:'2026-10-09',title:'Phương trình mũ và logarit',videoId:'abcdefghijk',bestScore:8.5,late:false,submittedAt:Date.parse('2026-10-10T21:04:00+07:00'),dueAt:Date.parse('2026-10-12T19:30:00+07:00'),available:true},
  {lessonCode:'fake-4',date:'2026-10-07',title:'Cấp số nhân',videoId:'abcdefghijk',bestScore:6,late:true,submittedAt:Date.parse('2026-10-09T22:15:00+07:00'),dueAt:Date.parse('2026-10-09T19:30:00+07:00'),available:true}
].map(l=>({materialUrl:null,handoutUrl:null,homeworkUrl:null,classNames:['Lớp giả'],...l}));
const entry=`import React from 'react';import {createRoot} from 'react-dom/client';import LessonCards from './src/native/homework/LessonCards';
const lessons=${JSON.stringify(lessons)};let selected='';createRoot(document.getElementById('cards')).render(<LessonCards lessons={lessons} busy={false} onHomework={code=>{selected=code;}}/>);
const delay=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{await delay(100);const cards=[...document.querySelectorAll('.btvn-card')];const button=cards[0].querySelector('button');button.click();await delay(100);
const frame=cards[0].querySelector('iframe'),box=frame.getBoundingClientRect();
const result={width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,ratio:box.width/box.height,src:frame.src,dates:[...document.querySelectorAll('.btvn-date b')].map(e=>e.textContent),reviewButtons:cards[1].querySelectorAll('button').length,reviewText:cards[1].textContent.includes('không có kiến thức mới'),statuses:[...document.querySelectorAll('.btvn-card-status b')].map(e=>e.textContent),independent:false,closeInvite:false};
cards[1].querySelector('button').click();result.independent=selected==='fake-2';button.click();await delay(100);result.closeInvite=cards[0].textContent.includes('Làm BTVN buổi này')&&!cards[0].querySelector('iframe');button.click();await delay(100);
const buttons=cards[0].querySelectorAll('.btvn-card-actions button');result.sameRow=Math.abs(buttons[0].getBoundingClientRect().top-buttons[1].getBoundingClientRect().top)<1;
document.getElementById('receipt').textContent=JSON.stringify(result);document.title='QA-DONE';})();`;
const built=await build({stdin:{contents:entry,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'}});
const logo=readFileSync('public/mtm-original-logo-420w.webp').toString('base64');
const html=`<!doctype html><html lang="vi"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; frame-src 'none'"><style>*{box-sizing:border-box}body{margin:0;background:#f5f7fa}button{font:inherit}${readFileSync('src/native/homework/btvn-session.css','utf8')}</style></head><body><section class="btvn-session"><header class="btvn-top"><img src="data:image/webp;base64,${logo}" alt="Minh Thành Math"><div><b>Bài tập về nhà</b><p>Video buổi học và BTVN của lớp em</p></div><div class="btvn-me"><b>Học sinh giả</b><span>Lớp giả · Thoát</span></div></header><div id="cards"></div></section><pre id="receipt" hidden></pre><script>${built.outputFiles[0].text.replaceAll('</script','<\\/script')}</script></body></html>`;
const file=out+'/mau-a-code.html';writeFileSync(file,html);
if(process.argv.includes('--static')){
  // CJS React cần require trong ESM bundle; dùng CJS cho artifact kiểm đơn lẻ.
  const cjs=await build({stdin:{contents:`import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import LessonCards from './src/native/homework/LessonCards';export const html=renderToStaticMarkup(<LessonCards lessons={${JSON.stringify(lessons)}} busy={false} onHomework={()=>{}}/>);`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'node',format:'cjs',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'}});
  writeFileSync(out+'/static-check.cjs',cjs.outputFiles[0].text);const rendered=(await import(pathToFileURL(out+'/static-check.cjs').href)).default.html;
  const cards=rendered.split('<section class="btvn-card');assert.equal(cards.length-1,4);assert.equal((cards[2].match(/<button/g)??[]).length,1);assert.ok(cards[2].includes('không có kiến thức mới'));assert.ok(rendered.includes('8,5/10'));assert.ok(rendered.includes('Nộp muộn · 6/10'));assert.equal((rendered.match(/▶ Xem video/g)??[]).length,3);assert.ok(!rendered.includes('<iframe'));assert.deepEqual([...rendered.matchAll(/class="btvn-date"><b>(.*?)<\/b>/g)].map(m=>m[1]),['14/10','12/10','09/10','07/10']);
  writeFileSync(out+'/STATIC-RECEIPT.json',JSON.stringify({cards:4,reviewHasOneButton:true,initialIframeAbsent:true,videoButtons:3,statusLabels:true,datesSorted:true,browserVerified:false},null,2));console.log('Đạt render React tĩnh: 4 thẻ, ngày giảm dần, 3 nút video, ôn tập 1 nút, nhãn điểm/trạng thái; chưa thay kiểm trình duyệt.');process.exit(0);
}
const results=[];for(const width of [1920,1366,390]){
  const screenshot=out+'/code-'+width+'.png';const args=['--headless','--disable-gpu','--no-first-run','--no-default-browser-check','--disable-background-networking','--allow-file-access-from-files','--hide-scrollbars','--user-data-dir='+resolve('.qa-temp/edge-round4-'+width),'--window-size='+width+',1080','--virtual-time-budget=4000','--screenshot='+screenshot,'--dump-dom','file:///'+file];
  const run=spawnSync('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args,{encoding:'utf8',timeout:25000,maxBuffer:4*1024*1024,windowsHide:true});
  writeFileSync(out+'/edge-'+width+'.log',run.stderr??'');const match=/<pre id="receipt" hidden="">(.*?)<\/pre>/s.exec(run.stdout??'');
  if(!match){writeFileSync(out+'/UI-BLOCKED.json',JSON.stringify({width,browserVerified:false,exitCode:run.status,error:run.error?.message??'Edge dừng trước khi tạo DOM; xem edge-'+width+'.log',screenshotsCreated:false},null,2));throw new Error('Chưa có DOM receipt ở '+width+' '+(run.error?.message??''));}
  const result=JSON.parse(match[1].replaceAll('&quot;','"').replaceAll('&amp;','&'));results.push(result);
  if(result.overflow||Math.abs(result.ratio-16/9)>.02||!result.sameRow||!result.independent||!result.closeInvite||result.reviewButtons!==1||!result.reviewText||!result.src.startsWith('https://www.youtube-nocookie.com/embed/'))throw new Error('QA UI lỗi '+JSON.stringify(result));
}
writeFileSync(out+'/UI-RECEIPT.json',JSON.stringify({component:'LessonCards thật, React bundle cục bộ; dữ liệu giả; CSP chặn mạng/iframe ngoài',results,videoPlaybackVerified:false},null,2));console.log('Đạt UI 1920/1366/390: không tràn, 16:9, nút ngang hàng, đóng video có lời mời, ôn tập chỉ 1 nút, BTVN độc lập.');

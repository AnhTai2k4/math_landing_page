import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {join} from 'node:path';

// Các chốt hồi quy CSS/SSR bổ sung cho ảnh Chrome thật trong hồ sơ QA.
// Không coi test cấu trúc này là phép đo bố cục hoặc thử bàn phím thiết bị thật.
const root=process.env.MTM_ROOT!,require=createRequire(join(root,'package.json'));
const postcss=require('postcss'),{buildSync}=require('esbuild'),React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const read=(file:string)=>readFileSync(join(root,file),'utf8');
type Rule={selector:string;parent:any;nodes:any[]};
const rules=(file:string):Rule[]=>{const result:Rule[]=[];postcss.parse(read(file)).walkRules((rule:Rule)=>result.push(rule));return result;};
const page=rules('src/native/homework/btvn-mobile.css'),room=rules('src/native/exams/btvn-room-mobile.css');
const value=(rule:Rule,property:string)=>rule.nodes.filter(node=>node.type==='decl'&&node.prop===property).at(-1)?.value;
const mobile=(rule:Rule)=>{for(let parent=rule.parent;parent;parent=parent.parent)if(parent.type==='atrule'&&parent.name==='media'&&/max-width:\s*760px/.test(parent.params))return true;return false;};
const has=(list:Rule[],selector:RegExp,property:string,expected:RegExp)=>list.some(rule=>selector.test(rule.selector)&&expected.test(value(rule,property)??''));
const guard=(condition:boolean,message:string)=>assert.ok(condition,message);

for(const [name,list] of [['trang BTVN',page],['phòng BTVN',room]] as const){
  guard(has(list,/.btvn-session|\[data-homework\]/,'min-width',/^0$/),`${name}: con flex/grid được phép thu nhỏ`);
  guard(has(list,/.btvn-session|\[data-homework\]/,'box-sizing',/^border-box$/),`${name}: padding không cộng vượt chiều rộng`);
  guard(has(list,/.btvn-session|\[data-homework\]/,'overflow-wrap',/^anywhere$/),`${name}: tên bài và nội dung dài được xuống dòng`);
  guard(has(list,/img/,'max-width',/^100%$/)&&has(list,/img/,'height',/^auto$/),`${name}: ảnh gốc rộng phải vừa khung, giữ tỷ lệ`);
  guard(has(list,/.mtm-formula/,'overflow-x',/^auto$/)&&has(list,/.mtm-formula/,'max-width',/^100%$/),`${name}: công thức cuộn trong khung riêng`);
  guard(has(list,/.mtm-formula/,'white-space',/^nowrap$/),`${name}: công thức dài giữ một dòng và cuộn riêng, không bị ngắt tại dấu toán`);
  guard(has(list,/.ep-table-wrap/,'overflow-x',/^auto$/)&&has(list,/.ep-table-wrap/,'max-width',/^100%$/),`${name}: bảng cuộn trong khung riêng`);
  // Khóa cuộn document khi mở portal là hành vi hợp lệ. Không được che tràn
  // của container bằng overflow-x:hidden/clip rồi báo rằng nội dung đã vừa.
  for(const rule of list){
    const broad=postcss.list.comma(rule.selector).some((selector:string)=>/^(?:\.ep-root)?\.btvn-session$|^\.hw-root$|^\.ep-root(?:\.[\w-]+)*\[data-homework\]$/.test(selector.trim()));
    if(broad)assert.doesNotMatch(value(rule,'overflow-x')??value(rule,'overflow')??'',/\b(hidden|clip)\b/,`${name}: không che lỗi tràn ngang ở container`);
  }
}

guard(page.some(rule=>!mobile(rule)&&Number.parseFloat(value(rule,'--btvn-page-gutter')??'')>=24),'Trang BTVN có lề máy tính ít nhất 24 px');
guard(page.some(rule=>mobile(rule)&&Number.parseFloat(value(rule,'--btvn-page-gutter')??'')>=16),'Trang BTVN có lề điện thoại ít nhất 16 px');
guard(has(page,/>\s*\.ep-attempt/,'max-width',/var\(--btvn-page-width\)/)&&has(page,/>\s*\.ep-attempt/,'margin-inline',/^auto$/),'Đề và phiếu trả lời có container căn giữa, giới hạn chiều rộng');
guard(has(page,/>\s*\.ep-attempt/,'padding',/var\(--btvn-page-gutter\)/),'Đề trước phòng tập trung dùng lề container, không sát mép màn hình');
guard(room.some(rule=>!mobile(rule)&&/^max\((?:2[4-9]|[3-9]\d)px,/.test(value(rule,'--btvn-room-gutter')??'')),'Phòng BTVN có lề máy tính ít nhất 24 px');
guard(room.some(rule=>mobile(rule)&&Number.parseFloat(value(rule,'--btvn-room-gutter')??'')>=16),'Phòng BTVN có lề điện thoại ít nhất 16 px');
guard(has(room,/.fr-workspace/,'padding-inline',/var\(--btvn-room-gutter\)/)&&has(room,/.fr-sheet/,'padding-inline',/var\(--btvn-room-gutter\)/),'Đề và thanh phiếu dùng chung lề máy tính');
guard(has(room,/.fr-answer-dock/,'flex',/^none$/),'Thanh nộp chiếm một hàng riêng, không đè lên vùng đọc');
guard(has(room,/.fr-answer-dock/,'padding',/safe-area-inset-bottom/),'Thanh nộp chừa vùng an toàn phía dưới');
guard(has(room,/.fr-sheet.is-open/,'overflow-y',/^auto$/)&&has(room,/.fr-sheet.is-open/,'max-height',/btvn-viewport-height/),'Phiếu mở cuộn riêng trong chiều cao nhìn thấy');
// Phòng máy tính có hai cột trong một grid chung. Phiếu luôn hiện bên phải,
// các nhóm thu nhỏ và lưới câu xuống hàng trong cột, không ép tràn viewport.
const desktopRoom=room.filter(rule=>!mobile(rule));
guard(has(desktopRoom,/\.fr-study-layout$/,'display',/^grid$/)&&has(desktopRoom,/\.fr-study-layout$/,'grid-template-columns',/minmax\(0,\s*1fr\).*clamp/),'Đề và phiếu dùng hai cột cân đối, cho phép đề thu nhỏ');
guard(has(desktopRoom,/\.fr-sheet(?:\.is-open)?\s*(?:,|$)/,'grid-column',/^2$/)&&has(desktopRoom,/\.fr-sheet(?:\.is-open)?\s*(?:,|$)/,'position',/^static$/),'Phiếu máy tính luôn nằm trong cột phải, không phải popup bị khuất');
guard(has(desktopRoom,/\.fr-sheet\s*>\s*section$/,'min-width',/^0$/)&&has(desktopRoom,/\.fr-sheet\s*>\s*section$/,'max-width',/^100%$/),'Mỗi phần phiếu máy tính thu nhỏ trong container');
guard(has(desktopRoom,/\.fr-sheet\s+\.fr-grid$/,'grid-template-columns',/repeat\(5,\s*minmax\(0,\s*1fr\)\)/),'Dãy câu hỏi xuống hàng trong năm cột không ép tràn ngang');
guard(has(room,/button/,'min-height',/^(?:4[4-9]|[5-9]\d)px$/),'Nút phòng BTVN có vùng chạm ít nhất 44 px');
guard(has(room,/button/,'font-size',/^16px$/)&&has(page,/input/,'font-size',/^16px$/),'Chữ và ô nhập trên điện thoại ít nhất 16 px');

function load(file:string){
  const code=buildSync({entryPoints:[join(root,file)],bundle:true,write:false,platform:'node',format:'cjs',jsx:'automatic',packages:'external',loader:{'.css':'empty'},logLevel:'silent'}).outputFiles[0].text;
  const module={exports:{} as any};new Function('require','module','exports',code)((id:string)=>id.endsWith('.css')?{}:require(id),module,module.exports);return module.exports.default;
}
const render=(component:any,props:any)=>renderToStaticMarkup(React.createElement(component,props));
const MathText=load('src/native/math/MathText.tsx');
const longLatex=Array.from({length:24},(_,i)=>`\\frac{x_{${i+1}}+1}{x_{${i+1}}-1}`).join('+');
const formula=render(MathText,{text:`Công thức dài $${longLatex}$ vẫn giữ đủ các số hạng.`});
assert.match(formula,/<span class="mtm-formula"/,'KaTeX dài có wrapper để cuộn riêng');
assert.match(formula,/class="katex"/,'Công thức được render bằng KaTeX, không chỉ in mã nguồn');
const authored=JSON.parse(read('src/native/math/mathtype-authored.json'))[0];
const authoredHtml=render(MathText,{text:`$${authored.latex}$`});
assert.match(authoredHtml,/class="mtm-formula mtm-math-authored"/,'MathML MathType dùng cùng wrapper giới hạn chiều rộng');
assert.match(authoredHtml,/<math\b/,'Giữ MathML gốc trong công thức MathType');

const image=render(load('src/native/exams/ZoomableImage.tsx'),{src:'/fixture-rong.png',alt:'Đề giả rộng',label:'Đề giả',width:2000,height:800});
assert.match(image,/class="ep-inline-scroll"/);
assert.match(image,/<img[^>]+width="2000"[^>]+height="800"/,'Giữ kích thước gốc để ảnh phóng lớn đủ nét');
assert.match(image,/<button[^>]+aria-haspopup="dialog"[^>]+aria-label="Phóng to Đề giả"/,'Ảnh có nút mở lớn dùng được bằng bàn phím và cảm ứng');

const focus=read('src/native/exams/FocusRoom.tsx'),pdf=read('src/native/exams/QuestionPdf.tsx');
assert.match(focus,/fitToWidth=\{props\.isHomework\}/,'PDF của BTVN mở vừa chiều ngang');
assert.match(pdf,/!fitToWidth\s*&&\s*compact/,'Mặc định phóng PDF không ghi đè yêu cầu vừa ngang');
assert.match(focus,/window\.visualViewport/,'Phòng theo dõi vùng nhìn thấy khi bàn phím ảo xuất hiện');
for(const event of ['resize','scroll']){
  assert.match(focus,new RegExp(`viewport\\.addEventListener\\('${event}',update\\)`));
  assert.match(focus,new RegExp(`viewport\\.removeEventListener\\('${event}',update\\)`),'Gỡ listener khi rời phòng, không để tác vụ theo dõi tồn đọng');
}
assert.match(focus,/workspace\.scrollTop\+=/,'Ô nhập bị khuất được đưa vào chính vùng đọc, không kéo trang nền');
assert.match(focus,/clearTimeout\(settle\)/,'Gỡ lần kiểm lại viewport khi rời phòng');
assert.match(read('src/native/homework/HomeworkSession.tsx'),/import '\.\/btvn-mobile\.css'/);
assert.match(focus,/import '\.\/btvn-room-mobile\.css'/,'Portal có CSS BTVN riêng, không phụ thuộc tổ tiên ngoài portal');
console.log('Đạt hồi quy BTVN: lề 24/16 px, ảnh vừa khung và mở lớn, KaTeX/MathML và bảng cuộn riêng, nút 44 px, safe area, PDF vừa ngang và visualViewport.');

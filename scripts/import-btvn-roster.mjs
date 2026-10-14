// Một lần, phía máy chủ. Không tạo dịch vụ/lịch và không cập nhật DB/web thật.
// node scripts/import-btvn-roster.mjs <snapshot.json> [--previous <bundle.json>]
// node scripts/import-btvn-roster.mjs --sheet <config.json> [--previous <bundle.json>]
import {build} from 'esbuild';
import {readFileSync,mkdirSync,writeFileSync,realpathSync,readdirSync} from 'node:fs';
import {resolve,relative,isAbsolute,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const args=process.argv.slice(2),live=args[0]==='--sheet';if(live)args.shift();
const source=args.shift();let previous;
if(args.length){if(args.shift()!=='--previous'||args.length!==1)throw Error('Tham số không hợp lệ');previous=args.shift();}
if(!source)throw Error('Cần snapshot hoặc cấu hình Sheet');
const input=JSON.parse(readFileSync(source,'utf8')),config=live?input:input.config;
if(live&&config.enabled!==true)throw Error('Nhập thật đang tắt; Claude phải đối chiếu tab/cột trước bật');
if(live&&config.legacyReconciled!==true)throw Error('Claude phải đối soát mã cũ và đặt legacyReconciled=true trước cấp mã từ nguồn thật');
const root=fileURLToPath(new URL('../',import.meta.url));
const target=resolve(config.outputDir??'T:/Claude/SanPham/btvn-web-diem-danh/rieng-tu/');
mkdirSync(target,{recursive:true});
const actual=realpathSync(target),rel=relative(realpathSync(root),actual);
if(!rel.startsWith('..')&&!isAbsolute(rel))throw Error('Output nội bộ phải nằm ngoài repo/web/bundle');
if(actual.split(/[\\/]/).some(part=>/^(public|build|dist)$/i.test(part)))throw Error('Không xuất vào thư mục public/build/dist');
if(!previous&&readdirSync(actual).some(name=>name.startsWith('lan-')))throw Error('Đã có lượt nhập; cần --previous trỏ bundle hoàn tất để giữ mã');
const compile=async(file)=>{const r=await build({entryPoints:[join(root,file)],bundle:true,write:false,platform:'node',format:'esm'});return import('data:text/javascript;base64,'+Buffer.from(r.outputFiles[0].text).toString('base64'));};
const {readRosterSheet}=await compile('server/btvn/roster.ts');
const old=previous?JSON.parse(readFileSync(previous,'utf8')):null;
if(previous){const complete=JSON.parse(readFileSync(join(resolve(previous,'..'),'COMPLETE.json'),'utf8'));if(!Number.isInteger(complete.students))throw Error('Bản trước chưa hoàn tất');}
if(old&&old.sheetId!==config.sheetId)throw Error('Bản trước khác nguồn');
let read;
if(live){const {readSheetValues}=await compile('server/btvn/google-sheet-reader.ts');read=(id,tab)=>readSheetValues(id,tab,process.env.MTM_ROSTER_ACCESS_TOKEN??'');}
else read=async(_id,tab)=>{if(!Array.isArray(input.tabs?.[tab]))throw Error('Thiếu tab snapshot');return input.tabs[tab];};
let result;
try{result=await readRosterSheet(config,read,old?.registry??{});}catch{throw Error('Nhập không hoàn tất; cần kiểm riêng tab/cột/định danh/ghi chú chuyển lớp/quyền đọc. Không ghi hồ sơ một phần.');}
const cell=v=>'"'+String(v??'').replace(/^[\s]*[=+\-@]/,"'$&").replace(/"/g,'""')+'"';
const csv='\uFEFF'+[['ho_ten','lop','khoa','ma'],...result.students.map(s=>[s.fullName,s.className,s.cohort,s.studentCode])].map(r=>r.map(cell).join(',')).join('\r\n')+'\r\n';
// Thư mục mới từng lượt, bundle là nguồn phục hồi đầy đủ. COMPLETE ghi cuối;
// lượt chưa có COMPLETE không được dùng làm checkpoint. Giữ bản trước.
const run=join(actual,'lan-'+Date.now()+'-'+process.pid);mkdirSync(run);
writeFileSync(join(run,'bundle.json'),JSON.stringify({sheetId:config.sheetId,...result},null,2)+'\n',{flag:'wx',mode:0o600});
writeFileSync(join(run,'ma-hoc-sinh-noi-bo.csv'),csv,{flag:'wx',mode:0o600});
writeFileSync(join(run,'COMPLETE.json'),JSON.stringify({students:result.students.length,excluded:result.excluded,live,appliedToDatabase:false})+'\n',{flag:'wx',mode:0o600});
console.log('Đã lưu bộ nội bộ tại '+run+'. Chưa cập nhật DB, chưa gửi mã. Kiểm ACL Windows của thư mục riêng tư trước dùng thật.');

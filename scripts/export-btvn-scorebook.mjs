import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {loadModule,option,operatorRpc} from './btvn-operator.mjs';
try{
 const args=process.argv.slice(2),out=option(args,'--out');if(!out||!out.endsWith('.xlsx'))throw Error('Cần --out <xlsx>');
 const require=createRequire(import.meta.url);let XLSX;
 try{XLSX=require('xlsx');}catch{XLSX=createRequire(resolve(process.env.MTM_PGLITE_DIR??'T:/Claude/SanPham/btvn-web-diem-danh/tools-sql/node_modules','../package.json'))('xlsx');}
 const {buildScorebook}=await loadModule('server/btvn/scorebook.ts');
 const rows=await operatorRpc('mtm_btvn_scorebook',{p_from:'2026-10-15',p_apply:false});
 const workbook=XLSX.utils.book_new();let n=0;const used=new Set();
 for(const tab of buildScorebook(rows)){let name=tab.className.replace(/[\\/?*\[\]:]/g,' ').slice(0,31);if(!name||used.has(name))name='Lớp '+(++n);used.add(name);XLSX.utils.book_append_sheet(workbook,XLSX.utils.aoa_to_sheet(tab.values),name);}
 if(!workbook.SheetNames.length)throw Error('Không có dữ liệu');XLSX.writeFile(workbook,out);console.log('Đã xuất sổ điểm vào đích operator chỉ định.');
}catch{console.error('Chưa xuất sổ điểm. Kiểm cấu hình RPC và thư viện xlsx (Claude cài trong tools-sql nếu thiếu).');process.exitCode=1;}

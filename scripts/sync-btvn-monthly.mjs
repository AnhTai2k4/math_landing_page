// Snapshot Google Sheet do operator xuất riêng tư, mỗi tab là một lớp.
// {"2K9 9+":[["Họ và tên","SĐT","Tháng (mm/yyyy)","Điểm"], ...]}
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {operatorRpc} from './btvn-operator.mjs';
export function monthlyPayload(snapshot){
 if(!snapshot||typeof snapshot!=='object'||Array.isArray(snapshot))throw Error('Snapshot không hợp lệ');
 const rows=[];
 for(const [className,grid] of Object.entries(snapshot)){
  if(!/^2K(9|10|11|12|13|14)( |$)/.test(className)||!Array.isArray(grid)||!Array.isArray(grid[0]))throw Error('Tab không hợp lệ');
  const header=grid[0].map(v=>String(v).normalize('NFC').trim()),cols=['Họ và tên','SĐT','Tháng (mm/yyyy)','Điểm'].map(key=>{if(header.filter(x=>x===key).length!==1)throw Error('Cột không hợp lệ');return header.indexOf(key);});
  for(const row of grid.slice(1)){
   if(!Array.isArray(row))throw Error('Dòng không hợp lệ');if(row.every(v=>v===null||String(v).trim()===''))continue;
   const [fullName,rawPhone,month,rawScore]=cols.map(i=>String(row[i]??'').trim());
   const phone=rawPhone.replace(/[^0-9]/g,'').replace(/^84/,'0'),score=Number(rawScore.replace(',','.'));
   if(!fullName||!/^0\d{9}$/.test(phone)||!/^(0[1-9]|1[0-2])\/20\d{2}$/.test(month)||!rawScore||!Number.isFinite(score)||score<0||score>10)throw Error('Dòng cần đối soát');
   rows.push({className,fullName,phone,month,score});
  }
 }
 return {rows};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{const args=process.argv.slice(2);if(!args[0]||args[0].startsWith('--')||args.slice(1).some(x=>x!=='--live'))throw Error();
  const payload=monthlyPayload(JSON.parse(readFileSync(args[0],'utf8').replace(/^\uFEFF/,'')));
  console.log(JSON.stringify(await operatorRpc('mtm_btvn_sync_monthly',{p_payload:payload,p_apply:args.includes('--live')})));
 }catch{console.error('Chưa đồng bộ điểm tháng. Kiểm snapshot riêng tư, cột, dữ liệu cần đối soát và quyền operator. Mặc định dry-run; chỉ --live mới ghi.');process.exitCode=1;}
}

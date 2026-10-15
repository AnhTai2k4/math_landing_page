import {readFileSync} from 'node:fs';
import {loadModule,option,operatorRpc} from './btvn-operator.mjs';
try{
 const args=process.argv.slice(2),map=option(args,'--map');if(!args[0]||args[0].startsWith('--')||!map)throw Error('Dùng: sync-btvn-due.mjs <snapshot.json> --map <map.json> [--live]');
 const {parseAttendanceSheet}=await loadModule('server/btvn/attendance-sheet.ts');
 const {classRules}=await loadModule('server/btvn/class-rules.ts');
 const parsed=parseAttendanceSheet(JSON.parse(readFileSync(args[0],'utf8').replace(/^\uFEFF/,'')),JSON.parse(readFileSync(map,'utf8').replace(/^\uFEFF/,'')));
 // Không áp dụng snapshot chưa đối soát đủ, không in dòng có tên/SĐT.
 if(parsed.pending.length)throw Error('Cần đối soát '+parsed.pending.length+' mục trong snapshot/ánh xạ trước khi đồng bộ');
 const summary=await operatorRpc('mtm_btvn_sync_due',{p_payload:{sessions:parsed.sessions,classRules},p_apply:args.includes('--live')});
 console.log(JSON.stringify(summary));
}catch{console.error('Chưa đồng bộ hạn. Kiểm cú pháp, cấu hình ánh xạ, mục cần đối soát và kết quả RPC trong kênh operator riêng tư.');process.exitCode=1;}

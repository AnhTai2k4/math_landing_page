// node scripts/sync-btvn-roster.mjs <bundle.json> --config <sync-config.json> [--live]
// Không tự đọc Sheet/secret file; chỉ operator gọi. Mặc định RPC dry-run rollback.
import {readFileSync,writeFileSync,mkdirSync,realpathSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {makeSyncPayload,callOperatorRpc,codeCsv,digest} from './btvn-roster-sync-core.mjs';
const args=process.argv.slice(2),bundlePath=args.shift();
if(!bundlePath||args.shift()!=='--config')throw Error('Cần bundle --config cấu hình riêng tư');
const configPath=args.shift(),live=args[0]==='--live';if(live)args.shift();if(!configPath||args.length)throw Error('Tham số không hợp lệ');
try{
 const bundle=JSON.parse(readFileSync(bundlePath,'utf8').replace(/^\uFEFF/,'')),config=JSON.parse(readFileSync(configPath,'utf8').replace(/^\uFEFF/,''));
 const complete=JSON.parse(readFileSync(join(resolve(bundlePath,'..'),'COMPLETE.json'),'utf8').replace(/^\uFEFF/,''));
 if(complete.students!==bundle.students?.length)throw Error('Bundle chưa hoàn tất');
 // Payload chuyển parentName/school từ bundle vào RPC; school chỉ bổ sung hồ sơ đang thiếu.
 // Không xuất thêm cột tên PH hoặc trường trong CSV mã.
 const payload=makeSyncPayload(bundle,config);let run;
 if(live){
  const target=resolve('T:/Claude/SanPham/btvn-web-diem-danh/rieng-tu');mkdirSync(target,{recursive:true});
  // realpath chống junction vào repo/public. Không chọn output khác bằng config.
  if(realpathSync(target).toLowerCase().replace(/\\/g,'/')!==target.toLowerCase().replace(/\\/g,'/'))throw Error('Đường riêng tư bị chuyển hướng');
  run=join(target,`sync-${Date.now()}-${process.pid}`);mkdirSync(run);
  // Lưu ý định + mã đề xuất trước RPC, khôi phục được sau timeout. Không ghi credential.
  writeFileSync(join(run,'INTENT.json'),JSON.stringify({payload,bundleHash:digest(JSON.stringify(bundle))},null,2),{flag:'wx',mode:0o600});
 }
 const result=await callOperatorRpc('mtm_btvn_sync_roster',{p_payload:payload,p_apply:live},process.env);
 if(result.summary?.applied!==live)throw Error('Receipt không khớp chế độ');
 // Chỉ whitelist thống kê; không in payload, mã, tên, SĐT hoặc lỗi từ DB.
 const counts={};for(const k of ['classes','classesAdded','added','updated','unchanged','skipped','excluded','codesAdded','removed']){if(!Number.isInteger(result.summary[k])||result.summary[k]<0)throw Error('Thống kê không hợp lệ');counts[k]=result.summary[k];}
 if(live&&(!Array.isArray(result.students)||result.students.length!==payload.students.length))throw Error('Receipt hồ sơ chưa đủ');
 if(live){
  writeFileSync(join(run,'result.json'),JSON.stringify(result,null,2),{flag:'wx',mode:0o600});
  writeFileSync(join(run,'ma-hoc-sinh-noi-bo.csv'),codeCsv(result.students),{flag:'wx',mode:0o600});
  writeFileSync(join(run,'COMPLETE.json'),JSON.stringify({applied:true,summary:result.summary}),{flag:'wx',mode:0o600});
 }
 console.log(JSON.stringify({live,...counts}));
}catch{console.error('Đồng bộ chưa hoàn tất. Kiểm cấu hình/quyền và receipt riêng tư; không thử lại mù sau lỗi live.');process.exitCode=1;}

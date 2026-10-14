// Chạy một lần. Mặc định snapshot giả; --sheet đọc riêng Sheet học liệu bằng quyền người vận hành cấp.
// node scripts/watch-btvn-materials.mjs <snapshot.json> <checkpoint.json> <output.json>
// snapshot = {config: MaterialConfig, values: [headers, ...rows]}
import {build} from 'esbuild';
import {readFileSync,writeFileSync,renameSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
const args=process.argv.slice(2),live=args[0]==='--sheet';if(live)args.shift();
const [source,checkpoint,output]=args;
if(!source||!checkpoint||!output)throw new Error('Cần snapshot học liệu, checkpoint và output');
if(new Set([source,checkpoint,output].map(p=>resolve(p))).size!==3)throw new Error('Ba đường dẫn phải khác nhau');
if(existsSync(output))throw new Error('Output đã tồn tại; chọn file mới để giữ việc cũ');
const {outputFiles}=await build({entryPoints:['server/btvn/material-watch.ts'],bundle:true,write:false,platform:'node',format:'esm'});
const {detectHomework}=await import('data:text/javascript;base64,'+Buffer.from(outputFiles[0].text).toString('base64'));
const input=JSON.parse(readFileSync(source,'utf8'));
if(live){
  const allowed=['1rq76we9zUxMWN4ni77_agf23XZ1QQsfJ3DM5qX5gGUg','1161uGE4TsAQskIsJUeEoLH03IdYndrLSk5wr00FsTKk'];
  if(!allowed.includes(input.config?.sheetId))throw new Error('Chỉ cho phép hai nguồn học liệu trong lệnh, không nhận Sheet danh sách');
  const reader=await build({entryPoints:['server/btvn/material-grid-reader.ts'],bundle:true,write:false,platform:'node',format:'esm'});
  const {readMaterialGrid}=await import('data:text/javascript;base64,'+Buffer.from(reader.outputFiles[0].text).toString('base64'));
  input.values=await readMaterialGrid(input.config.sheetId,input.config.tab,process.env.MTM_MATERIALS_ACCESS_TOKEN??'',fetch,input.config.range??'A:K');
}
const seen=existsSync(checkpoint)?JSON.parse(readFileSync(checkpoint,'utf8')).seen:[];
const [cells,...rows]=input.values;
const headers=cells.map(c=>typeof c==='string'?c:c.text);
const result=detectHomework(headers,rows,input.config,seen);
// Output giữ cả jobs + seen, là receipt phục hồi nếu cập nhật checkpoint bị gián đoạn.
writeFileSync(output,JSON.stringify(result,null,2)+'\n',{encoding:'utf8',flag:'wx'});
writeFileSync(checkpoint+'.tmp',JSON.stringify({seen:result.seen,receipt:resolve(output)},null,2)+'\n','utf8');
renameSync(checkpoint+'.tmp',checkpoint);
console.log(`Đã tạo ${result.jobs.length} việc nháp; ${result.pending.length} dòng chờ xác minh. Chưa dựng/đăng.`);

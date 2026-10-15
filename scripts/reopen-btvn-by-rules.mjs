// Mặc định dry-run. Có thể dùng --materials <snapshot.json> để kiểm hoàn toàn offline.
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {openingBackfill} from './update-btvn-material.mjs';
export async function reopenByRules(selector,{live=false,materials,env=process.env,transport=fetch}={}){
 if(typeof selector!=='string'||selector!=='--all'&&!/^[a-z0-9-]{1,160}$/.test(selector))throw Error('INVALID_SELECTOR');
 let source=materials;
 if(source===undefined){
  const endpoint=env.BTVN_PUBLISH_URL,secret=env.BTVN_PUBLISH_SECRET;
  if(typeof endpoint!=='string'||!/^https:\/\/[a-z0-9]+\.supabase\.co\/functions\/v1\/mtm-btvn-publish$/.test(endpoint)||typeof secret!=='string'||secret.length<32||secret.length>1024)throw Error('PUBLISH_CONFIG_REQUIRED');
  // Đây chỉ là đọc metadata. Không gọi update_material trừ khi --live.
  const response=await transport(endpoint,{method:'POST',headers:{'Content-Type':'application/json','X-MTM-Publish-Secret':secret},body:JSON.stringify({action:'opening_materials',...(selector==='--all'?{}:{lesson_key:selector})}),redirect:'error',signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw Error('MATERIALS_READ_FAILED');source=await response.json();
 }
 if(!Array.isArray(source))throw Error('INVALID_MATERIALS');
 const selected=selector==='--all'?source:source.filter(m=>m.lessonCode===selector);
 if(!selected.length){if(selector!=='--all')throw Error('LESSON_NOT_FOUND');return {mode:live?'live':'dry-run',count:0,results:[]};}
 const results=await openingBackfill(selected,{live,env,transport});
 return {mode:live?'live':'dry-run',count:results.length,results};
}
export async function main(args=process.argv.slice(2)){
 const selector=args.shift();let live=false,snapshot;
 while(args.length){const arg=args.shift();if(arg==='--live'&&!live)live=true;else if(arg==='--materials'&&snapshot===undefined&&args[0]&&!args[0].startsWith('--'))snapshot=args.shift();else throw Error('INVALID_ARGUMENTS');}
 const materials=snapshot?JSON.parse(await readFile(snapshot,'utf8')):undefined;
 console.log(JSON.stringify(await reopenByRules(selector,{live,materials})));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(()=>{console.error('Chưa tính lại giờ mở. Dùng <lessonCode|--all> [--live] [--materials metadata.json]; kiểm snapshot hoặc cấu hình Edge. Không ghi bí mật vào log.');process.exitCode=1;});

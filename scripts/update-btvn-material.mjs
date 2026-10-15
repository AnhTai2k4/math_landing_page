// Mặc định chỉ kiểm cục bộ. Chỉ --live mới đọc cấu hình và gửi Edge.
import {build} from 'esbuild';
import {readFile} from 'node:fs/promises';
import {pathToFileURL,fileURLToPath} from 'node:url';

async function logic(){
 const bundle=await build({entryPoints:[fileURLToPath(new URL('../server/btvn/publish-handler.ts',import.meta.url))],bundle:true,write:false,platform:'neutral',format:'esm',target:'es2022',logLevel:'silent'});
 return import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
}
export async function updateMaterial(lessonCode,material,{live=false,env={},transport=fetch}={}){
 const payload={action:'update_material',lesson_key:lessonCode,material};
 const {createBtvnPublishHandler}=await logic();let validated=false;
 const secret='local-dry-run-no-credential-'.repeat(2);
 const handler=createBtvnPublishHandler({async rpc(action){if(action==='lookup')return {status:'da_dang'};validated=true;return {status:'updated'};},async upload(){throw Error('UPDATE_MUST_NOT_UPLOAD');}},secret);
 const response=await handler(new Request('https://dry-run.invalid',{method:'POST',headers:{'X-MTM-Publish-Secret':secret},body:JSON.stringify(payload)}));
 if(response.status!==200||!validated)throw Error('INVALID_MATERIAL_UPDATE');
 if(!live)return {mode:'dry-run',lesson_key:lessonCode,fields:Object.keys(material),written:false};
 const endpoint=env.BTVN_PUBLISH_URL,publishSecret=env.BTVN_PUBLISH_SECRET;
 if(typeof endpoint!=='string'||!/^https:\/\/[a-z0-9]+\.supabase\.co\/functions\/v1\/mtm-btvn-publish$/.test(endpoint)||typeof publishSecret!=='string'||publishSecret.length<32||publishSecret.length>1024)throw Error('PUBLISH_CONFIG_REQUIRED');
 const reply=await transport(endpoint,{method:'POST',headers:{'Content-Type':'application/json','X-MTM-Publish-Secret':publishSecret},body:JSON.stringify(payload),redirect:'error',signal:AbortSignal.timeout(120000)});
 if(!reply.ok)throw Error('MATERIAL_UPDATE_FAILED');
 const result=await reply.json();if(result?.status!=='updated')throw Error('MATERIAL_UPDATE_NOT_CONFIRMED');
 return {mode:'live',lesson_key:lessonCode,status:'updated',written:true};
}
export async function openingBackfill(materials,options={}){
 const bundle=await build({entryPoints:[fileURLToPath(new URL('../server/btvn/class-schedule.ts',import.meta.url))],bundle:true,write:false,platform:'neutral',format:'esm',logLevel:'silent'});
 const {classOpeningTimes}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
 if(!Array.isArray(materials)||!materials.length||new Set(materials.map(m=>m.lessonCode)).size!==materials.length)throw Error('INVALID_BACKFILL');
 // Kiểm toàn bộ trước khi gửi lần đầu, tránh cập nhật dở do đầu vào sai.
 const updates=materials.map(m=>({code:m.lessonCode,patch:{classOpensAt:classOpeningTimes(m)}}));
 for(const u of updates)await updateMaterial(u.code,u.patch);
 const results=[];for(const u of updates)results.push(await updateMaterial(u.code,u.patch,options));
 return results;
}
export async function main(args=process.argv.slice(2)){
 const live=args.includes('--live'),values=args.filter(x=>x!=='--live');
 if(args.filter(x=>x==='--live').length>1)throw Error('INVALID_ARGUMENTS');
 const options={live,env:live?process.env:{}};
 if(values[0]==='--backfill-openings'&&values.length===2){
  const materials=JSON.parse(await readFile(values[1],'utf8'));
  const results=await openingBackfill(materials,options);console.log(JSON.stringify({mode:live?'live':'dry-run',count:results.length,results}));return;
 }
 const code=values.shift(),patch={};if(!code||code.startsWith('--'))throw Error('LESSON_CODE_REQUIRED');
 for(let i=0;i<values.length;i+=2){
  if(!['--video','--handout'].includes(values[i])||!values[i+1]||values[i+1].startsWith('--'))throw Error('INVALID_ARGUMENTS');
  if(values[i]==='--handout')patch.handoutUrl=values[i+1];
  else {
   const u=new URL(values[i+1]);let id=null;
   if(u.hostname==='youtu.be')id=u.pathname.slice(1);
   else if(['youtube.com','www.youtube.com','m.youtube.com','youtube-nocookie.com','www.youtube-nocookie.com'].includes(u.hostname))id=u.pathname==='/watch'?u.searchParams.get('v'):/^\/(?:embed|shorts|live)\/([^/]+)$/.exec(u.pathname)?.[1];
   if(!id||!/^[\w-]{11}$/.test(id))throw Error('INVALID_VIDEO');
   patch.videoId=id;patch.videoUrl=values[i+1];
  }
 }
 if(!Object.keys(patch).length)throw Error('MATERIAL_REQUIRED');
 console.log(JSON.stringify(await updateMaterial(code,patch,options)));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(()=>{console.error('Chưa cập nhật. Kiểm mã bài, liên kết, dữ liệu lịch và cấu hình Edge; không ghi bí mật vào log.');process.exitCode=1;});

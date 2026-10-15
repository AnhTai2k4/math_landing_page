// Một buổi đã dựng/kiểm; mặc định chỉ kiểm local, không tải env/file bí mật.
import {readFile,stat} from 'node:fs/promises';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {build} from 'esbuild';

export async function withClassOpenings(payload){
 if(!payload?.material)throw Error('INVALID_MATERIAL');
 const bundle=await build({entryPoints:[fileURLToPath(new URL('../server/btvn/class-schedule.ts',import.meta.url))],bundle:true,write:false,platform:'neutral',format:'esm',logLevel:'silent'});
 const {classOpeningTimes}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
 return {...payload,material:{...payload.material,classOpensAt:classOpeningTimes(payload.material)}};
}

export async function validateLesson(payload){
 if(!payload||payload.action!=='publish'||Object.keys(payload).some(k=>!['action','kind','opensAt','closesAt','lesson_key','source_version','material','exam','assets','verification'].includes(k)))throw Error('INVALID_LESSON');
 const bundled=await build({entryPoints:[fileURLToPath(new URL('../server/btvn/publish-handler.ts',import.meta.url))],bundle:true,write:false,platform:'neutral',format:'esm',target:'es2022',logLevel:'silent'});
 const {createBtvnPublishHandler}=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
 let uploads=0,published=false;
 const secret='local-dry-run-no-credential-'.repeat(2);
 const handler=createBtvnPublishHandler({async rpc(action){if(action==='lookup')return {status:null};if(action!=='publish')throw Error('INVALID_ACTION');published=true;return {status:'da_dang'};},async upload(){uploads++;}},secret);
 const response=await handler(new Request('https://dry-run.invalid',{method:'POST',headers:{'X-MTM-Publish-Secret':secret},body:JSON.stringify(payload)}));
 if(response.status!==200||!published)throw Error('LESSON_REJECTED');
 return {lesson_key:payload.lesson_key,assets:uploads,questions:payload.exam.questions.length};
}

export async function publishLesson(payload,{live=false,env={},transport=fetch}={}){
 payload=await withClassOpenings(payload);
 const summary=await validateLesson(payload);
 if(!live)return {mode:'dry-run',...summary,written:false};
 const endpoint=env.BTVN_PUBLISH_URL,secret=env.BTVN_PUBLISH_SECRET;
 if(typeof endpoint!=='string'||!/^https:\/\/[a-z0-9]+\.supabase\.co\/functions\/v1\/mtm-btvn-publish$/.test(endpoint)||typeof secret!=='string'||secret.length<32||secret.length>1024)throw Error('PUBLISH_CONFIG_REQUIRED');
 // Không dùng service_role/JWT operator; server Edge giữ role BTVN riêng.
 const response=await transport(endpoint,{method:'POST',headers:{'Content-Type':'application/json','X-MTM-Publish-Secret':secret},body:JSON.stringify(payload),redirect:'error',signal:AbortSignal.timeout(120000)});
 if(!response.ok)throw Error('PUBLISH_FAILED');
 const result=await response.json();
 if(!['da_dang','already_published'].includes(result?.status))throw Error('PUBLISH_NOT_CONFIRMED');
 return {mode:'live',...summary,status:result.status,written:result.status==='da_dang'};
}

export async function main(args=process.argv.slice(2)){
 if(args.length<1||args.length>2||args[0].startsWith('--')||(args[1]!==undefined&&args[1]!=='--live'))throw Error('Dùng: node scripts/publish-btvn-lesson.mjs <LESSON_BTVN.json> [--live]');
 if((await stat(args[0])).size>48*1024*1024)throw Error('LESSON_TOO_LARGE');
 const payload=JSON.parse(await readFile(args[0],'utf8'));
 const result=await publishLesson(payload,{live:args[1]==='--live',env:args[1]==='--live'?process.env:{}});
 console.log(JSON.stringify(result));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 main().catch(()=>{console.error('Không nạp buổi: kiểm tệp JSON, validator/proof/hash và cấu hình Edge riêng. Không ghi chi tiết có thể chứa bí mật.');process.exitCode=1;});
}

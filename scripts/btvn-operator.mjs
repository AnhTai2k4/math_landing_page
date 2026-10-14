import {build} from 'esbuild';
import {mkdirSync,mkdtempSync,rmSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {resolve,join} from 'node:path';
export async function loadModule(file){
 mkdirSync('.qa-temp/dot-13',{recursive:true});const dir=mkdtempSync('.qa-temp/dot-13/operator-');
 try{const out=join(dir,'module.mjs');await build({entryPoints:[file],outfile:out,bundle:true,platform:'node',format:'esm',packages:'external',logLevel:'error'});return await import(pathToFileURL(resolve(out)).href);}finally{rmSync(dir,{recursive:true,force:true});}
}
export const option=(args,key)=>{const i=args.indexOf(key);if(i<0)return undefined;if(!args[i+1]||args[i+1].startsWith('--'))throw Error('Thiếu giá trị '+key);return args[i+1];};
export async function operatorRpc(name,args,transport=fetch,env=process.env){
 if(!env.SUPABASE_URL||!env.SUPABASE_SERVICE_ROLE_KEY)throw Error('Operator chưa nạp cấu hình');
 const url=new URL(env.SUPABASE_URL);if(url.protocol!=='https:')throw Error('Cần HTTPS');
 const response=await transport(url.origin+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY,'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw Error('RPC không thành công, HTTP '+response.status);
 return response.json();
}

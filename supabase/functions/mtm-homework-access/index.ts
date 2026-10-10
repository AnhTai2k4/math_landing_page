import {createClient} from 'npm:@supabase/supabase-js@2.117.3';
import {createHomeworkHandler} from './handler.ts';
// Only deployed server environment supplies the service credential; never in Vite or logs.
const url=Deno.env.get('SUPABASE_URL')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,publicKey=Deno.env.get('MTM_HOMEWORK_PUBLISHABLE_KEY')!;
const db=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
const origins=['https://www.minhthanhmath.vn','https://minhthanhmath.vn'];
if(Deno.env.get('MTM_HOMEWORK_LOCAL_QA')==='1')origins.push('http://127.0.0.1:5528','http://127.0.0.1:5529');
const handler=createHomeworkHandler({publishableKey:publicKey,origins,
 async networkKey(request){
  // Deployment acceptance must verify that Supabase overwrites this proxy header.
  const address=request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();if(!address||address.length>128)throw Error('Trusted network address unavailable');
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(service),{name:'HMAC',hash:'SHA-256'},false,['sign']);const digest=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode('mtm-hw-network:'+address));return [...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join('');
 },rpc:(name,args)=>db.rpc(name,args),
 async download(path){const r=await db.storage.from('mtm-homework').download(path);if(r.error||!r.data)throw Error('PDF unavailable');return r.data;}
});
Deno.serve(handler);

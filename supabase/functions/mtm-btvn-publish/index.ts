// CHƯA DEPLOY. handler.generated.js tạo bằng scripts/build-btvn-publish.mjs.
import {createClient} from 'npm:@supabase/supabase-js@2.117.3';
import {createBtvnPublishHandler} from './handler.generated.js';
const env=(name:string)=>{const value=Deno.env.get(name);if(!value)throw Error('Publisher configuration missing');return value;};
const jwt=env('MTM_BTVN_PUBLISH_ROLE_JWT');
// Không cho nhầm credential toàn quyền vào đường ghi của pipeline.
let claim;try{claim=JSON.parse(atob(jwt.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));}catch{throw Error('Restricted role credential required');}
if(claim.role!=='mtm_btvn_publisher'||!Number.isFinite(claim.exp)||claim.exp*1000<=Date.now())throw Error('Restricted role credential required');
const db=createClient(env('SUPABASE_URL'),env('MTM_HOMEWORK_PUBLISHABLE_KEY'),{global:{headers:{Authorization:`Bearer ${jwt}`}},auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
const sha=async(b:Uint8Array)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b))).map(x=>x.toString(16).padStart(2,'0')).join('');
Deno.serve(createBtvnPublishHandler({
 async rpc(action:string,payload:Record<string,unknown>){const result=await db.rpc('mtm_btvn_pipeline',{p_action:action,p_payload:payload});if(result.error)throw Error('Publisher RPC unavailable');return result.data;},
 async upload(path:string,bytes:Uint8Array,type:string,hash:string){
  const bucket=db.storage.from('mtm-btvn');const result=await bucket.upload(path,bytes,{contentType:type,upsert:false});
  if(!result.error)return;
  if(!['409','400'].includes(String(result.error.statusCode)))throw Error('Asset upload unavailable');
  const existing=await bucket.download(path);if(existing.error||!existing.data||await sha(new Uint8Array(await existing.data.arrayBuffer()))!==hash)throw Error('Asset collision');
 }
},env('MTM_BTVN_PUBLISH_SECRET')));

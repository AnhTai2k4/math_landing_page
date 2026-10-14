import {createHmac} from 'node:crypto';
import {isIP} from 'node:net';
import {createDurableHomeworkHandler} from '../server/btvn/durable-http';
import {allowedBtvnOrigin} from '../server/btvn/origin-policy';
import type {createSupabaseRepository} from '../server/btvn/supabase-transport';
type Req={method?:string;body?:unknown;headers:Record<string,string|string[]|undefined>};
type Res={setHeader:(key:string,value:string)=>void;status:(n:number)=>{json:(value:unknown)=>void}};
const header=(req:Req,key:string)=>typeof req.headers[key]==='string'?req.headers[key] as string:'';
/** Chỉ mount production sau Claude nghiệm thu. Không đọc env/kết nối khi import. */
export function createBtvnApi(getEnv=()=>process.env,loadRepository:()=>Promise<typeof createSupabaseRepository>=async()=> (await import('../server/btvn/supabase-transport')).createSupabaseRepository){return async function handler(req:Req,res:Res){
 res.setHeader('Cache-Control','no-store, private');res.setHeader('X-Robots-Tag','noindex, nofollow');
 const env=getEnv();
 if(env.MTM_BTVN_ENABLED!=='1'||env.VERCEL!=='1'||!env.SUPABASE_URL||!env.SUPABASE_SERVICE_ROLE_KEY||!env.MTM_HOMEWORK_PUBLISHABLE_KEY||!env.MTM_BTVN_NETWORK_SECRET||env.MTM_BTVN_NETWORK_SECRET.length<32)return res.status(503).json({message:'BTVN chưa mở trên máy chủ. Vui lòng chờ MTM xác nhận.'});
 try{
  const host=header(req,'host'),origin=header(req,'origin');
  if(!allowedBtvnOrigin(origin,env)||origin!==`https://${host}`)return res.status(403).json({message:'Không thể vào bài.'});
  if(req.method!=='POST')return res.status(405).json({message:'Chỉ nhận POST.'});
  const address=header(req,'x-vercel-forwarded-for').split(',')[0].trim(),networkSecret=env.MTM_BTVN_NETWORK_SECRET;
  if(!isIP(address)||!networkSecret)throw Error('Trusted proxy missing');
  const key=createHmac('sha256',networkSecret).update('mtm-btvn:'+address).digest('hex');
  const factory=await loadRepository();
  const repo=factory({SUPABASE_URL:env.SUPABASE_URL!,SUPABASE_SERVICE_ROLE_KEY:env.SUPABASE_SERVICE_ROLE_KEY!,MTM_HOMEWORK_PUBLISHABLE_KEY:env.MTM_HOMEWORK_PUBLISHABLE_KEY!,VERCEL:env.VERCEL,VERCEL_ENV:env.VERCEL_ENV,VERCEL_URL:env.VERCEL_URL},origin,key);
  const result=await createDurableHomeworkHandler(repo)({method:req.method??'',body:req.body,cookie:header(req,'cookie'),origin,host,secure:true});
  for(const [key,value] of Object.entries(result.headers))res.setHeader(key,value);
  return res.status(result.status).json(result.body);
 }catch{return res.status(503).json({message:'Chưa lưu được. Giữ trang mở và thử lại.'});}
};}
export default createBtvnApi();

import {createHmac} from 'node:crypto';
import {createDurableHomeworkHandler} from '../server/btvn/durable-http';
type Req={method?:string;body?:unknown;headers:Record<string,string|string[]|undefined>};
type Res={setHeader:(key:string,value:string)=>void;status:(n:number)=>{json:(value:unknown)=>void}};
const header=(req:Req,key:string)=>typeof req.headers[key]==='string'?req.headers[key] as string:'';
/** Chỉ mount production sau Claude nghiệm thu. Không đọc env/kết nối khi import. */
export default async function handler(req:Req,res:Res){
 res.setHeader('Cache-Control','no-store, private');res.setHeader('X-Robots-Tag','noindex, nofollow');
 if(process.env.MTM_BTVN_ENABLED!=='1'||process.env.VERCEL!=='1')return res.status(503).json({message:'BTVN chưa mở trên máy chủ. Vui lòng chờ MTM xác nhận.'});
 try{
  const host=header(req,'host'),origin=header(req,'origin');
  if(!['minhthanhmath.vn','www.minhthanhmath.vn'].includes(host)||origin!==`https://${host}`)return res.status(403).json({message:'Không thể vào bài.'});
  const address=header(req,'x-vercel-forwarded-for').split(',')[0].trim(),networkSecret=process.env.MTM_BTVN_NETWORK_SECRET;
  if(!address||address.length>128||!networkSecret||networkSecret.length<32)throw Error('Trusted proxy missing');
  const key=createHmac('sha256',networkSecret).update('mtm-btvn:'+address).digest('hex');
  const {createSupabaseRepository}=await import('../server/btvn/supabase-transport');
  const repo=createSupabaseRepository({SUPABASE_URL:process.env.SUPABASE_URL??'',SUPABASE_SERVICE_ROLE_KEY:process.env.SUPABASE_SERVICE_ROLE_KEY??'',MTM_HOMEWORK_PUBLISHABLE_KEY:process.env.MTM_HOMEWORK_PUBLISHABLE_KEY??''},origin,key);
  const result=await createDurableHomeworkHandler(repo)({method:req.method??'',body:req.body,cookie:header(req,'cookie'),origin,host,secure:true});
  for(const [key,value] of Object.entries(result.headers))res.setHeader(key,value);
  return res.status(result.status).json(result.body);
 }catch{return res.status(503).json({message:'Chưa lưu được. Giữ trang mở và thử lại.'});}
}

import {publicRankRow,validRankFilter} from '../server/btvn/rank-row';
type Req={method?:string;query?:Record<string,string|string[]|undefined>};
type Res={setHeader:(key:string,value:string)=>void;status:(n:number)=>{json:(value:unknown)=>void}};
export function createRankApi(getEnv=()=>process.env,transport:typeof fetch=fetch){return async(req:Req,res:Res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json; charset=utf-8');
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({message:'Chỉ nhận GET.'});}
 const env=getEnv();
 if(env.MTM_RANK_ENABLED!=='1')return res.status(200).json({enabled:false,rows:[]});
 const cohort=req.query?.khoi,kind=req.query?.loai;
 const cls=req.query?.lop;
 if(!validRankFilter(cohort,kind,cls))return res.status(400).json({message:'Bộ lọc không hợp lệ.'});
 try{
  if(!env.SUPABASE_URL||!env.SUPABASE_SERVICE_ROLE_KEY)throw Error('Missing config');
  const url=new URL(env.SUPABASE_URL);if(url.protocol!=='https:')throw Error('HTTPS required');
  const response=await transport(url.origin+'/rest/v1/rpc/mtm_btvn_leaderboard_class',{method:'POST',headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY,'Content-Type':'application/json'},body:JSON.stringify({p_cohort:cohort,p_kind:kind,p_class:cls??null}),signal:AbortSignal.timeout(8000)});
  if(!response.ok)throw Error('RPC failed');
  const data=await response.json();
  if(!Array.isArray(data)||data.length>10)throw Error('Invalid rows');
  // Ánh xạ rõ từng trường, không chuyển nguyên RPC ra công khai.
  const rows=data.map(r=>publicRankRow(r,10));
  res.setHeader('Cache-Control','public, max-age=0, s-maxage=300');
  return res.status(200).json({enabled:true,rows});
 }catch{return res.status(503).json({message:'Chưa tải được bảng xếp hạng. Vui lòng thử lại.'});}
};}
export default createRankApi();

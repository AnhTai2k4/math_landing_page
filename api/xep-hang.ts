type Req={method?:string;query?:Record<string,string|string[]|undefined>};
type Res={setHeader:(key:string,value:string)=>void;status:(n:number)=>{json:(value:unknown)=>void}};
export function createRankApi(getEnv=()=>process.env,transport:typeof fetch=fetch){return async(req:Req,res:Res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json; charset=utf-8');
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({message:'Chỉ nhận GET.'});}
 const env=getEnv();
 if(env.MTM_RANK_ENABLED!=='1')return res.status(200).json({enabled:false,rows:[]});
 const cohort=req.query?.khoi,kind=req.query?.loai;
 if(typeof cohort!=='string'||!['2K9','2K10','2K11','2K12','2K13','2K14'].includes(cohort)||typeof kind!=='string'||!['btvn-tuan','btvn-thang','kiem-tra-thang'].includes(kind))return res.status(400).json({message:'Khối hoặc loại bảng không hợp lệ.'});
 try{
  if(!env.SUPABASE_URL||!env.SUPABASE_SERVICE_ROLE_KEY)throw Error('Missing config');
  const url=new URL(env.SUPABASE_URL);if(url.protocol!=='https:')throw Error('HTTPS required');
  const response=await transport(url.origin+'/rest/v1/rpc/mtm_btvn_leaderboard',{method:'POST',headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY,'Content-Type':'application/json'},body:JSON.stringify({p_cohort:cohort,p_kind:kind,p_period:null}),signal:AbortSignal.timeout(8000)});
  if(!response.ok)throw Error('RPC failed');
  const data=await response.json();
  if(!Array.isArray(data)||data.length>10)throw Error('Invalid rows');
  // Ánh xạ rõ từng trường, không chuyển nguyên RPC ra công khai.
  const rows=data.map(r=>{
   if(!Number.isInteger(r.rank)||r.rank<1||r.rank>10||typeof r.fullName!=='string'||!r.fullName.trim()||r.fullName.length>160||typeof r.className!=='string'||r.className.length>100||typeof r.score!=='number'||!Number.isFinite(r.score)||r.score<0||r.score>10||!Number.isInteger(r.submitted)||!Number.isInteger(r.total)||r.total<1||r.submitted<0||r.submitted>r.total)throw Error('Invalid rank row');
   return {rank:r.rank,fullName:r.fullName,className:r.className,score:r.score,submitted:r.submitted,total:r.total};
  });
  res.setHeader('Cache-Control','public, max-age=0, s-maxage=300');
  return res.status(200).json({enabled:true,rows});
 }catch{return res.status(503).json({message:'Chưa tải được bảng xếp hạng. Vui lòng thử lại.'});}
};}
export default createRankApi();

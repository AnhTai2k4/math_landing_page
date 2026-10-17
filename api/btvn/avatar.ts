import {allowedBtvnOrigin} from '../../server/btvn/origin-policy';
import {handleAvatar,avatarError,avatarStatus,type AvatarRepository,type AvatarRecord} from '../../server/btvn/avatar-http';
type Req={method?:string;body?:unknown;headers:Record<string,string|string[]|undefined>};
type Res={setHeader:(key:string,value:string)=>void;status:(n:number)=>{json:(value:unknown)=>void}};
type Transport=(url:string,init:{method:string;headers:Record<string,string>;body:string;signal:AbortSignal})=>Promise<{ok:boolean;status:number;json:()=>Promise<unknown>}>;
const header=(req:Req,key:string)=>typeof req.headers[key]==='string'?req.headers[key] as string:'';
export const AVATAR_TIMEOUT_MS=8000;
/** Chỉ server gọi RPC bằng service role; khoá không bao giờ vào response.
 * Payload chỉ có phiên + ảnh; RPC tự suy học sinh từ phiên. */
export function supabaseAvatarRepository(url:string,key:string,transport:Transport):AvatarRepository{
  const rpc=async(name:string,args:Record<string,unknown>)=>{
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),AVATAR_TIMEOUT_MS);
    let ok=false,data:{code?:unknown}|null=null;
    // Hạn 8s gồm cả đọc body; mạng lỗi/hết giờ là 503.
    try{const response=await transport(new URL('/rest/v1/rpc/'+name,url).toString(),{method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(args),signal:controller.signal});
      ok=response.ok;data=await response.json().catch(()=>null) as {code?:unknown}|null;}
    catch{throw avatarError(503);}
    finally{clearTimeout(timer);}
    if(!ok)throw avatarError(avatarStatus(data?.code));
    return data as AvatarRecord;
  };
  return {
    read:session=>rpc('mtm_btvn_appearance_read',{p_session:session}),
    save:(session,revision,appearance,school,expectedProfileKey)=>rpc('mtm_btvn_appearance_save',{p_session:session,p_revision:revision,p_avatar:appearance.avatar,p_photo:appearance.photo,p_school:school,p_profile_key:expectedProfileKey}),
  };
}
/** Preview/production Vercel và cờ riêng ảnh. Thiếu cấu hình là 503, không giả lưu. */
export function createAvatarApi(getEnv=()=>process.env,transport:Transport=fetch as unknown as Transport){return async function handler(req:Req,res:Res){
  res.setHeader('Cache-Control','no-store, private');res.setHeader('X-Robots-Tag','noindex, nofollow');res.setHeader('Vary','Cookie');
  const env=getEnv();
  if(env.VERCEL!=='1'||env.MTM_BTVN_ENABLED!=='1'||env.MTM_AVATAR_ENABLED!=='1'||!env.SUPABASE_URL?.startsWith('https://')||!env.SUPABASE_SERVICE_ROLE_KEY)return res.status(503).json({message:'Ảnh đại diện chưa mở trên máy chủ.'});
  const host=header(req,'host'),origin=header(req,'origin');
  if(!allowedBtvnOrigin(origin,env)||origin!==`https://${host}`)return res.status(403).json({message:'Không thể lưu ảnh.'});
  const result=await handleAvatar(supabaseAvatarRepository(env.SUPABASE_URL!,env.SUPABASE_SERVICE_ROLE_KEY,transport),{method:req.method??'',body:req.body,cookie:header(req,'cookie'),origin,host,secure:true});
  for(const [key,value] of Object.entries(result.headers))res.setHeader(key,value);
  return res.status(result.status).json(result.body);
};}
export default createAvatarApi();

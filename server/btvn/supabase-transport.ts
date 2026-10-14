import {createClient} from '@supabase/supabase-js';
import {createHomeworkHandler} from '../../supabase/functions/mtm-homework-access/handler';
import {SupabaseHomeworkRepository} from './supabase-repository';
import {allowedBtvnOrigin} from './origin-policy';
/** Tên env đã có trong Edge Function. Không đọc env/secret khi import.
 * Claude chỉ gọi factory sau khi kiểm proxy và cấu hình server thực tế.
 * Chạy cùng handler Edge để network HMAC là của HS, không phải IP Vercel.
 * Mọi limiter nằm chung Postgres, không có bản RAM production. */
export function createSupabaseRepository(env:{SUPABASE_URL:string;SUPABASE_SERVICE_ROLE_KEY:string;MTM_HOMEWORK_PUBLISHABLE_KEY:string;VERCEL?:string;VERCEL_ENV?:string;VERCEL_URL?:string},origin:string,trustedNetworkKey:string){
  if(!env.SUPABASE_URL||!env.SUPABASE_SERVICE_ROLE_KEY||!env.MTM_HOMEWORK_PUBLISHABLE_KEY||! /^[0-9a-f]{64}$/.test(trustedNetworkKey))throw Error('Thiếu cấu hình server/proxy đã kiểm');
  if(!allowedBtvnOrigin(origin,env))throw Error('Origin chưa được duyệt');
  const db=createClient(env.SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  const handler=createHomeworkHandler({publishableKey:env.MTM_HOMEWORK_PUBLISHABLE_KEY,origins:[origin],networkKey:async()=>trustedNetworkKey,rpc:async(name,args)=>await db.rpc(name,args),download:async()=>{throw Error('Adapter BTVN không mở tải PDF');}});
  return new SupabaseHomeworkRepository({rpc:async(name,args)=>await db.rpc(name,args)},async body=>{
    const response=await handler(new Request(env.SUPABASE_URL+'/functions/v1/mtm-homework-access',{method:'POST',headers:{Origin:origin,apikey:env.MTM_HOMEWORK_PUBLISHABLE_KEY,'Content-Type':'application/json'},body:JSON.stringify(body)}));
    if(!response.ok)throw Error('Không thể vào bài. Hãy kiểm tra thông tin hoặc thử lại sau.');return response.json();
  },Date.now,async(path,seconds)=>{const result=await db.storage.from('mtm-btvn').createSignedUrl(path,seconds);if(result.error||!result.data)throw Error('Private asset unavailable');return result.data.signedUrl;});
}

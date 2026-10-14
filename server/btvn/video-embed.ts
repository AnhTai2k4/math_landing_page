/** Cache chỉ metadata công khai, không lưu thông tin học sinh. */
export function createVideoEmbedChecker(transport:typeof fetch=fetch,clock=Date.now){
 const cache=new Map<string,{at:number;value:boolean|null}>();
 return async(id:string):Promise<boolean|null>=>{
  if(!/^[a-zA-Z0-9_-]{11}$/.test(id))return null;
  const hit=cache.get(id);if(hit&&clock()-hit.at<3600000)return hit.value;
  let value:boolean|null=null;
  try{const res=await transport('https://www.youtube.com/oembed?url='+encodeURIComponent('https://www.youtube.com/watch?v='+id)+'&format=json',{signal:AbortSignal.timeout(2500),redirect:'error'});
   value=res.ok?true:[401,403,404].includes(res.status)?false:null;
  }catch{value=null;}
  if(cache.size>=2000)cache.delete(cache.keys().next().value!);
  cache.set(id,{at:clock(),value});return value;
 };
}
export const checkVideoEmbed=createVideoEmbedChecker();

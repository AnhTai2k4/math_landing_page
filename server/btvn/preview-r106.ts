/** Local-only synthetic acceptance server. Loaded only with BOTH opt-in flags. */
import {readFileSync,writeFileSync,renameSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import type {Connect} from 'vite';
import type {HomeworkService} from './service';
import {handleAvatar,avatarError,type AvatarRecord,type AvatarRepository} from './avatar-http';
export function r106PreviewApi(service:HomeworkService,target:string):Connect.NextHandleFunction {
 const path=target+'.profiles.json';
 const records:Record<string,AvatarRecord>=existsSync(path)?JSON.parse(readFileSync(path,'utf8')):{};
 const id=(session:string)=>{try{return createHash('sha256').update(service.studentIdentity(session)).digest('hex');}catch{throw avatarError(401);}};
 const persist=()=>{writeFileSync(path+'.tmp',JSON.stringify(records),'utf8');renameSync(path+'.tmp',path);};
 const store:AvatarRepository={async read(session){const key=id(session);if(!records[key]){records[key]={profileKey:randomUUID(),revision:0,appearance:{avatar:'orbit',photo:''},school:''};persist();}return structuredClone(records[key]);},async save(session,revision,appearance,school,expectedProfileKey){const key=id(session),record=await this.read(session);if(record.profileKey!==expectedProfileKey||record.revision!==revision)throw avatarError(409);const next={...record,revision:revision+1,appearance,school};records[key]=next;try{persist();}catch{records[key]=record;throw avatarError(503);}return structuredClone(next);}};
 return async(req,res,next)=>{
  const route=(req.url??'').split('?')[0];
  if(route==='/__preview/r106'&&req.method==='GET'){if(!/^(?:127\.0\.0\.1|localhost)(?::[0-9]+)?$/.test(req.headers.host??'')){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'});res.end(readFileSync(resolve('server/btvn/preview-r106.html'),'utf8'));return;}
  if(!['/api/btvn/avatar','/api/xep-hang','/api/xep-hang-cua-em'].includes(route))return next();
  const send=(status:number,body:unknown,headers:Record<string,string>={})=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store, private',Vary:'Cookie',...headers});res.end(JSON.stringify(body));};
  try{
   let raw='';for await(const chunk of req){raw+=chunk.toString();if(Buffer.byteLength(raw)>200000)return send(413,{message:'Yêu cầu quá lớn.'});}
   const body=raw?JSON.parse(raw):null;
   if(route==='/api/btvn/avatar'){const result=await handleAvatar(store,{method:req.method??'',body,cookie:req.headers.cookie,origin:req.headers.origin,host:req.headers.host??'localhost'});return send(result.status,result.body,result.headers);}
   // Rankings below are labelled synthetic fixtures, never imported from production.
   if(route==='/api/xep-hang')return send(200,{enabled:true,rows:Array.from({length:10},(_,i)=>({rank:i+1,fullName:'Học sinh thử '+String(i+1).padStart(2,'0'),className:'2K9 9+',score:Number((9.8-i*.2).toFixed(2)),submitted:2,total:3}))});
   const token=(req.headers.cookie??'').split(';').map(x=>x.trim()).find(x=>x.startsWith('mtm_btvn_demo='))?.slice(14)??'';
   try{const code=service.studentIdentity(token),work=service.repo.get(code)!;return send(200,{enabled:true,row:{rank:17,fullName:work.student.fullName,className:work.student.className,score:8.5,submitted:2,total:3}});}catch{return send(401,{message:'Đăng nhập tài khoản thử để xem.'});}
  }catch{return send(400,{message:'Yêu cầu không hợp lệ.'});}
 };
}

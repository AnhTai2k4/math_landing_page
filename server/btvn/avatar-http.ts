/** Ảnh đại diện theo tài khoản học sinh. Server suy học sinh từ cookie phiên;
 * client không bao giờ gửi/chọn studentId hay profileKey. Ảnh chỉ JPEG 192x192 nội tuyến. */
export const AVATARS=['orbit','spark','prism','wave'] as const;
export type AvatarId=typeof AVATARS[number];
export type Appearance={avatar:AvatarId;photo:string};
export type AvatarRecord={profileKey:string;revision:number;school:string;appearance:Appearance};
export interface AvatarRepository{read(session:string):Promise<AvatarRecord>;save(session:string,revision:number,appearance:Appearance,school:string,expectedProfileKey:string):Promise<AvatarRecord>}
export const PHOTO_MAX_CHARS=180000,PHOTO_SIZE=192,AVATAR_BODY_MAX=200000;
const COOKIE='mtm_btvn_demo',PREFIX='data:image/jpeg;base64,';
export class AvatarError extends Error{constructor(public status:number,message:string){super(message);}}
const MESSAGES:Record<number,string>={400:'Ảnh hoặc yêu cầu không hợp lệ.',401:'Phiên đã hết. Em đăng nhập lại.',403:'Không thể lưu ảnh.',405:'Chỉ nhận POST.',409:'Ảnh đã đổi ở thiết bị khác. Tải lại để tiếp tục.',413:'Ảnh quá lớn.',503:'Chưa lưu được ảnh. Em thử lại sau.'};
export const avatarError=(status:number)=>new AvatarError(status,MESSAGES[status]??MESSAGES[503]);
/** Mã lỗi Postgres/PostgREST → HTTP. Lỗi lạ là 503, không giả lưu thành công. */
export function avatarStatus(code:unknown){return code==='42501'?401:code==='40001'?409:code==='22023'||code==='23514'?400:503;}

/** JPEG baseline/progressive đúng 192x192: SOI, đi segment đến SOF, có SOS, kết thúc EOI. */
export function jpegSize(bytes:Uint8Array):{width:number;height:number}|null{
  const n=bytes.length;
  if(n<4||bytes[0]!==0xff||bytes[1]!==0xd8||bytes[n-2]!==0xff||bytes[n-1]!==0xd9)return null;
  let i=2,size:{width:number;height:number}|null=null;
  while(i<n){
    if(bytes[i]!==0xff)return null;
    while(i<n&&bytes[i]===0xff)i++;
    const marker=bytes[i++];
    if(marker===undefined||marker===0x00||marker===0xd8||marker===0xd9)return null;
    if(marker===0x01||(marker>=0xd0&&marker<=0xd7))continue;
    if(i+2>n)return null;
    const length=bytes[i]<<8|bytes[i+1];
    if(length<2||i+length>n)return null;
    if(marker>=0xc0&&marker<=0xcf&&![0xc4,0xc8,0xcc].includes(marker)){
      if(size||length<8)return null;
      const height=bytes[i+3]<<8|bytes[i+4],width=bytes[i+5]<<8|bytes[i+6],components=bytes[i+7];
      if(!components||length!==8+3*components)return null;
      size={width,height};
    }
    if(marker===0xda)return size;
    i+=length;
  }
  return null;
}
export function validPhoto(photo:unknown):photo is string{
  if(photo==='')return true;
  if(typeof photo!=='string'||photo.length>PHOTO_MAX_CHARS||!photo.startsWith(PREFIX))return false;
  const data=photo.slice(PREFIX.length);
  if(!data.length||data.length%4||! /^[A-Za-z0-9+/]+={0,2}$/.test(data))return false;
  const bytes=Buffer.from(data,'base64');
  if(bytes.toString('base64')!==data)return false;
  const size=jpegSize(bytes);
  return !!size&&size.width===PHOTO_SIZE&&size.height===PHOTO_SIZE;
}
export function validAppearance(value:unknown):value is Appearance{
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  const v=value as Record<string,unknown>;
  return Object.keys(v).sort().join(',')==='avatar,photo'&&AVATARS.includes(v.avatar as AvatarId)&&validPhoto(v.photo);
}
export const validSchool=(value:unknown):value is string=>typeof value==='string'&&value.length<=160&&!/[\u0000-\u001f\u007f-\u009f]/.test(value);
const validRecord=(value:unknown):value is AvatarRecord=>{
  const v=value as AvatarRecord|null;
  return !!v&&typeof v==='object'&&typeof v.profileKey==='string'&&/^[0-9a-f-]{36}$/.test(v.profileKey)&&Number.isInteger(v.revision)&&v.revision>=0&&validSchool(v.school)&&validAppearance(v.appearance);
};

export async function handleAvatar(repo:AvatarRepository,input:{method:string;body:unknown;cookie?:string;origin?:string;host:string;secure?:boolean}){
  const headers:Record<string,string>={'Cache-Control':'no-store, private','Content-Type':'application/json; charset=utf-8','Vary':'Cookie','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff'};
  try{
    if(input.method!=='POST'){headers.Allow='POST';throw avatarError(405);}
    if(!input.origin||input.origin!==`${input.secure?'https':'http'}://${input.host}`)throw avatarError(403);
    const body=input.body as Record<string,unknown>;
    if(!body||typeof body!=='object'||Array.isArray(body))throw avatarError(400);
    if(JSON.stringify(body).length>AVATAR_BODY_MAX)throw avatarError(413);
    const keys=Object.keys(body).sort().join(',');
    const read=body.action==='read'&&keys==='action';
    const save=body.action==='save'&&keys==='action,appearance,expectedProfileKey,revision,school';
    if(!read&&!save)throw avatarError(400);
    if(save&&(!Number.isInteger(body.revision)||(body.revision as number)<0||(body.revision as number)>2147483646||!validAppearance(body.appearance)||!validSchool(body.school)||typeof body.expectedProfileKey!=='string'||! /^[0-9a-f-]{36}$/.test(body.expectedProfileKey)))throw avatarError(400);
    const session=(input.cookie??'').split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='))?.slice(COOKIE.length+1)??'';
    if(!/^[0-9a-f]{64}$/.test(session))throw avatarError(401);
    const record=read?await repo.read(session):await repo.save(session,body.revision as number,{avatar:(body.appearance as Appearance).avatar,photo:(body.appearance as Appearance).photo},(body.school as string).normalize('NFC').trim().replace(/\s+/g,' '),body.expectedProfileKey as string);
    if(!validRecord(record))throw avatarError(503);
    return {status:200,headers,body:{profileKey:record.profileKey,revision:record.revision,school:record.school,appearance:{avatar:record.appearance.avatar,photo:record.appearance.photo}}};
  }catch(error){
    const status=error instanceof AvatarError?error.status:503;
    return {status,headers,body:{message:MESSAGES[status]??MESSAGES[503]}};
  }
}

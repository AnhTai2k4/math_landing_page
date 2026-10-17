// R106: ảnh đại diện theo tài khoản (phiên server), không theo thiết bị. Fixture giả, không dữ liệu thật.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {handleAvatar,validPhoto,jpegSize,avatarError,PHOTO_MAX_CHARS,type AvatarRepository,type AvatarRecord,type Appearance} from '../server/btvn/avatar-http';
import {createAvatarApi} from '../api/btvn/avatar';

// JPEG tối thiểu đúng cấu trúc (SOI, SOF0 3 kênh, SOS, EOI). Chỉ kiểm header; root có thể thay bằng ảnh 192px thật.
const jpeg=(w:number,h:number)=>Buffer.from([0xff,0xd8,0xff,0xc0,0x00,0x11,0x08,h>>8,h&255,w>>8,w&255,0x03,0x01,0x22,0x00,0x02,0x11,0x01,0x03,0x11,0x01,
  0xff,0xda,0x00,0x0c,0x03,0x01,0x00,0x02,0x11,0x03,0x11,0x00,0x3f,0x00,0x12,0x34,0xff,0xd9]);
const url=(bytes:Buffer)=>'data:image/jpeg;base64,'+bytes.toString('base64');
const PHOTO=url(jpeg(192,192));

assert.deepEqual(jpegSize(jpeg(192,192)),{width:192,height:192});
assert.equal(validPhoto(''),true);
assert.equal(validPhoto(PHOTO),true);
assert.equal(validPhoto(url(jpeg(191,192))),false,'sai kích thước');
assert.equal(validPhoto(url(jpeg(192,192).subarray(0,20))),false,'cắt cụt');
assert.equal(validPhoto(url(Buffer.concat([jpeg(192,192).subarray(0,21),Buffer.from([0xff,0xd9])]))),false,'thiếu SOS');
assert.equal(validPhoto(PHOTO.replace('image/jpeg','image/png')),false);
assert.equal(validPhoto('data:image/svg+xml;base64,'+Buffer.from('<svg/>').toString('base64')),false);
assert.equal(validPhoto('https://evil.example/a.jpg'),false);
assert.equal(validPhoto(PHOTO+' '),false);
assert.equal(validPhoto(PHOTO.slice(0,-2)+'=='),false,'base64 không chuẩn');
assert.equal(validPhoto('data:image/jpeg;base64,'+'A'.repeat(PHOTO_MAX_CHARS)),false,'quá trần');
assert.equal(validPhoto(null),false);

// Kho giả: phiên → học sinh; nhiều phiên cùng tài khoản (điện thoại + máy tính) dùng chung một dòng.
const hex=(c:string)=>c.repeat(64);
const PROFILE_ONE=randomUUID();
const PHONE=hex('a'),LAPTOP=hex('b'),OTHER=hex('c'),EXPIRED=hex('d');
const owner:Record<string,string>={[PHONE]:'hs-1',[LAPTOP]:'hs-1',[OTHER]:'hs-2'};
const rows=new Map<string,AvatarRecord>();
let calls:string[]=[];
const fixture:AvatarRepository={
  async read(session){calls.push(session);const id=owner[session];if(!id)throw avatarError(401);
    if(!rows.has(id))rows.set(id,{profileKey:id==='hs-1'?PROFILE_ONE:randomUUID(),revision:0,school:'',appearance:{avatar:'orbit',photo:''}});return structuredClone(rows.get(id)!);},
  async save(session,revision,appearance,school,expectedProfileKey){const current=await this.read(session),id=owner[session];
    if(current.profileKey!==expectedProfileKey||current.revision!==revision)throw avatarError(409);
    rows.set(id,{...current,revision:revision+1,appearance,school});return structuredClone(rows.get(id)!);},
};
const HOST='localhost:5173',ORIGIN='http://'+HOST;
const call=(body:unknown,session:string|undefined=PHONE,extra:Partial<Parameters<typeof handleAvatar>[1]>={})=>
  handleAvatar(fixture,{method:'POST',body,cookie:session===undefined?undefined:'theme=x; mtm_btvn_demo='+session,origin:ORIGIN,host:HOST,...extra});
const save=(revision:number,appearance:Appearance,session=PHONE)=>call({action:'save',expectedProfileKey:PROFILE_ONE,school:'',revision,appearance},session);

let r=await call({action:'read'},PHONE,{method:'GET'});
assert.equal(r.status,405);assert.equal(r.headers.Allow,'POST');
for(const h of ['Cache-Control','Vary','X-Robots-Tag'])assert.ok(r.headers[h]);
assert.match(r.headers['Cache-Control'],/no-store/);assert.match(r.headers['Cache-Control'],/private/);
assert.equal((await call({action:'read'},PHONE,{origin:undefined})).status,403,'thiếu Origin');
assert.equal((await call({action:'read'},PHONE,{origin:'http://evil.example'})).status,403,'CSRF');
assert.equal((await call({action:'read'},PHONE,{origin:'https://'+HOST})).status,403,'sai scheme');
calls=[];
assert.equal((await call({action:'read'},PHONE,{cookie:undefined})).status,401);
assert.equal((await call({action:'read'},'abc')).status,401);
assert.equal((await call({action:'read'},hex('A'))).status,401,'hex hoa không phải phiên');
assert.deepEqual(calls,[],'phiên sai dạng không chạm kho');
assert.equal((await call({action:'read'},EXPIRED)).status,401);

// Client không được chọn tài khoản/khoá hồ sơ.
for(const body of [{action:'read',studentId:'hs-2'},{action:'read',profileKey:randomUUID()},{action:'save',expectedProfileKey:PROFILE_ONE,school:'',revision:0,appearance:{avatar:'spark',photo:''},studentId:'hs-2'},
  {action:'save',expectedProfileKey:PROFILE_ONE,school:'',revision:0,appearance:{avatar:'spark',photo:'',profileKey:'x'}},{action:'save',expectedProfileKey:PROFILE_ONE,school:'',revision:-1,appearance:{avatar:'spark',photo:''}},
  {action:'save',expectedProfileKey:PROFILE_ONE,school:'',revision:1.5,appearance:{avatar:'spark',photo:''}},{action:'save',expectedProfileKey:PROFILE_ONE,appearance:{avatar:'spark',photo:''}},{action:'save',expectedProfileKey:PROFILE_ONE,school:'',revision:0,appearance:{avatar:'nope',photo:''}},
  {action:'save',expectedProfileKey:PROFILE_ONE,school:'',revision:0,appearance:{avatar:'spark',photo:'https://evil.example/a.jpg'}},{action:'delete'},[],null,'read'])
  assert.equal((await call(body)).status,400,JSON.stringify(body));
assert.equal((await call({action:'save',expectedProfileKey:PROFILE_ONE,school:'',revision:0,appearance:{avatar:'spark',photo:'x'.repeat(250000)}})).status,413);
assert.equal(rows.size,0,'không request lỗi nào tạo dòng');

// Đọc lần đầu tạo mặc định; hai phiên cùng tài khoản thấy cùng hồ sơ; tài khoản khác tách biệt.
const first=await call({action:'read'});assert.equal(first.status,200);
const key=(first.body as AvatarRecord).profileKey;assert.match(key,/^[0-9a-f-]{36}$/);
assert.deepEqual(first.body,{profileKey:key,revision:0,school:'',appearance:{avatar:'orbit',photo:''}});
r=await save(0,{avatar:'prism',photo:PHOTO});assert.equal(r.status,200);assert.equal((r.body as AvatarRecord).revision,1);
r=await call({action:'read'},LAPTOP);
assert.deepEqual(r.body,{profileKey:key,revision:1,school:'',appearance:{avatar:'prism',photo:PHOTO}},'phiên khác cùng tài khoản');
assert.equal((await save(0,{avatar:'wave',photo:''},LAPTOP)).status,409,'CAS chặn bản cũ');
assert.equal((await save(1,{avatar:'wave',photo:''},LAPTOP)).status,200);
assert.equal(((await call({action:'read'})).body as AvatarRecord).appearance.avatar,'wave');
const other=(await call({action:'read'},OTHER)).body as AvatarRecord;
assert.notEqual(other.profileKey,key);assert.deepEqual(other.appearance,{avatar:'orbit',photo:''});assert.equal(other.revision,0);

// Lỗi kho: kiểu → đúng status; lỗi lạ/kết quả lệch → 503, không giả thành công.
const broken=(fn:()=>Promise<unknown>):AvatarRepository=>({read:fn as any,save:fn as any});
const run=(repo:AvatarRepository)=>handleAvatar(repo,{method:'POST',body:{action:'read'},cookie:'mtm_btvn_demo='+PHONE,origin:ORIGIN,host:HOST});
assert.equal((await run(broken(async()=>{throw Error('db down');}))).status,503);
assert.equal((await run(broken(async()=>({profileKey:'x',revision:0,school:'',appearance:{avatar:'orbit',photo:''}})))).status,503);
assert.equal((await run(broken(async()=>({profileKey:randomUUID(),revision:0,appearance:{avatar:'orbit',photo:'https://x'}})))).status,503);
assert.ok(!JSON.stringify((await run(broken(async()=>{throw Error('secret-detail');}))).body).includes('secret'));

// API Vercel: cờ env, origin chính xác, payload RPC chỉ phiên + ảnh.
const PREVIEW='mtm-r106-test.vercel.app',SERVICE_KEY='service-role-fixture';
const ENV={VERCEL:'1',VERCEL_ENV:'preview',VERCEL_URL:PREVIEW,MTM_BTVN_ENABLED:'1',MTM_AVATAR_ENABLED:'1',SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_SERVICE_ROLE_KEY:SERVICE_KEY};
type Sent={url:string;headers:Record<string,string>;body:any;signal:AbortSignal};
const api=async(env:Record<string,string|undefined>,reply:(sent:Sent)=>{ok:boolean;status:number;data:unknown}|Promise<never>,req:{method?:string;body?:unknown;origin?:string;host?:string}={})=>{
  const sent:Sent[]=[],out:{status:number;body:unknown;headers:Record<string,string>}={status:0,body:null,headers:{}};
  const transport=async(u:string,init:{headers:Record<string,string>;body:string;signal:AbortSignal})=>{const s={url:u,headers:init.headers,body:JSON.parse(init.body),signal:init.signal};sent.push(s);
    const x=await reply(s);return {ok:x.ok,status:x.status,json:async()=>x.data};};
  await createAvatarApi(()=>env,transport as any)({method:req.method??'POST',body:req.body??{action:'read'},headers:{host:req.host??PREVIEW,origin:req.origin??'https://'+PREVIEW,cookie:'mtm_btvn_demo='+PHONE}},
    {setHeader:(k,v)=>{out.headers[k]=v;},status:n=>({json:v=>{out.status=n;out.body=v;}})});
  return {...out,sent};
};
const okRecord=(s:Sent)=>({ok:true,status:200,data:{profileKey:key,revision:s.body.p_revision===undefined?0:s.body.p_revision+1,school:s.body.p_school??'',appearance:{avatar:s.body.p_avatar??'orbit',photo:s.body.p_photo??''}}});
for(const flag of ['VERCEL','MTM_BTVN_ENABLED','MTM_AVATAR_ENABLED','SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY']){
  const g=await api({...ENV,[flag]:undefined},okRecord);assert.equal(g.status,503,flag);assert.equal(g.sent.length,0,flag+' không gọi DB');
}
assert.equal((await api({...ENV,MTM_AVATAR_ENABLED:'true'},okRecord)).status,503);
assert.equal((await api({...ENV,SUPABASE_URL:'http://fixture.supabase.co'},okRecord)).status,503);
for(const origin of ['https://evil.vercel.app','http://'+PREVIEW,'']){const g=await api(ENV,okRecord,{origin});assert.equal(g.status,403,origin);assert.equal(g.sent.length,0);}
assert.equal((await api(ENV,okRecord,{host:'other.vercel.app'})).status,403,'Origin khác Host');
assert.equal((await api(ENV,okRecord,{method:'GET'})).status,405);

let g=await api(ENV,okRecord);
assert.equal(g.status,200);assert.equal(g.sent[0].url,'https://fixture.supabase.co/rest/v1/rpc/mtm_btvn_appearance_read');
assert.deepEqual(g.sent[0].body,{p_session:PHONE});assert.ok(g.sent[0].signal instanceof AbortSignal);
assert.ok(!JSON.stringify(g.body).includes(SERVICE_KEY)&&!Object.values(g.headers).join().includes(SERVICE_KEY),'khoá không ra client');
g=await api(ENV,okRecord,{body:{action:'save',expectedProfileKey:PROFILE_ONE,school:'',revision:3,appearance:{avatar:'spark',photo:PHOTO}}});
assert.equal(g.status,200);assert.equal(g.sent[0].url.endsWith('/mtm_btvn_appearance_save'),true);
assert.deepEqual(Object.keys(g.sent[0].body).sort(),['p_avatar','p_photo','p_profile_key','p_revision','p_school','p_session']);
assert.deepEqual(g.sent[0].body,{p_session:PHONE,p_revision:3,p_avatar:'spark',p_photo:PHOTO,p_school:'',p_profile_key:PROFILE_ONE});
assert.equal((await api(ENV,okRecord,{body:{action:'save',expectedProfileKey:PROFILE_ONE,school:'',revision:0,appearance:{avatar:'spark',photo:''},studentId:'hs-2'}})).sent.length,0);
assert.equal((await api(ENV,()=>({ok:false,status:403,data:{code:'42501'}}))).status,401);
assert.equal((await api(ENV,()=>({ok:false,status:409,data:{code:'40001'}}),{body:{action:'save',expectedProfileKey:PROFILE_ONE,school:'',revision:0,appearance:{avatar:'wave',photo:''}}})).status,409);
assert.equal((await api(ENV,()=>({ok:false,status:400,data:{code:'23514'}}))).status,400);
assert.equal((await api(ENV,()=>({ok:false,status:500,data:{code:'XX000'}}))).status,503);
assert.equal((await api(ENV,()=>Promise.reject(Error('network')))).status,503);
assert.equal((await api(ENV,()=>({ok:true,status:200,data:null}))).status,503,'không giả lưu');
console.log('exams-r106-avatar: ok');

for(const school of [null,42,'a'.repeat(161),'Trường\u0000lạ'])assert.equal((await call({action:'save',expectedProfileKey:PROFILE_ONE,revision:2,appearance:{avatar:'wave',photo:''},school})).status,400);
const schoolSaved=await call({action:'save',expectedProfileKey:PROFILE_ONE,revision:2,appearance:{avatar:'wave',photo:''},school:'  Trường   thử nghiệm  '});assert.equal(schoolSaved.status,200);assert.equal((schoolSaved.body as AvatarRecord).school,'Trường thử nghiệm');assert.equal(((await call({action:'read'},LAPTOP)).body as AvatarRecord).school,'Trường thử nghiệm');assert.equal(((await call({action:'read'},OTHER)).body as AvatarRecord).school,'');

assert.equal((await call({action:'save',revision:0,expectedProfileKey:PROFILE_ONE,appearance:{avatar:'spark',photo:''},school:'Không truyền sang tài khoản khác'},OTHER)).status,409,'server rejects old form after account cookie changes even if revisions match');

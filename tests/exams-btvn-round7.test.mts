import assert from 'node:assert/strict';
import {createBtvnPublishHandler} from '../server/btvn/publish-handler';
import {hydratePrivateAssets} from '../server/btvn/private-assets';
import {pipelineFixture} from './btvn-pipeline-fixture';
import api from '../api/btvn';
const secret='fake-only-'.repeat(8),state=new Map<string,any>(),uploads=new Map<string,Uint8Array>();let calls=0;
const handler=createBtvnPublishHandler({async rpc(action,payload){calls++;if(action==='lookup')return state.get(payload.lesson_key as string)??{status:null};const result={status:action==='publish'?'da_dang':'loi',payload};state.set(payload.lesson_key as string,result);return result;},async upload(path,bytes){uploads.set(path,bytes);}},secret);
const send=(body:any,token=secret)=>handler(new Request('https://mock.invalid',{method:'POST',headers:{'X-MTM-Publish-Secret':token},body:JSON.stringify(body)}));
assert.equal((await send(pipelineFixture(),'wrong')).status,401);assert.equal(calls,0);
for(const mutation of [
 (f:any)=>f.verification.slots.pop(),(f:any)=>f.verification.slots.push(f.verification.slots[0]),
 (f:any)=>f.verification.slots[0].actual='A',(f:any)=>f.verification.slots[1].actual=false,
 (f:any)=>f.verification.slots.at(-1).actual='2.6',
 (f:any)=>f.verification.extractor_provider=f.verification.provider,
 (f:any)=>f.assets[0].sha256='0'.repeat(64),
 (f:any)=>f.assets[0].path='../leak.pdf',(f:any)=>f.assets=[],
 (f:any)=>f.exam.questionCount=4,(f:any)=>f.exam.durationMinutes=60,
]){const f=pipelineFixture();mutation(f);assert.equal((await send(f)).status,422);}
assert.equal(uploads.size,0);assert.equal(state.size,0);
const f=pipelineFixture(),published=await send(f);assert.equal(published.status,200);assert.equal((await published.json()).status,'da_dang');assert.equal(uploads.size,1);
assert.equal((await (await send(f)).json()).status,'already_published');
const changed=pipelineFixture();if(changed.exam.questions[0].kind==='mc')changed.exam.questions[0].answer='A';assert.equal((await (await send(changed)).json()).status,'already_published');
assert.equal((await (await send({...f,action:'error',error_code:'MATH_MISMATCH'})).json()).status,'already_published');
const error={...pipelineFixture(),lesson_key:'fake-error',material:{...f.material,lessonCode:'fake-error'},action:'error',error_code:'MATH_MISMATCH'};assert.equal((await (await send(error)).json()).status,'loi');
assert.equal((await (await send({...error,error_code:'SECRET=bad'})).json()).error_code,'PUBLISH_REJECTED');
const paths=state.get(f.lesson_key).payload.assets;let signed=0;
const hydrated=await hydratePrivateAssets(f.exam,paths,async(path,seconds)=>{assert.equal(seconds,9000);signed++;return 'https://storage.invalid/signed/'+path+'?token=fake';});
assert.equal(signed,1);assert.match(hydrated.sourcePdf!.url,/signed/);assert.ok(f.exam.sourcePdf!.url.startsWith('/exam-assets/'));
await assert.rejects(hydratePrivateAssets(f.exam,[{...paths[0],sha256:'0'.repeat(64)}],async()=>'https://storage.invalid/signed'));
await assert.rejects(hydratePrivateAssets(f.exam,paths,async()=>'http://storage.invalid/signed'));
// Điểm nối production chưa bật; không đọc secret hay gửi request ra ngoài.
const before=process.env.MTM_BTVN_ENABLED;delete process.env.MTM_BTVN_ENABLED;
try{let status=0;await api({headers:{}},{setHeader(){},status(n){status=n;return {json(){}};}});assert.equal(status,503);}finally{if(before!==undefined)process.env.MTM_BTVN_ENABLED=before;}
console.log('Đạt đợt 7: secret, validator, 6 ô đáp án/SHORT chuẩn hóa, tài sản/hash, immutable publish, lỗi, chữ ký 9000s, API mặc định đóng.');

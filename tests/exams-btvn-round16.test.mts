import {createRequire} from 'node:module';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pipelineFixture} from './btvn-pipeline-fixture';
import {SupabaseHomeworkRepository,type DurableSnapshot} from '../server/btvn/supabase-repository';
import {SIGNED_ASSET_SECONDS} from '../server/btvn/private-assets';
import {createAssetRenewal,mergeHomeworkSave,ASSET_RENEW_WINDOW_MS} from '../src/native/homework/asset-renewal';
const fixture=pipelineFixture();let now=Date.parse('2026-10-15T12:00:00+07:00');
const path=fixture.exam.sourcePdf!.url.slice(1),storage='btvn/fake/'+ 'a'.repeat(64)+'/test.pdf';
let snapshot:DurableSnapshot={revision:0,exam:fixture.exam,material:fixture.material,lessons:[fixture.material],work:{student:{studentCode:'fake',fullName:'GIẢ',phone:'',className:fixture.material.classNames[0]},drafts:[],receipts:[]}};
let calls:string[]=[],signed=0,conflict=false;
const repo=new SupabaseHomeworkRepository({async rpc(name,args){calls.push(name);
 if(name==='mtm_btvn_read')return {data:structuredClone(snapshot),error:null};
 if(name==='mtm_btvn_assets')return {data:[{path,sha256:fixture.exam.sourcePdf!.sha256,storage_path:storage,bytes:1,content_type:'application/pdf'}],error:null};
 if(name==='mtm_btvn_commit'){
  if(conflict){conflict=false;return {data:{ok:false},error:null};}
  assert.equal(args.p_revision,snapshot.revision);snapshot={...snapshot,revision:snapshot.revision+1,work:{...snapshot.work,drafts:args.p_drafts as any,receipts:args.p_receipts as any}};return {data:{ok:true},error:null};
 }throw Error(name);
}},async()=>({}),()=>now,async(p,seconds)=>{signed++;assert.equal(seconds,SIGNED_ASSET_SECONDS);return 'https://storage.invalid/'+p+'?token='+signed;});
const started=await repo.call('fake','start',fixture.lesson_key);assert.ok(started.assetsExpiresAt===now+SIGNED_ASSET_SECONDS*1000);
calls=[];signed=0;
const saved=await repo.call('fake','save',fixture.lesson_key,started.draft!.attemptId,{'mc-1':'D'});
assert.deepEqual(calls,['mtm_btvn_read','mtm_btvn_commit']);assert.equal(signed,0);assert.equal(saved.saveOnly,true);assert.equal(saved.exam,null);assert.equal(saved.lessons,undefined);assert.equal(saved.revision,snapshot.revision);assert.equal(saved.draft!.answers['mc-1'],'D');
const merged=mergeHomeworkSave(started,saved);assert.equal(merged.exam,started.exam);assert.equal(merged.lessons,started.lessons);assert.equal(merged.assetsExpiresAt,started.assetsExpiresAt);assert.equal(merged.draft,saved.draft);
assert.equal(mergeHomeworkSave({...started,lessonCode:'other'},saved).lessonCode,'other');
conflict=true;calls=[];await repo.call('fake','save',fixture.lesson_key,started.draft!.attemptId,{});assert.deepEqual(calls,['mtm_btvn_read','mtm_btvn_commit','mtm_btvn_read','mtm_btvn_commit']);assert.equal(signed,0);
calls=[];const submitted=await repo.call('fake','submit',fixture.lesson_key,started.draft!.attemptId,{'mc-1':'D'});assert.ok(calls.includes('mtm_btvn_assets'));assert.equal(submitted.saveOnly,undefined);assert.ok(submitted.exam);assert.equal(submitted.receipts.length,1);
calls=[];await repo.call('fake','select',fixture.lesson_key);assert.ok(calls.includes('mtm_btvn_assets'));
let renewals=0,release:()=>void=()=>{};
const renew=createAssetRenewal(()=>{renewals++;return new Promise<void>(r=>release=r);},()=>now);
const expiry=now+SIGNED_ASSET_SECONDS*1000;
await renew(expiry);await renew(expiry);await renew(undefined);assert.equal(renewals,0,'timer/tab hiện lại khi còn hạn không gọi state');
now=expiry-ASSET_RENEW_WINDOW_MS-1;await renew(expiry);assert.equal(renewals,0);
now++;const pending=renew(expiry);assert.equal(renewals,1);assert.equal(renew(expiry,true),pending);release();await pending;
await renew(expiry,true);assert.equal(renewals,1,'chống bão lỗi ảnh');
now+=30000;const imageError=renew(now+SIGNED_ASSET_SECONDS*1000,true);assert.equal(renewals,2,'ảnh lỗi gia hạn dù còn xa hạn');release();await imageError;
let retries=0;const retry=createAssetRenewal(async()=>{if(++retries===1)throw Error('offline');},()=>now);await assert.rejects(retry(now));now+=30000;await retry(now);assert.equal(retries,2);
const root=process.env.MTM_ROOT??process.cwd(),source=readFileSync(root+'/src/native/homework/HomeworkSession.tsx','utf8');
assert.match(source,/onErrorCapture/);assert.ok(source.includes('renewAssets.current(true)'));assert.ok(!source.includes('240000'));assert.ok(!source.includes('5 phút'));
const vercel=JSON.parse(readFileSync(root+'/vercel.json','utf8'));assert.deepEqual(vercel.regions,['sin1']);
console.log('Đạt đợt 16: save 2 RPC không ký ảnh, CAS retry, merge giữ ảnh, submit/select giữ state đầy đủ, renew đúng ngưỡng/lỗi/chống trùng và thử lại sau mất mạng, vùng sin1.');

// Thực thi handler lỗi ảnh thật và render lại sau khi URL ký được thay.
const require=createRequire(join(root,'package.json')),{buildSync}=require('esbuild');
const reactFixture=join(root,'tests/fixtures/room-react.mts');
const code=buildSync({entryPoints:[join(root,'src/native/exams/MtmSourceContent.tsx')],bundle:true,write:false,platform:'node',format:'cjs',jsx:'automatic',packages:'external',alias:{react:reactFixture,'react/jsx-runtime':reactFixture,'react-dom':reactFixture},loader:{'.css':'empty'},logLevel:'silent'}).outputFiles[0].text;
const mod={exports:{} as any};new Function('require','module','exports',code)(require,mod,mod.exports);
let failed:any; (globalThis as any).__mtmRoomRuntime={state(initial:any){failed??=initial();return [failed,(fn:any)=>{failed=fn(failed);}];}};
const segment={path:'fake.png',sha256:'a'.repeat(64),width:100,height:100,sourcePage:1,privateUrl:'https://storage.invalid/old'};
const render=()=>mod.exports.default({segments:[segment],assetBase:'/fake',label:'GIẢ',kind:'question'});
function find(tree:any,predicate:(node:any)=>boolean):any{if(!tree||typeof tree!=='object')return null;if(Array.isArray(tree))return tree.map(t=>find(t,predicate)).find(Boolean);return predicate(tree)?tree:find(tree.props?.children,predicate);}
const image=find(render(),n=>typeof n.props?.onError==='function');assert.ok(image);image.props.onError();assert.ok(find(render(),n=>n.props?.role==='alert'));
segment.privateUrl='https://storage.invalid/renewed';assert.ok(find(render(),n=>n.props?.src===segment.privateUrl));assert.ok(!find(render(),n=>n.props?.role==='alert'));
delete (globalThis as any).__mtmRoomRuntime;
console.log('Đạt phục hồi ảnh: handler onError thật báo lỗi, URL ký mới hiển thị lại ảnh.');

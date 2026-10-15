import assert from 'node:assert/strict';
import {createBtvnPublishHandler} from '../server/btvn/publish-handler';
import {pipelineFixture} from './btvn-pipeline-fixture';
const secret='local-fake-scope-test-'.repeat(4);
let saved:any, uploads=0;
const handler=createBtvnPublishHandler({async rpc(action,payload){
 if(action==='lookup')return {status:null};
 saved=payload;return {status:action==='publish'?'da_dang':'loi'};
},async upload(){uploads++;}},secret);
const send=(body:any)=>handler(new Request('https://fixture.invalid',{method:'POST',headers:{'X-MTM-Publish-Secret':secret},body:JSON.stringify(body)}));
for(const homeworkScopeSource of ['sheet','auto','whole_file']){
 const fixture=pipelineFixture();Object.assign(fixture.material,{homeworkScope:'Câu 15-35',homeworkScopeSource});
 assert.equal((await send(fixture)).status,200);
 assert.equal(saved.material.homeworkScope,'Câu 15-35');
 assert.equal(saved.material.homeworkScopeSource,homeworkScopeSource);
}
for(const extra of [
 {homeworkScope:'Câu 15-35'}, {homeworkScopeSource:'sheet'},
 {homeworkScope:'',homeworkScopeSource:'sheet'},
 {homeworkScope:'x'.repeat(301),homeworkScopeSource:'sheet'},
 {homeworkScope:'Câu 15-35',homeworkScopeSource:'guess'},
 {homeworkScope:null,homeworkScopeSource:null},
]){
 const fixture=pipelineFixture();Object.assign(fixture.material,extra);
 const before=uploads;assert.equal((await send(fixture)).status,422);assert.equal(uploads,before);
}
// Lỗi trước khi chọn phạm vi vẫn gửi được, không ghi provenance null.
const error={...pipelineFixture(),action:'error',error_code:'PIPELINE_GATE_FAILED',reason:'Phạm vi không đọc được; giữ bài'};
assert.equal((await send(error)).status,200);
assert.equal(saved.material.homeworkScope,undefined);
console.log('Đạt đợt 26: lưu phạm vi/provenance và chặn metadata phạm vi sai trước upload.');

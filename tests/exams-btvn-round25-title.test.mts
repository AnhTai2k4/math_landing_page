import assert from 'node:assert/strict';
import {createBtvnPublishHandler} from '../server/btvn/publish-handler';
const secret='local-fake-only-title-test-'.repeat(3),updates:any[]=[];
const handler=createBtvnPublishHandler({async rpc(action,payload){if(action==='lookup')return {status:'da_dang'};assert.equal(action,'update_material');updates.push(payload);return {status:'updated'};},async upload(){assert.fail('Không tải asset khi đổi tên');}},secret);
const request=(material:any,extra={})=>handler(new Request('https://fixture.invalid',{method:'POST',headers:{'X-MTM-Publish-Secret':secret},body:JSON.stringify({action:'update_material',lesson_key:'fake-title-25',material,...extra})}));
for(const titleSource of ['auto','sheet']){
 const material={title:'Phương trình lượng giác cơ bản',titleSource};
 assert.equal((await request(material)).status,200);
 assert.deepEqual(updates.at(-1),{lesson_key:'fake-title-25',material});
}
for(const titleSource of ['manual','',null,{},1])assert.equal((await request({title:'Tên bài học',titleSource})).status,422);
assert.equal((await request({title:'Tên bài học',titleSource:'auto'},{exam:{title:'Cấm đổi'}})).status,422);
assert.equal((await request({title:'Tên bài học',titleSource:'auto',questions:[]})).status,422);
assert.equal(updates.length,2);
console.log('ĐẠT đợt 25: cập nhật tên và titleSource, không đổi đề hoặc asset.');

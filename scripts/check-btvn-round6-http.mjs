// Kiểm HTTP tại máy với cấu hình và học sinh giả; tự đóng server, không gọi cloud.
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createServer} from 'vite';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const output=resolve('.qa-temp/round6');mkdirSync(output,{recursive:true});
const previous={demo:process.env.MTM_BTVN_DEMO,csv:process.env.MTM_BTVN_CSV};
process.env.MTM_BTVN_DEMO='1';process.env.MTM_BTVN_CSV=resolve(output,'ket-qua-gia.csv');
let server;
try{
  await build({entryPoints:['server/btvn/dev-plugin.ts'],bundle:true,platform:'node',format:'esm',packages:'external',outfile:resolve(output,'dev-plugin.mjs')});
  const {btvnDevPlugin}=await import(pathToFileURL(resolve(output,'dev-plugin.mjs')).href);
  server=await createServer({configFile:false,cacheDir:resolve(output,'vite-cache'),plugins:[btvnDevPlugin()],server:{host:'127.0.0.1',port:3026,strictPort:true},optimizeDeps:{noDiscovery:true}});
  await server.listen();
  const origin='http://127.0.0.1:3026';
  const call=async body=>{const response=await fetch(origin+'/api/btvn',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});return {response,data:await response.json()};};
  const classes=await call({action:'classes'});
  assert.equal(classes.response.status,200);assert.deepEqual(classes.data,{classNames:['LOP-TEST-12']});
  assert.match(classes.response.headers.get('cache-control'),/no-store/);assert.equal(classes.response.headers.get('set-cookie'),null);
  assert.equal((await call({action:'classes',studentId:'fake'})).response.status,400);
  const gate={fullName:'Học sinh thử Một',phone:'0900000001',className:classes.data.classNames[0]};
  const wrong=await call({action:'login',gate:{...gate,className:'LOP-TU-GO'}});
  assert.equal(wrong.response.status,401);assert.deepEqual(Object.keys(wrong.data),['message']);
  const valid=await call({action:'login',gate});assert.equal(valid.response.status,200);
  assert.equal(valid.data.className,'LOP-TEST-12');assert.equal(valid.data.demo,true);
  assert.match(valid.response.headers.get('set-cookie'),/HttpOnly/);
  assert.ok(!JSON.stringify(valid.data).includes(gate.phone));
  const code=await call({action:'login',gate:{studentCode:'HS-TEST-02'}});assert.equal(code.response.status,200);
  const receipt={at:new Date().toISOString(),fakeDataOnly:true,checks:['API trước login chỉ trả tên lớp giả','no-store, không cấp cookie khi đọc lớp','Từ chối payload thừa','Lớp tự gõ không khớp bị lỗi chung','Đăng nhập bằng tên/SĐT/lớp được chọn','Đăng nhập bằng mã vẫn đạt'],cloudConnected:false,browserVerified:false};
  writeFileSync(resolve(output,'HTTP-RECEIPT.json'),JSON.stringify(receipt,null,2)+'\n');
  console.log('Đạt HTTP đợt 6: 6 nhóm kiểm với lớp/học sinh giả; server tự đóng.');
}finally{
  await server?.close();
  for(const [key,value] of [['MTM_BTVN_DEMO',previous.demo],['MTM_BTVN_CSV',previous.csv]])if(value===undefined)delete process.env[key];else process.env[key]=value;
}

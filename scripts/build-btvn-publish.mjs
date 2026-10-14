// Bundle nhỏ, thuần logic validator/handler, không env/mạng/credential.
import {build} from 'esbuild';
await build({entryPoints:['server/btvn/publish-handler.ts'],outfile:'supabase/functions/mtm-btvn-publish/handler.generated.js',bundle:true,platform:'neutral',format:'esm',target:'es2022',treeShaking:true,logLevel:'warning'});
console.log('Đã dựng handler Edge từ validator nguồn; chưa deploy.');

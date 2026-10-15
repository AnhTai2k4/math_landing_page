// Chạy trên PC có node_modules. Sản phẩm thuần Node 22, không cần repo/esbuild trên VPS.
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
const here=dirname(fileURLToPath(import.meta.url));
const out=resolve(process.argv[2]??resolve(here,'../../.qa-temp/dot-17/validator.bundle.mjs'));
mkdirSync(dirname(out),{recursive:true});
await build({stdin:{contents:`import {validatePracticeExam} from './src/native/exams/data.ts';
try { let raw=''; for await (const chunk of process.stdin) raw+=chunk;
const result=validatePracticeExam(JSON.parse(raw)); process.stdout.write(JSON.stringify(result)); process.exitCode=result.valid?0:1;
} catch { process.stdout.write(JSON.stringify({valid:false,errors:['Validator unavailable or malformed input']})); process.exitCode=1; }`,resolveDir:resolve(here,'../..'),sourcefile:'btvn-validator-entry.mjs'},bundle:true,platform:'node',format:'esm',target:'node22',outfile:out,logLevel:'error'});
const bytes=readFileSync(out),receipt={sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,source:'src/native/exams/data.ts',generatedAt:new Date().toISOString()};
writeFileSync(out+'.receipt.json',JSON.stringify(receipt,null,2));
console.log(JSON.stringify(receipt));

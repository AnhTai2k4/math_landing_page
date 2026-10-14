// Reuse the exact production gate; no duplicate weakened schema.
import {build} from 'esbuild';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
const dir=mkdtempSync(join(tmpdir(),'btvn-validator-'));
try {
 await build({entryPoints:[fileURLToPath(new URL('../../src/native/exams/data.ts',import.meta.url))],bundle:true,platform:'node',format:'esm',outfile:join(dir,'gate.mjs'),logLevel:'silent'});
 const {validatePracticeExam}=await import(pathToFileURL(join(dir,'gate.mjs')).href);
 let raw='';for await(const chunk of process.stdin)raw+=chunk;
 const result=validatePracticeExam(JSON.parse(raw));process.stdout.write(JSON.stringify(result));
 process.exitCode=result.valid?0:1;
} catch {process.stdout.write(JSON.stringify({valid:false,errors:['Validator unavailable or malformed input']}));process.exitCode=1;}
finally{rmSync(dir,{recursive:true,force:true});}

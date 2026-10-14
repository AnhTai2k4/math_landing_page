import type {PracticeExam} from '../../src/native/exams/data';
export type PrivateAsset={path:string;sha256:string;storage_path:string;content_type:string;bytes:number};
/** Chỉ server gọi sau RPC kiểm session/lớp; chữ ký mới mỗi lần state. */
export async function hydratePrivateAssets(exam:PracticeExam,assets:PrivateAsset[],sign:(path:string,seconds:number)=>Promise<string>){
 if(!assets.length)return exam;
 const copy=structuredClone(exam),urls=new Map<string,string>();
 const seen=new Set<string>();
 for(const asset of assets){
  if(!/^btvn\/[a-z0-9-]{1,160}\/[a-f0-9]{64}\/[a-zA-Z0-9_/-]+\.(png|pdf)$/.test(asset.storage_path)||asset.storage_path.split('/').includes('..')||seen.has(asset.path))throw Error('Invalid private manifest');
  seen.add(asset.path);
 }
 // Ký song song để transport gom một lần createSignedUrls (58 lần tuần tự từng tốn 6-8 giây mỗi lượt tải).
 const signed=await Promise.all(assets.map(asset=>sign(asset.storage_path,300)));
 assets.forEach((asset,i)=>{const parsed=new URL(signed[i]);if(parsed.protocol!=='https:'||parsed.username||parsed.password)throw Error('Invalid signed asset');urls.set(asset.path,signed[i]);});
 const segment=(s:any)=>{const a=assets.find(a=>a.path===s.path&&a.sha256===s.sha256);if(!a)throw Error('Missing private fragment');s.privateUrl=urls.get(s.path);};
 for(const q of copy.questions)for(const s of [...q.sourceContent?.questions??[],...q.sourceContent?.solutions??[]])segment(s);
 for(const s of [...copy.sourceInstructions??[],...copy.solutionInstructions??[]])segment(s);
 for(const pdf of [copy.sourcePdf,copy.mtmDocuments?.questions,copy.mtmDocuments?.solutions])if(pdf){const path=pdf.url.replace(/^\//,'');if(!assets.some(a=>a.path===path&&a.sha256===pdf.sha256))throw Error('Missing private PDF');pdf.url=urls.get(path)!;}
 return copy;
}

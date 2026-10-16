import type {PracticeExam} from '../../src/native/exams/data';
/** Link ảnh đề sống 150 phút: đủ một lượt 120 phút kể cả khi em đọc lâu không lưu (300s cũ làm vỡ ảnh câu chưa mở). */
export const SIGNED_ASSET_SECONDS=9000;
export type PrivateAsset={path:string;sha256:string;storage_path:string;content_type:string;bytes:number};
export class PrivatePdfUnavailableError extends Error {constructor(){super('Missing private PDF');this.name='PrivatePdfUnavailableError';}}
/** Chỉ server gọi sau RPC kiểm session/lớp; chữ ký mới mỗi lần state. */
export async function hydratePrivateAssets(exam:PracticeExam,assets:PrivateAsset[],sign:(path:string,seconds:number)=>Promise<string>,options:{allowUnavailablePdfs?:boolean}={}){
 const copy=structuredClone(exam),references=new Map<string,{path:string;sha256:string}>(),urls=new Map<string,string>();
 delete copy.assetWarnings;
 const fragments=copy.questions.flatMap(q=>[...q.sourceContent?.questions??[],...q.sourceContent?.solutions??[]]).concat(copy.sourceInstructions??[],copy.solutionInstructions??[]);
 const questionDocument=copy.mtmDocuments?.questions,solutionDocument=copy.mtmDocuments?.solutions;
 const pdfs=[copy.sourcePdf,copy.mtmDocuments?.questions,copy.mtmDocuments?.solutions].filter((pdf):pdf is NonNullable<typeof pdf>=>!!pdf);
 const key=(ref:{path:string;sha256:string})=>ref.path+'\0'+ref.sha256;
 for(const fragment of fragments){delete fragment.privateUrl;delete fragment.privateUnavailable;references.set(key(fragment),fragment);}
 for(const pdf of pdfs){const ref={path:pdf.url.replace(/^\//,''),sha256:pdf.sha256};references.set(key(ref),ref);}
 // Chỉ ký tài sản còn được tham chiếu trên bản đề đã lọc. Manifest lời giải
 // không được tạo URL ở lượt chưa nộp, kể cả khi cùng RPC trả cả hai nhóm.
 const selected=[...references].flatMap(([id,ref])=>{
  const matches=assets.filter(asset=>asset.path===ref.path);
  const asset=matches.length===1&&matches[0].sha256===ref.sha256?matches[0]:undefined;
  if(!asset||!/^btvn\/[a-z0-9-]{1,160}\/[a-f0-9]{64}\/[a-zA-Z0-9_/-]+\.(png|pdf)$/.test(asset.storage_path)||asset.storage_path.split('/').includes('..'))return [];
  return [{id,asset}];
 });
 // Ký song song để batchSigner gom thành một request; lỗi một ảnh là cục bộ.
 await Promise.all(selected.map(async({id,asset})=>{
  try{const url=await sign(asset.storage_path,SIGNED_ASSET_SECONDS),parsed=new URL(url);
   if(parsed.protocol==='https:'&&!parsed.username&&!parsed.password)urls.set(id,url);
  }catch{ /* Giữ marker thiếu ảnh để frontend gia hạn và mở lại đúng câu. */ }
 }));
 for(const fragment of fragments){const url=urls.get(key(fragment));if(url)fragment.privateUrl=url;else fragment.privateUnavailable=true;}
 const warnings=new Set<string>();
 for(const pdf of pdfs){
  const url=urls.get(key({path:pdf.url.replace(/^\//,''),sha256:pdf.sha256}));
  if(url){pdf.url=url;continue;}
  if(!options.allowUnavailablePdfs)throw new PrivatePdfUnavailableError();
  warnings.add(pdf===solutionDocument?'Chưa tải được PDF lời giải. Kết quả và biên nhận vẫn được giữ.':'Chưa tải được PDF đề. Kết quả và biên nhận vẫn được giữ.');
  // Sau chấm, không để lỗi tài sản biến ACK thành 503 hoặc giữ URL public/cũ.
  if(pdf===copy.sourcePdf)delete copy.sourcePdf;
  if(pdf===questionDocument&&copy.mtmDocuments)delete (copy.mtmDocuments as Partial<NonNullable<PracticeExam['mtmDocuments']>>).questions;
  else if(pdf===solutionDocument&&copy.mtmDocuments)delete copy.mtmDocuments.solutions;
 }
 if(copy.mtmDocuments&&!copy.mtmDocuments.questions&&!copy.mtmDocuments.solutions)delete copy.mtmDocuments;
 if(warnings.size)copy.assetWarnings=[...warnings];
 return copy;
}

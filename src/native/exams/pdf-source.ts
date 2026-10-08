import {validSourcePdf,type PracticeExam} from './data';
export type QuestionPdf=NonNullable<PracticeExam['sourcePdf']>;
export async function fetchQuestionPdf(file:QuestionPdf,signal:AbortSignal,fetcher:typeof fetch=fetch):Promise<Uint8Array> {
  if(!validSourcePdf(file))throw Error('Thông tin bản đề chưa hợp lệ.');
  const response=await fetcher(file.url,{credentials:'omit',redirect:'error',signal,cache:'no-cache'});
  if(!response.ok||!/^application\/pdf(?:\s*;|$)/i.test(response.headers.get('content-type')??''))throw Error('Chưa tải được bản đề PDF hợp lệ.');
  const declared=response.headers.get('content-length');
  const encoding=response.headers.get('content-encoding');
  // Fetch exposes decoded body bytes. Encoded Content-Length describes wire bytes.
  if(declared&&(!encoding||encoding.toLowerCase()==='identity')&&(!/^\d+$/.test(declared)||Number(declared)!==file.bytes))throw Error('Dung lượng bản đề không khớp.');
  if(!response.body)throw Error('Bản đề trống.');
  const reader=response.body.getReader(),parts:Uint8Array[]=[];let size=0;
  try{for(;;){if(signal.aborted){await reader.cancel();throw Error('Đã hủy tải bản đề.');}const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>file.bytes||size>15*1024*1024){await reader.cancel();throw Error('Bản đề vượt dung lượng đã kiểm.');}parts.push(value);}}finally{reader.releaseLock();}
  if(size!==file.bytes)throw Error('Dung lượng bản đề không khớp.');
  const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}
  if(new TextDecoder().decode(bytes.subarray(0,5))!=='%PDF-')throw Error('Nội dung tải về không phải PDF.');
  const digest=await crypto.subtle.digest('SHA-256',bytes),hash=Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('');
  if(hash!==file.sha256.toLowerCase())throw Error('Bản đề không khớp nguồn đã kiểm.');
  return bytes;
}

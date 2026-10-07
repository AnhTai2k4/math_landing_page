export const READER_LIMIT=15*1024*1024;
export const ZOOM_LEVELS=[75,100,125,150,200] as const;
export type ReaderFile={id:string;path:string;sha256:string;bytes:number;pages:number;observedContents:string;sourceGrouping:number;sourceMetadataNeedsReview:boolean};
export class ReaderError extends Error{constructor(public code:string){super(code);}}
const fail=(code:string):never=>{throw new ReaderError(code);};
export function validateReaderFile(file:ReaderFile){
 if(!/^[a-f0-9]{24}$/.test(file.id)||! /^[a-f0-9]{64}$/.test(file.sha256)||file.path!=='/learning-documents/'+file.sha256+'.pdf'||!Number.isSafeInteger(file.bytes)||file.bytes<8||file.bytes>READER_LIMIT||!Number.isSafeInteger(file.pages)||file.pages<1||file.pages>200)fail('INVALID_MANIFEST');return file;
}
export function readerView(search:string,pages:number){
 const q=new URLSearchParams(search),p=q.get('trang'),z=Number(q.get('zoom')??100);
 return{page:p&&/^[1-9][0-9]{0,3}$/.test(p)&&q.getAll('trang').length===1?Math.min(Number(p),pages):1,zoom:q.getAll('zoom').length<=1&&ZOOM_LEVELS.includes(z as typeof ZOOM_LEVELS[number])?z:100};
}
export function readerPath(file:ReaderFile,page:number,zoom:number){
 validateReaderFile(file);if(!Number.isInteger(page)||page<1||page>file.pages||!ZOOM_LEVELS.includes(zoom as typeof ZOOM_LEVELS[number]))fail('INVALID_VIEW');const q=new URLSearchParams();if(page!==1)q.set('trang',String(page));if(zoom!==100)q.set('zoom',String(zoom));return'/tai-lieu/'+file.id+(q.size?'?'+q:'');
}
export async function fetchReaderBytes(file:ReaderFile,signal:AbortSignal,fetcher:typeof fetch=fetch):Promise<Uint8Array>{
 validateReaderFile(file);const response=await fetcher(file.path,{method:'GET',credentials:'omit',redirect:'error',signal,cache:'no-cache'});
 if(!response.ok)fail('FILE_UNAVAILABLE');if(!/^application\/pdf(?:\s*;|$)/i.test(response.headers.get('content-type')??''))fail('NOT_PDF');
 const contentLength=response.headers.get('content-length');if(contentLength&&(!/^\d+$/.test(contentLength)||Number(contentLength)>READER_LIMIT))fail('FILE_TOO_LARGE');
 if(!response.body)fail('EMPTY_FILE');const reader=response.body!.getReader();let size=0;const parts:Uint8Array[]=[];
 try{for(;;){if(signal.aborted){await reader.cancel();throw new DOMException('Aborted','AbortError');}const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>READER_LIMIT||size>file.bytes){await reader.cancel();fail('SIZE_MISMATCH');}parts.push(value);}}finally{reader.releaseLock();}
 if(size!==file.bytes)fail('SIZE_MISMATCH');const all=new Uint8Array(size);let cursor=0;for(const part of parts){all.set(part,cursor);cursor+=part.length;}
 if(new TextDecoder().decode(all.subarray(0,5))!=='%PDF-')fail('NOT_PDF');const digest=await crypto.subtle.digest('SHA-256',all);const hash=Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,'0')).join('');if(hash!==file.sha256)fail('HASH_MISMATCH');return all;
}
const messages:Record<string,string>={FILE_UNAVAILABLE:'Chưa tải được tệp. Kiểm tra mạng rồi thử lại; không cần rời website MTM.',NOT_PDF:'Phản hồi không phải PDF hợp lệ. Chưa mở tệp này.',FILE_TOO_LARGE:'Tệp vượt giới hạn cho phép của bản đọc.',SIZE_MISMATCH:'Dung lượng tệp không khớp bản nguồn đã kiểm. Chưa mở để tránh hiển thị sai.',HASH_MISMATCH:'Tệp không khớp bản gốc đã kiểm. Chưa hiển thị nội dung.',INVALID_MANIFEST:'Thông tin tệp chưa hợp lệ.',EMPTY_FILE:'Tệp không có dữ liệu.'};
export const readerMessage=(e:unknown)=>e instanceof ReaderError?(messages[e.code]??'Không mở được tài liệu.'):'Chưa đọc được tài liệu. Kiểm tra kết nối rồi thử lại.';

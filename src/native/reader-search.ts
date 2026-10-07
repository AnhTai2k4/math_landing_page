/** Search the existing text layer only. Never OCR, interpret formulas or modify the PDF. */
export const SEARCH_LIMITS={pages:200,pageCharacters:120000,totalCharacters:2000000,matches:200,query:100} as const;
export type SearchPage={page:number;text:string};
export type TextIndex={pages:SearchPage[];pageCount:number;unreadable:number[];clipped:number[]};
export type SearchHit={key:string;page:number;start:number;end:number;before:string;match:string;after:string};
export type SearchResult={hits:SearchHit[];limited:boolean;pagesWithMatches:number;query:string};
export interface TextDocument{numPages:number;getPage(n:number):Promise<{getTextContent():Promise<{items:unknown[]}>}>;}
function abort(signal:AbortSignal){if(signal.aborted)throw new DOMException('Search canceled','AbortError');}
async function bounded<T>(promise:Promise<T>,signal:AbortSignal,ms=12000):Promise<T>{
 abort(signal);return new Promise<T>((resolve,reject)=>{let settled=false;const finish=(ok:boolean,value:unknown)=>{if(settled)return;settled=true;clearTimeout(timer);signal.removeEventListener('abort',cancel);ok?resolve(value as T):reject(value);};const cancel=()=>finish(false,new DOMException('Search canceled','AbortError')),timer=setTimeout(()=>finish(false,new Error('TEXT_TIMEOUT')),ms);signal.addEventListener('abort',cancel,{once:true});promise.then(x=>finish(true,x),e=>finish(false,e));});
}
export async function buildTextIndex(doc:TextDocument,signal:AbortSignal,onProgress?:(n:number,total:number)=>void):Promise<TextIndex>{
 if(!Number.isInteger(doc.numPages)||doc.numPages<1||doc.numPages>SEARCH_LIMITS.pages)throw new Error('INVALID_PAGE_COUNT');
 const index:TextIndex={pages:[],pageCount:doc.numPages,unreadable:[],clipped:[]};let total=0;
 for(let page=1;page<=doc.numPages;page++){
  abort(signal);try{const p=await bounded(doc.getPage(page),signal),content=await bounded(p.getTextContent(),signal);abort(signal);if(!Array.isArray(content.items))throw new Error('INVALID_TEXT_LAYER');
   const capacity=Math.min(SEARCH_LIMITS.pageCharacters,SEARCH_LIMITS.totalCharacters-total);let text='',clipped=false;
   for(const item of content.items){if(!item||typeof item!=='object'||!('str'in item)||typeof item.str!=='string')continue;const part=item.str+' ';if(text.length+part.length>capacity){text+=part.slice(0,Math.max(0,capacity-text.length));clipped=true;break;}text+=part;}
   total+=text.length;index.pages.push({page,text:text.normalize('NFC')});if(clipped)index.clipped.push(page);
  }catch(e){abort(signal);index.unreadable.push(page);}
  onProgress?.(page,doc.numPages);await new Promise<void>(resolve=>setTimeout(resolve,0));
 }
 abort(signal);return index;
}
/** Index folded offsets back to the original UTF-16 text, including combining accents. */
export function foldText(text:string){
 let value='',position=0;const starts:number[]=[],ends:number[]=[];
 for(const character of text){const start=position,end=position+character.length;position=end;const folded=character.normalize('NFKD').replace(/\p{M}/gu,'').replace(/[đĐ]/g,'d').toLowerCase();
  if(!folded){if(ends.length)ends[ends.length-1]=end;continue;}
  for(const c of folded){const v=/\s/u.test(c)?' ':c;if(v===' '&&value.endsWith(' ')){ends[ends.length-1]=end;continue;}value+=v;for(let n=0;n<v.length;n++){starts.push(start);ends.push(end);}}
 }
 return{value,starts,ends};
}
export function searchIndex(index:TextIndex,query:string,limit=SEARCH_LIMITS.matches):SearchResult{
 if(typeof query!=='string'||query.length>SEARCH_LIMITS.query)throw new Error('QUERY_LENGTH');const needle=foldText(query).value.trim();if(needle.length<2)throw new Error('QUERY_TOO_SHORT');
 if(!Number.isInteger(limit)||limit<1||limit>SEARCH_LIMITS.matches)throw new Error('INVALID_RESULT_LIMIT');const hits:SearchHit[]=[];const matchedPages=new Set<number>();
 for(const page of index.pages){const folded=foldText(page.text);let at=0;
  while((at=folded.value.indexOf(needle,at))!==-1){if(hits.length>=limit)return{hits,limited:true,pagesWithMatches:matchedPages.size,query};const start=folded.starts[at],end=folded.ends[at+needle.length-1];hits.push({key:page.page+':'+start+':'+end,page:page.page,start,end,before:page.text.slice(Math.max(0,start-65),start),match:page.text.slice(start,end),after:page.text.slice(end,end+100)});matchedPages.add(page.page);at+=needle.length;}
 }
 return{hits,limited:false,pagesWithMatches:matchedPages.size,query};
}

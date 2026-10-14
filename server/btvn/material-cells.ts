export type MaterialCell=string|{text:string;links:string[]};
export const cellText=(cell:MaterialCell|undefined)=>typeof cell==='string'?cell:cell?.text??'';
export function cellLinks(cell:MaterialCell|undefined):string[]{
 const links=typeof cell==='string'?[cell]:cell?.links??[];
 return [...new Set(links.filter(link=>{try{const u=new URL(link);return u.protocol==='https:'&&!u.username&&!u.password;}catch{return false;}}))];
}
export const headerKey=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/gi,'d').toLowerCase().replace(/[^a-z0-9]/g,'');
export function normalizeMaterialClass(s:string){return s.trim().replace(/\s+/g,' ').replace(/^20(\d{2})(?=\s|$)/,'2K$1').replace(/^2k/i,'2K');}
export function materialDate(value:string,schoolYear?:{startYear:number;startMonth:number}){
 let date=value;
 const m=/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/.exec(value);
 if(m){const month=Number(m[2]),year=m[3]?Number(m[3]):schoolYear?schoolYear.startYear+(month<schoolYear.startMonth?1:0):NaN;date=`${year}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;}
 return /^\d{4}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(Date.parse(date))&&new Date(date).toISOString().slice(0,10)===date?date:null;
}
/** Pure decoder for includeGridData. No network, no roster access. */
export function decodeMaterialGrid(data:any):MaterialCell[][] {
 if(!Array.isArray(data?.sheets)||data.sheets.length!==1)throw Error('Cần đúng một tab học liệu');
 const rows:MaterialCell[][]=[];
 for(const block of data.sheets[0].data??[]){
  for(const [offset,row] of (block.rowData??[]).entries()){
   const target=rows[(block.startRow??0)+offset]??=[];
   for(const [column,cell] of (row.values??[]).entries()){
    const links=[cell.hyperlink,...(cell.textFormatRuns??[]).map((r:any)=>r.format?.link?.uri),...(cell.chipRuns??[]).map((r:any)=>r.chip?.richLinkProperties?.uri)].filter((x:unknown)=>typeof x==='string');
    target[(block.startColumn??0)+column]={text:String(cell.formattedValue??cell.effectiveValue?.stringValue??''),links};
   }
  }
 }
 return Array.from(rows,r=>r??[]);
}

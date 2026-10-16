export type MaterialCell=string|{text:string;links:string[]};
export const cellText=(cell:MaterialCell|undefined)=>typeof cell==='string'?cell:cell?.text??'';
export function cellLinks(cell:MaterialCell|undefined):string[]{
 const links=typeof cell==='string'?[cell]:cell?.links??[];
 return [...new Set(links.filter(link=>{try{const u=new URL(link);return u.protocol==='https:'&&!u.username&&!u.password;}catch{return false;}}))];
}
export const headerKey=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/gi,'d').toLowerCase().replace(/[^a-z0-9]/g,'');
export function normalizeMaterialClass(s:string){return s.trim().replace(/\s+/g,' ').replace(/^20(\d{2})(?=\s|$)/,'2K$1').replace(/^2k/i,'2K');}
export function materialDate(value:string,schoolYear?:{startYear:number;startMonth:number}){
 const text=value.trim(),compact=/^(\d{4})(\d{2})(\d{2})$/.exec(text);
 let year:number,month:number,day:number;
 if(compact){year=Number(compact[1]);month=Number(compact[2]);day=Number(compact[3]);}
 else{
  // Cùng quy tắc với material_date của pipeline: ngày lịch, không đoán năm hai số.
  if(!/^\d{1,4}(?:[/.,\s-]+\d{1,4}){1,2}$/.test(text))return null;
  const parts=text.split(/[/.,\s-]+/);
  if(parts.length===3&&parts[0].length===4){
   if(parts[1].length>2||parts[2].length>2)return null;
   [year,month,day]=parts.map(Number);
  }else{
   if(parts[0].length>2||parts[1].length>2||(parts.length===3&&parts[2].length!==4))return null;
   day=Number(parts[0]);month=Number(parts[1]);
   if(parts.length===3)year=Number(parts[2]);
   else{
    if(!schoolYear||!Number.isInteger(schoolYear.startYear)||!Number.isInteger(schoolYear.startMonth)||schoolYear.startMonth<1||schoolYear.startMonth>12)return null;
    year=schoolYear.startYear+(month<schoolYear.startMonth?1:0);
   }
  }
 }
 if(!Number.isInteger(year)||year<1||year>9999||month<1||month>12||day<1||day>31)return null;
 const date=`${String(year).padStart(4,'0')}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
 return Number.isFinite(Date.parse(date))&&new Date(date).toISOString().slice(0,10)===date?date:null;
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

import {decodeMaterialGrid,type MaterialCell} from './material-cells';
/** Chỉ tab và vùng học liệu đã cấu hình; gọi transport giả trong QA. */
export async function readMaterialGrid(sheetId:string,tab:string,accessToken:string,transport:typeof fetch,range='A:K'):Promise<MaterialCell[][]>{
 if(!/^[a-zA-Z0-9_-]+$/.test(sheetId)||!tab||!accessToken||!/^\$?[A-Z]+(?::\$?[A-Z]+)$/.test(range))throw Error('Thiếu cấu hình vùng học liệu');
 const ranges="'"+tab.replace(/'/g,"''")+"'!"+range;
 const query=new URLSearchParams({ranges,includeGridData:'true',fields:'sheets(data(startRow,startColumn,rowData(values(formattedValue,effectiveValue,hyperlink,chipRuns,textFormatRuns))))'});
 const response=await transport('https://sheets.googleapis.com/v4/spreadsheets/'+encodeURIComponent(sheetId)+'?'+query,{headers:{Authorization:'Bearer '+accessToken},redirect:'error',signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw Error('Không đọc được học liệu (HTTP '+response.status+')');
 return decodeMaterialGrid(await response.json());
}

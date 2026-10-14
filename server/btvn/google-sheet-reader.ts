/** Không đọc env, không log token/dòng; bên vận hành tiêm token và fetch trong phạm vi được phép. */
export async function readSheetValues(sheetId:string,tab:string,accessToken:string,transport:typeof fetch=fetch):Promise<string[][]>{
  if(!/^[a-zA-Z0-9_-]+$/.test(sheetId)||!tab||!accessToken)throw new Error('Thiếu cấu hình nguồn/quyền đọc');
  const range="'"+tab.replace(/'/g,"''")+"'";
  const response=await transport('https://sheets.googleapis.com/v4/spreadsheets/'+encodeURIComponent(sheetId)+'/values/'+encodeURIComponent(range)+'?valueRenderOption=FORMATTED_VALUE',{
    headers:{Authorization:'Bearer '+accessToken},redirect:'error',signal:AbortSignal.timeout(30000)
  });
  if(!response.ok)throw new Error('Không đọc được Sheet (HTTP '+response.status+')');
  const data=await response.json();
  if(!data||!Array.isArray(data.values)||!data.values.every((r:unknown)=>Array.isArray(r)&&r.every(v=>typeof v==='string'||typeof v==='number'||typeof v==='boolean')))throw new Error('Sai cấu trúc Sheet');
  return data.values.map((r:unknown[])=>r.map(v=>String(v)));
}

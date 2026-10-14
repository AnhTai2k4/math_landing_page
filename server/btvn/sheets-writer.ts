export type SheetTransport=(url:string,init:{method:string;headers:Record<string,string>;body:string})=>Promise<{ok:boolean}>;
/** Operator tiêm token, không tự lấy credential, không tạo tab hoặc đổi chia sẻ. */
export async function writeScorebookSheets(spreadsheetId:string,token:string,tabs:{className:string;values:string[][]}[],transport:SheetTransport){
 if(!/^[\w-]+$/.test(spreadsheetId)||!token)throw Error('Thiếu cấu hình Sheets');
 const result=await transport('https://sheets.googleapis.com/v4/spreadsheets/'+spreadsheetId+'/values:batchUpdate',{
  method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
  // RAW ngăn tên hoặc tiêu đề bắt đầu bằng = trở thành công thức.
  body:JSON.stringify({valueInputOption:'RAW',data:tabs.map(t=>({range:"'"+t.className.replace(/'/g,"''")+"'!A1",values:t.values}))})
 });
 if(!result.ok)throw Error('Chưa ghi được sổ điểm');
 return {tabs:tabs.length};
}

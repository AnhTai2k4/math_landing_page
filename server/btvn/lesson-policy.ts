/** Ngày học Việt Nam YYYY-MM-DD; T2/T3, T4/T5, T6/T7 chung bài, tách theo khối/chương trình. */
export function pairedLessonCode(programKey:string,date:string){
  if(!/^[a-z0-9-]+$/.test(programKey)||!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error('Mã/ngày không hợp lệ');
  const d=new Date(date+'T00:00:00Z');if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==date)throw new Error('Ngày không hợp lệ');
  const day=d.getUTCDay();if(day===0)throw new Error('Chủ nhật cần cấu hình bài riêng');
  if(day%2===0)d.setUTCDate(d.getUTCDate()-1);
  return programKey+'-'+d.toISOString().slice(0,10);
}

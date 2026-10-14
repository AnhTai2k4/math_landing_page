// Đợt 4 (claude/doc-de-mobile): quy tắc thuần cho công cụ đọc đề (không React, không bộ nhớ) để test được.

/** TH-02: các mức phóng của khung xem ảnh (bội của cỡ "vừa màn"). */
export const IMAGE_ZOOM_LEVELS=[1,1.5,2,3,4] as const;
/** Cỡ hiển thị tối thiểu so với ảnh gốc để chữ của đề đọc được (ảnh đề rộng 1562 px, chữ gốc khoảng 20 px). */
export const READABLE_SCALE=.55;
/** Mức phóng khi mở: nhỏ nhất đưa ảnh về từ READABLE_SCALE cỡ gốc trở lên; không biết cỡ gốc thì vừa màn. */
export function initialZoomLevel(areaWidth:number,naturalWidth:number|undefined):number{
  if(!naturalWidth||!(areaWidth>0))return 0;
  const fit=Math.min(areaWidth,naturalWidth);
  const index=IMAGE_ZOOM_LEVELS.findIndex(level=>fit*level/naturalWidth>=READABLE_SCALE);
  return index<0?IMAGE_ZOOM_LEVELS.length-1:index;
}

export type TableData={caption?:string;headers:string[];rows:string[][]};
/** TH-05: chỉ xoay bảng có từ 3 cột và mọi hàng đủ ô (không đoán dữ liệu thiếu). */
export function canTranspose(table:TableData):boolean{
  return table.headers.length>2&&table.rows.length>0&&table.rows.every(row=>row.length===table.headers.length);
}
/** TH-05: bảng biến thiên ngang thành dọc. Cột i của bảng cũ thành hàng i; ô góc giữ nguyên;
 * thứ tự khoảng/điểm, dấu và mũi tên giữ nguyên, không sinh hay bỏ ô nào. */
export function transposeTable(table:TableData):{headers:string[];rows:string[][]}{
  return {headers:[table.headers[0],...table.rows.map(row=>row[0])],rows:table.headers.slice(1).map((header,j)=>[header,...table.rows.map(row=>row[j+1])])};
}

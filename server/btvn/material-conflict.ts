/** So câu chữ ghi chú, giữ dấu tiếng Việt và dấu câu để không tự suy phạm vi. */
export const comparableHomeworkNote=(note:string|undefined)=>
 (note??'').normalize('NFC').trim().toLocaleLowerCase('vi');

export function materialConflict(lessonCode:string,sourceRows:[number,number],fields:string[]){
 return {row:sourceRows[0],lessonCode,code:'source_conflict' as const,sourceRows,fields,
  ...(fields.includes('homeworkNote')?{requiresScopeReview:true}:{}),
  reason:`Bài ${lessonCode} xung đột ${fields.join(', ')} ở dòng ${sourceRows.join(' và ')}; cần đối soát`};
}

/** Chỉ tên lớp từ cấu hình máy chủ; không đọc roster hay hồ sơ học sinh. */
export function publicClassNames(names:unknown):string[]{
  if(!Array.isArray(names)||names.length>200||names.some(name=>typeof name!=='string'||!name.trim()||name.length>100))throw Error('Cấu hình lớp chưa hợp lệ');
  return [...new Set<string>(names.map(name=>name.trim()))].sort((a,b)=>a.localeCompare(b,'vi'));
}

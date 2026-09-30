export type Registration={studentName:string;phone:string;grade:string;message:string};
export function normalizeRegistration(value:Registration){
 const data=Object.fromEntries(Object.entries(value).map(([k,v])=>[k,v.trim()])) as Registration;
 if(!data.studentName||!data.phone||!data.grade||!data.message)throw new Error('Vui lòng điền tên, số điện thoại, lớp và hình thức học.');
 if(!/^[+\d\s().-]+$/.test(data.phone))throw new Error('Số điện thoại chỉ gồm số và dấu phân cách thông thường.');
 data.phone=data.phone.replace(/[\s().-]/g,'').replace(/^\+84/,'0');
 if(!/^0[35789]\d{8}$/.test(data.phone))throw new Error('Nhập số di động Việt Nam 10 chữ số, bắt đầu bằng 0 hoặc +84.');
 if(!['10','11','12','dgnl','hsa','tsa','thcs'].includes(data.grade)||!['truc-tiep','online'].includes(data.message))throw new Error('Chọn lớp và hình thức học trong danh sách.');
 if(data.studentName.length>200)throw new Error('Họ tên tối đa 200 ký tự.');
 return data;
}
export function createRegistrationGate(){
 let pending=false;
 return async(value:Registration,send:(data:Registration)=>Promise<unknown>)=>{
  if(pending)return false;
  const data=normalizeRegistration(value);pending=true;
  try{await send(data);return true}finally{pending=false}
 };
}

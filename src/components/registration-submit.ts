export type Registration={studentName:string;phone:string;grade:string;message:string};
export function normalizeRegistration(value:Registration){
 const data=Object.fromEntries(Object.entries(value).map(([k,v])=>[k,v.trim()])) as Registration;
 if(!data.studentName||!data.phone||!data.grade||!data.message)throw new Error('Vui lòng điền tên, số điện thoại, lớp và hình thức học.');
 if(!/^[0-9]{10}$/.test(data.phone))throw new Error('Số điện thoại cần đủ 10 chữ số.');
 if(!['10','11','12','dgnl','thcs'].includes(data.grade)||!['truc-tiep','online'].includes(data.message))throw new Error('Chọn lớp và hình thức học trong danh sách.');
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
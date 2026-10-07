export const registrationContextEvent='mtm:registration-context';
type Context={grade?:string;interest?:string;group?:boolean};
export function applyRegistrationContext<T extends {grade:string;notes:string}>(prior:T,context:Context|undefined):T{
 if(!context)return prior;
 const grade=['thcs','10','11','12','hsa','tsa'].includes(context.grade||'')?context.grade:'';
 const note=context.interest==='Toán 10 & 11'?'Mình muốn tìm hiểu lớp Toán 10 hoặc 11.':typeof context.interest==='string'&&context.interest.length<=300?'Mình muốn tìm hiểu: '+context.interest+'.':'';
 return {...prior,grade:prior.grade||grade||'',notes:prior.notes||note};
}
export function requestRegistration(context:Context){window.dispatchEvent(new CustomEvent(registrationContextEvent,{detail:context}))}

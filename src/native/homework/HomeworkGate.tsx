import type {GateInput} from './btvn-contract';

type Identity = {fullName:string;phone:string;className:string};
type Props = {
  studentCode:string; identity:Identity; busy:boolean;
  classNames?:string[]; classesLoading?:boolean; classesError?:boolean; onReloadClasses?:()=>void;
  onCode:(value:string)=>void; onIdentity:(value:Identity)=>void;
  onLogin:(input:GateInput)=>void;
};

/** Hai form độc lập: trình duyệt chỉ kiểm các ô của thẻ đang gửi. */
export default function HomeworkGate({studentCode,identity,busy,classNames=[],classesLoading=false,classesError=false,onReloadClasses,onCode,onIdentity,onLogin}:Props){
  return <div className="btvn-gates" aria-label="Vào bài của lớp">
    <form className="btvn-gate mig-panel" aria-labelledby="btvn-code-title" onSubmit={event=>{event.preventDefault();if(!busy)onLogin({studentCode});}}>
      <h2 id="btvn-code-title">Có mã</h2>
      <label>Mã học sinh<input type="password" autoComplete="off" maxLength={160} required value={studentCode} onChange={event=>onCode(event.target.value)}/></label>
      <button type="submit" className="ep-primary" disabled={busy}>{busy?'Đang kiểm tra…':'Vào bài'}</button>
    </form>
    <form className="btvn-gate mig-panel" aria-labelledby="btvn-identity-title" onSubmit={event=>{event.preventDefault();if(!busy&&!classesLoading&&classNames.includes(identity.className))onLogin({...identity});}}>
      <h2 id="btvn-identity-title">Không có mã</h2>
      {([['fullName','Họ tên'],['phone','Số điện thoại (học sinh hoặc phụ huynh)']] as const).map(([key,label])=><label key={key}>{label}<input type={key==='phone'?'tel':'text'} autoComplete="off" maxLength={160} required value={identity[key]} onChange={event=>onIdentity({...identity,[key]:event.target.value})}/></label>)}
      <label>Lớp đang học<select required disabled={busy||classesLoading||!classNames.length} value={identity.className} onChange={event=>onIdentity({...identity,className:event.target.value})}><option value="">{classesLoading?'Đang tải lớp…':'Chọn lớp đang học'}</option>{classNames.map(name=><option key={name} value={name}>{name}</option>)}</select></label>
      {classesError&&<p role="status">Chưa tải được danh sách lớp. <button type="button" disabled={busy||classesLoading} onClick={onReloadClasses}>Thử tải lại</button></p>}
      {!classesLoading&&!classesError&&!classNames.length&&<p role="status">Chưa có lớp để chọn. Em liên hệ MTM.</p>}
      <button type="submit" className="ep-primary" disabled={busy||classesLoading||!classNames.length}>{busy?'Đang kiểm tra…':'Vào bài'}</button>
    </form>
  </div>;
}

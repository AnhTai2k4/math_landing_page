import type {Student} from './repository';
import {importRoster,normalizeName} from './roster';
// Chỉ module máy chủ được nhập tệp này. Hoàn toàn dữ liệu tổng hợp.
const headers=['Họ tên','SĐT HS','SĐT PH','Lớp','Ngày nghỉ','Ngày sinh'];
const rows=[
  ['Học sinh thử Một','0900000001','0900000011','LOP-TEST-12','','2010-01-01'],
  ['Học sinh thử Hai','','0900000002','LOP-TEST-12','','2010-01-02'],
  ['Học sinh thử Ba','0900000003','','LOP-TEST-12','','2010-01-03'],
  ['Học sinh thử Bốn NGHỈ HẲN','0900000004','','LOP-TEST-12','','2010-01-04'],
  ['Học sinh thử Năm','0900000005','','LOP-TEST-12','học 1 buổi rồi nghỉ','2010-01-05'],
];
// Registry giả cố định để phép thử có thể chạy lại; registry thật do Claude giữ ngoài repo.
const registry=Object.fromEntries(rows.slice(0,3).map((r,i)=>[JSON.stringify([normalizeName(r[0]),r[5],normalizeName(r[3])]),'HS-TEST-0'+(i+1)]));
export const demoStudents:Student[]=importRoster(headers,rows,{sheetId:'FAKE',tabs:[{tab:'FAKE',className:'LOP-TEST-12'}],columns:{fullName:'Họ tên',phone:'SĐT HS',parentPhone:'SĐT PH',className:'Lớp',leave:'Ngày nghỉ',birthDate:'Ngày sinh'}},'FAKE',registry).students;

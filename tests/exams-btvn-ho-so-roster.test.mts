import assert from 'node:assert/strict';
import {importRoster,type RosterConfig} from '../server/btvn/roster';
import {buildAttendanceRoster} from '../server/btvn/attendance-roster';
import {attendanceRpc} from '../server/btvn/publish-attendance';
import {makeSyncPayload} from '../scripts/btvn-roster-sync-core.mjs';

const headers=['Họ tên','SĐT','SĐT phụ huynh','Lớp','Nghỉ','Ngày sinh','Trường'];
const columns={fullName:'Họ tên',phone:'SĐT',parentPhone:'SĐT phụ huynh',className:'Lớp',leave:'Nghỉ',birthDate:'Ngày sinh',school:'Trường'};
const config:RosterConfig={sheetId:'fixture-school',columns,tabs:[{tab:'Tổng hợp',className:'2K9 9+',cohort:'2K9'}]};
const cells=['Học sinh tổng hợp','0900000001','','2K9 9+','','','  Trường   thử nghiệm  '];
const result=importRoster(headers,[cells],config,'Tổng hợp',{});
assert.equal(result.students[0].school,'Trường thử nghiệm');
const payload=makeSyncPayload({sheetId:config.sheetId,...result},{legacyReconciled:true,classGrades:{'2K9 9+':12}});
assert.equal(payload.students[0].school,'Trường thử nghiệm');
for(const value of ['Chưa cập nhật','Chua cap nhat','CHƯA CẬP NHẬT','  CHUA   CAP NHAT  ']){
 const placeholder=[...cells];placeholder[6]=value;
 assert.equal(importRoster(headers,[placeholder],config,'Tổng hợp',result.registry).students[0].school,'');
 assert.equal(makeSyncPayload({sheetId:config.sheetId,...result,students:[{...result.students[0],school:value}]},{legacyReconciled:true,classGrades:{'2K9 9+':12}}).students[0].school,'');
}
for(const school of ['x'.repeat(161),'Trường\u0007sai']){
 const bad=[...cells];bad[6]=school;
 assert.throws(()=>importRoster(headers,[bad],config,'Tổng hợp',result.registry));
 assert.throws(()=>makeSyncPayload({sheetId:config.sheetId,...result,students:[{...result.students[0],school}]},{legacyReconciled:true,classGrades:{'2K9 9+':12}}));
}
const withoutSchool={...config,columns:{fullName:'Họ tên',phone:'SĐT',parentPhone:'SĐT phụ huynh',className:'Lớp',leave:'Nghỉ',birthDate:'Ngày sinh'}};
assert.equal(importRoster(headers,[cells],withoutSchool,'Tổng hợp',result.registry).students[0].school,undefined,'Nguồn chưa xác minh cột trường vẫn nhập như cũ');

const attendanceMap={classes:{'2k9 9+':'2K9 9+'}};
const tabs={'Tổng hợp':[['Họ tên','SĐT','Trường đang học'],['Lớp (2K9 9+)'],['Học sinh tổng hợp','0900000001','Trường thử nghiệm']]};
const roster=buildAttendanceRoster(tabs,attendanceMap);
assert.equal(roster.rows[0].school,'Trường thử nghiệm');
assert.deepEqual(attendanceRpc({action:'sync_attendance',rows:roster.rows}),{name:'sync_attendance',payload:{p_payload:{rows:roster.rows},p_apply:false}});
assert.equal(buildAttendanceRoster({'Tổng hợp':[['Lớp (2K9 9+)'],['Học sinh tổng hợp','0900000001','C']]},attendanceMap).rows[0].school,undefined,'Không lấy nhầm cột điểm danh làm trường');
for(const school of [null,123,'x'.repeat(161),'Trường\u0085sai'])assert.throws(()=>attendanceRpc({action:'sync_attendance',rows:[{...roster.rows[0],school}]}));
assert.ok(attendanceRpc({action:'sync_attendance',rows:[{...roster.rows[0],school:''}]}));
console.log('ĐẠT hồ sơ roster: cột trường xác minh, chuẩn hóa, placeholder, payload, cổng quyền và nguồn không có trường.');

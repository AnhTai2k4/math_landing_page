import {buildAttendanceRoster} from '../../server/btvn/attendance-roster.ts';
import {parseAttendanceSheet} from '../../server/btvn/attendance-sheet.ts';
try {
 let raw='';for await(const chunk of process.stdin){raw+=chunk;if(raw.length>16*1024*1024)throw Error();}
 const {tabs,map}=JSON.parse(raw);
 const roster=buildAttendanceRoster(tabs,map,map.knownPhonesByCohort);
 const due=parseAttendanceSheet(tabs,map);
 process.stdout.write(JSON.stringify({roster,due}));
}catch{process.stderr.write('Không dựng được dữ liệu điểm danh.');process.exitCode=1;}

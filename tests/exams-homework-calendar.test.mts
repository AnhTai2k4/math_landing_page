import assert from 'node:assert/strict';
import {createHash,webcrypto} from 'node:crypto';
import {createRequire} from 'node:module';
import {join} from 'node:path';
import {createHomeworkDeadlineICS,hasHomeworkDeadline,homeworkDeadlineFilename} from '../src/native/homework/deadline-calendar';

const now=Date.parse('2026-10-16T10:00:00+07:00'),dueAt=Date.parse('2099-10-17T17:30:00+07:00');
const base={lessonCode:'BUOI-GIA-khong-xuat-ma-tho',dueAt,date:'2026-10-15'};
const unfold=(ics:string)=>ics.replace(/\r\n /g,'');
const uid=(ics:string)=>unfold(ics).match(/^UID:(.+)@minhthanhmath.vn$/m)![1];
let count=0;
const test=async(name:string,fn:()=>unknown)=>{await fn();console.log('ĐẠT '+(++count)+' '+name);};

await test('ICS trả ngay string, SHA-256 đồng bộ khớp Node/WebCrypto và giữ UID cũ cho Unicode/nhiều block',async()=>{
  for(const lessonCode of ['',base.lessonCode,'Buổi GIẢ 📐 tiếng Việt','x'.repeat(32),'x'.repeat(55),'x'.repeat(64),'x'.repeat(120),'x'.repeat(1000)]){
    const input={...base,lessonCode},ics=createHomeworkDeadlineICS(input,now);
    assert.equal(typeof ics,'string');assert.equal((ics as any)?.then,undefined);
    assert.equal(uid(ics),createHash('sha256').update(JSON.stringify([lessonCode,dueAt])).digest('hex'));
    const digest=await webcrypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([lessonCode,dueAt])));
    assert.equal(uid(ics),Buffer.from(digest).toString('hex'));
    assert.equal(uid(ics),uid(createHomeworkDeadlineICS(input,now+1000)));
  }
  assert.notEqual(uid(createHomeworkDeadlineICS(base,now)),uid(createHomeworkDeadlineICS({...base,dueAt:dueAt+60000},now)));
  assert.notEqual(homeworkDeadlineFilename(base),homeworkDeadlineFilename({...base,lessonCode:base.lessonCode+'-khac'}));
  assert.notEqual(homeworkDeadlineFilename(base),homeworkDeadlineFilename({...base,dueAt:dueAt+60000}));
  assert.match(homeworkDeadlineFilename(base),/^MTM-han-BTVN-[a-f0-9]{24}\.ics$/);
});

await test('Hạn đúng UTC, kết thúc sau một phút, nhắc 15 phút và SUMMARY theo buổi thay vì tiêu đề riêng',()=>{
  const ics=createHomeworkDeadlineICS(base,now),plain=unfold(ics);
  assert.match(plain,/DTSTART:20991017T103000Z\r\n/);assert.match(plain,/DTEND:20991017T103100Z\r\n/);
  assert.match(plain,/SUMMARY:Hạn BTVN MTM · buổi Thứ Năm\\, 15\/10\/2026\r\n/);
  assert.match(plain,/BEGIN:VALARM\r\nTRIGGER:-PT15M\r\nACTION:DISPLAY\r\nDESCRIPTION:Hạn nộp BTVN MTM\r\nEND:VALARM/);
  assert.equal((plain.match(/BEGIN:VEVENT/g)||[]).length,1);assert.equal((plain.match(/BEGIN:VALARM/g)||[]).length,1);
  assert.doesNotMatch(plain,/RRULE|ATTENDEE|ORGANIZER/);assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
  for(const line of ics.split('\r\n'))assert.ok(new TextEncoder().encode(line).length<=75);
});

await test('Không xuất mã buổi thô, tên, lớp, điểm, mã HS hoặc URL riêng, kể cả chèn dòng ICS',()=>{
  const input={...base,lessonCode:'MA-RIENG\r\nATTENDEE:private@example.invalid',title:'TIÊU ĐỀ LỚP RIÊNG',fullName:'NGƯỜI HỌC GIẢ',className:'LỚP RIÊNG',studentCode:'HS-GIA',score:9,phone:'0900000000',materialUrl:'https://private.invalid/file?token=FAKE'};
  const ics=unfold(createHomeworkDeadlineICS(input,now)),filename=homeworkDeadlineFilename(input);
  for(const value of [input.lessonCode,input.title,input.fullName,input.className,input.studentCode,input.phone,input.materialUrl,'private@example.invalid']){assert.ok(!ics.includes(value));assert.ok(!filename.includes(value));}
  assert.match(ics,/URL:https:\/\/www.minhthanhmath.vn\/btvn\r\n/);assert.equal((ics.match(/URL:/g)||[]).length,1);
  assert.equal((ics.match(/BEGIN:VEVENT/g)||[]).length,1);
});

await test('Từ chối hạn không thật, ngày buổi hỏng và năm không đủ chỗ cho DTEND',()=>{
  for(const value of [null,undefined,NaN,Infinity,-Infinity,now,now-1,dueAt+0.5,Date.UTC(10000,0,1),Date.UTC(9999,11,31,23,59,59)]){
    assert.equal(hasHomeworkDeadline(value,now),false);assert.throws(()=>createHomeworkDeadlineICS({...base,dueAt:value as any},now));
  }
  for(const date of ['2026-02-30','2026-13-01','2026-10-15\r\nATTENDEE:x','not-a-date'])assert.throws(()=>createHomeworkDeadlineICS({...base,date},now),/Ngày buổi học/);
  for(const stamp of [NaN,Infinity,-1,now+0.5])assert.throws(()=>createHomeworkDeadlineICS(base,stamp));
  // Hợp đồng cũ không có date vẫn tạo được tệp, nhãn không tự nhận đó là ngày buổi.
  assert.ok(!unfold(createHomeworkDeadlineICS({lessonCode:base.lessonCode,dueAt},now)).includes(' · buổi '));
});

const root=process.env.MTM_ROOT!,require=createRequire(join(root,'package.json'));
const {buildSync}=require('esbuild'),React=require('react');
let slots:any[]=[],cursor=0;
const hooks={useState:(initial:any)=>{const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],(next:any)=>{slots[i]=typeof next==='function'?next(slots[i]):next;}];},useEffect(){}};
const compiled=buildSync({entryPoints:[join(root,'src/native/homework/LessonCards.tsx')],bundle:true,write:false,platform:'node',format:'cjs',jsx:'automatic',packages:'external',loader:{'.css':'empty'},logLevel:'silent'}).outputFiles[0].text;
const mod={exports:{} as any};new Function('require','module','exports',compiled)((id:string)=>id==='react'?{...React,...hooks}:id.endsWith('.css')?{}:require(id),mod,mod.exports);
const Cards=mod.exports.default;
const lesson={...base,classNames:['Lớp GIẢ'],title:'Tiêu đề riêng GIẢ',videoId:null,materialUrl:null,handoutUrl:null,homeworkUrl:null,bestScore:null,late:null,submittedAt:null,available:true};
const text=(tree:any):string=>tree==null||typeof tree==='boolean'?'':Array.isArray(tree)?tree.map(text).join(''):typeof tree==='object'?text(tree.props?.children):String(tree);
const find=(tree:any,predicate:(node:any)=>boolean):any=>!tree||typeof tree!=='object'?null:Array.isArray(tree)?tree.map(n=>find(n,predicate)).find(Boolean):predicate(tree)?tree:find(tree.props?.children,predicate);

await test('Click tải chạy đồng bộ khi link đã gắn DOM, giữ Blob 60 giây, chỉ báo đã yêu cầu tải',async()=>{
  const original={document:globalThis.document,create:URL.createObjectURL,revoke:URL.revokeObjectURL,timeout:globalThis.setTimeout,fetch:globalThis.fetch};
  try{
    const sequence:string[]=[],timers:{fn:()=>void;delay:number}[]=[],revoked:string[]=[];let anchor:any,blob:Blob|undefined;
    URL.createObjectURL=(value:any)=>{blob=value;sequence.push('url');return 'blob:fake-calendar';};URL.revokeObjectURL=(url:string)=>{revoked.push(url);};
    globalThis.setTimeout=((fn:()=>void,delay:number)=>{timers.push({fn,delay});sequence.push('timer');return 0;}) as any;
    globalThis.fetch=()=>{throw Error('Calendar không được gọi mạng');};
    globalThis.document={createElement(tag:string){assert.equal(tag,'a');sequence.push('create');anchor={attached:false,click(){assert.equal(this.attached,true);sequence.push('click');},remove(){this.attached=false;sequence.push('remove');}};return anchor;},body:{appendChild(link:any){assert.equal(link,anchor);link.attached=true;sequence.push('append');}}} as any;
    slots=[];const draw=()=>{cursor=0;return Cards({lessons:[lesson],busy:false,onHomework(){}});};
    const files=find(draw(),n=>n.props?.className==='btvn-files'),calendarButton=find(files,n=>n.type==='button'&&text(n)==='Nhắc lịch hạn nộp');assert.match(calendarButton.props.className,/btvn-btn-subtle/);
    const handler=calendarButton.props.onClick;
    assert.equal(handler(),undefined,'Handler không trả Promise hoặc chờ microtask');
    assert.deepEqual(sequence,['url','create','append','click','remove','timer']);assert.equal(anchor.href,'blob:fake-calendar');assert.equal(anchor.hidden,true);assert.equal(anchor.download,homeworkDeadlineFilename(lesson));
    assert.equal(timers.length,1);assert.equal(timers[0].delay,60000);assert.deepEqual(revoked,[]);
    const status=text(find(draw(),n=>n.props?.role==='status'));assert.match(status,/^Đã yêu cầu tải tệp lịch\./);assert.doesNotMatch(status,/Đã tạo|đã cài|đã thêm|sẽ nhắc/i);assert.match(status,/ứng dụng lịch quyết định/);
    assert.equal(blob!.type,'text/calendar;charset=utf-8');assert.equal(uid(await blob!.text()),uid(createHomeworkDeadlineICS(base)));
    timers[0].fn();assert.deepEqual(revoked,['blob:fake-calendar']);
  }finally{globalThis.document=original.document;URL.createObjectURL=original.create;URL.revokeObjectURL=original.revoke;globalThis.setTimeout=original.timeout;globalThis.fetch=original.fetch;}
});

await test('Click hoặc gắn DOM ném lỗi không có thông báo thành công, link dọn và URL vẫn được thu hồi',()=>{
  const original={document:globalThis.document,create:URL.createObjectURL,revoke:URL.revokeObjectURL,timeout:globalThis.setTimeout};
  try{
    for(const mode of ['click','append','url'] as const){
      let clicked=0,removed=0,attached=false;const timers:(()=>void)[]=[],revoked:string[]=[];
      URL.createObjectURL=()=>{if(mode==='url')throw Error('Giả lập tạo URL lỗi');return 'blob:failure-'+mode;};URL.revokeObjectURL=url=>{revoked.push(url);};globalThis.setTimeout=((fn:()=>void,delay:number)=>{assert.equal(delay,60000);timers.push(fn);return 0;}) as any;
      globalThis.document={createElement(){return {click(){assert.equal(attached,true);clicked++;throw Error('Giả lập click lỗi');},remove(){removed++;attached=false;}};},body:{appendChild(){if(mode==='append')throw Error('Giả lập DOM lỗi');attached=true;}}} as any;
      slots=[];const draw=()=>{cursor=0;return Cards({lessons:[lesson],busy:false,onHomework(){}});};
      assert.doesNotThrow(()=>find(draw(),n=>n.type==='button'&&text(n)==='Nhắc lịch hạn nộp').props.onClick());
      const status=text(find(draw(),n=>n.props?.role==='status'));assert.match(status,/^Chưa yêu cầu tải được tệp lịch/);assert.doesNotMatch(status,/Đã yêu cầu|Đã tạo/);
      assert.equal(clicked,mode==='click'?1:0);assert.equal(removed,mode==='url'?0:1);assert.equal(attached,false);assert.equal(timers.length,mode==='url'?0:1);
      timers.forEach(fn=>fn());assert.deepEqual(revoked,mode==='url'?[]:['blob:failure-'+mode]);
    }
  }finally{globalThis.document=original.document;URL.createObjectURL=original.create;URL.revokeObjectURL=original.revoke;globalThis.setTimeout=original.timeout;}
});
console.log(`${count}/${count} ca calendar đạt bằng dữ liệu giả, hàm đồng bộ và DOM giả. Chưa xác minh tải/import thật trên Safari hay Zalo.`);

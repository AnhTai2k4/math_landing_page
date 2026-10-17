import {GRAPH_COEFFICIENTS,graphEquation,type GraphLine} from './guide-graph-game';

export type FlightMission={x:number;y:number;rule:'any'|'horizontal'|'descending';title:string;example:GraphLine};
export const FLIGHT_MISSIONS:readonly FlightMission[]=[
 {x:2,y:1,rule:'any',title:'Đưa tàu tới đèn A(2; 1)',example:{a:1,b:-1}},
 {x:3,y:-2,rule:'horizontal',title:'Bay ngang tới đèn B(3; −2), dùng hàm hằng',example:{a:0,b:-2}},
 {x:2,y:-1,rule:'descending',title:'Hạ độ cao tới đèn C(2; −1), chọn a < 0',example:{a:-1,b:1}},
];
export function evaluateFlight(line:GraphLine,mission:FlightMission){
 const valid=GRAPH_COEFFICIENTS.includes(line.a as any)&&GRAPH_COEFFICIENTS.includes(line.b as any);
 const actualY=line.a*mission.x+line.b;
 const reaches=valid&&actualY===mission.y;
 const followsRule=mission.rule==='any'||(mission.rule==='horizontal'?line.a===0:line.a<0);
 const hit=reaches&&followsRule;
 const value=(n:number)=>n<0?'('+String(n).replace('-','−')+')':String(n);
 const substitution=`Tại x = ${mission.x}, y = ${value(line.a)} × ${mission.x} + ${value(line.b)} = ${actualY}.`;
 return {hit,reaches,actualY,followsRule,explanation:substitution+' '+(hit?'Tàu đi qua đèn và đúng yêu cầu màn chơi.':!reaches?`Đèn có tung độ ${mission.y}, nên tuyến này chưa đi qua đèn.`:mission.rule==='horizontal'?'Đã tới đèn nhưng màn này cần a = 0 để bay ngang.':'Đã tới đèn nhưng màn này cần a < 0 để hạ độ cao.')};
}
/** Đoạn đường trong khung [-4,4]^2, cắt ở biên nếu tuyến bay bỏ lỡ đèn ngoài khung. */
export function flightSegment(line:GraphLine,targetX:number){
 let left=-4,right=4;
 if(line.a!==0){const a=(-4-line.b)/line.a,b=(4-line.b)/line.a;left=Math.max(left,Math.min(a,b));right=Math.min(right,Math.max(a,b));}
 const end=Math.max(left,Math.min(right,targetX));
 return {start:left,end};
}
export function flightPoint(line:GraphLine,targetX:number,progress:number){
 const {start,end}=flightSegment(line,targetX),t=Math.max(0,Math.min(1,Number.isFinite(progress)?progress:0));
 const x=start+(end-start)*t;return {x,y:line.a*x+line.b};
}
export function advanceFlight(progress:number,deltaMs:number){
 if(!Number.isFinite(progress)||!Number.isFinite(deltaMs)||deltaMs<=0)return Math.max(0,Math.min(1,Number.isFinite(progress)?progress:0));
 return Math.min(1,Math.max(0,progress)+Math.min(deltaMs,80)/2800);
}
export const sampleFlight=(mission:FlightMission)=>graphEquation(mission.example);

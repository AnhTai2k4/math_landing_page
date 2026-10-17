import type {StudyGameQuestion,StudyGrade} from '../native/playground/study-game-bank';

export const FLIGHT_VERSION='v1';
export const FLIGHT_MAX_SCORE=1240;
export type FlightLane=0|1|2;
export type FlightPhase='ready'|'intro'|'running'|'feedback'|'paused'|'finished';
export interface FlightResult {questionId:string;chosen:FlightLane|null;correct:boolean;}
export interface FlightState {
 phase:FlightPhase;pausedFrom:'intro'|'running';questions:readonly StudyGameQuestion[];
 lane:FlightLane;x:number;cursor:number;intro:number;progress:number;elapsed:number;
 bullet:{x:number;y:number;lane:FlightLane}|null;hearts:number;score:number;combo:number;bestCombo:number;
 results:FlightResult[];feedback:string;
}
export function freshFlight(questions:readonly StudyGameQuestion[]=[]):FlightState {
 const seen=new Set<string>();
 const deck=questions.filter(q=>{if(seen.has(q.id))return false;seen.add(q.id);return true;}).slice(0,8);
 return {phase:'ready',pausedFrom:'running',questions:deck,lane:1,x:1,cursor:0,intro:0,progress:0,elapsed:0,bullet:null,hearts:3,score:0,combo:0,bestCombo:0,results:[],feedback:''};
}
export function startFlight(state:FlightState,reduced=false):FlightState {return state.phase==='ready'?{...state,phase:state.questions.length?(reduced?'running':'intro'):'finished',intro:reduced?3:0}:state;}
export function skipFlightIntro(state:FlightState):FlightState {return state.phase==='intro'?{...state,phase:'running',intro:3}:state;}
export function moveFlight(state:FlightState,direction:-1|1,reduced=false):FlightState {
 if(state.phase!=='running'||state.bullet)return state;
 const lane=Math.max(0,Math.min(2,state.lane+direction)) as FlightLane;
 return {...state,lane,x:reduced?lane:state.x};
}
export function canFireFlight(state:FlightState):boolean {return state.phase==='running'&&!state.bullet&&Math.abs(state.x-state.lane)<.02;}
export function fireFlight(state:FlightState):FlightState {return canFireFlight(state)?{...state,bullet:{x:state.x,y:.88,lane:state.lane}}:state;}
function settleFlight(state:FlightState,chosen:FlightLane|null):FlightState {
 const q=state.questions[state.cursor];if(!q||state.phase!=='running')return state;
 const correct=chosen===q.correct,combo=correct?state.combo+1:0;
 return {...state,phase:'feedback',bullet:null,combo,bestCombo:Math.max(state.bestCombo,combo),score:state.score+(correct?100+20*Math.min(combo-1,4):0),hearts:state.hearts-(correct?0:1),results:[...state.results,{questionId:q.id,chosen,correct}],feedback:correct?(combo>=3?'Căng đét! Combo thiên hà đang lên!':'Trúng mục tiêu! Flex nhẹ một đường bay.'):(chosen===null?'Thiên thạch chạm tàu! Mất 1 tim, mình gỡ lại nhé.':'Trúng đáp án chưa đúng. Mất 1 tim, cuối lượt mình cùng gỡ.')};
}
export function resolveFlightShot(state:FlightState):FlightState {return state.phase==='running'&&state.bullet?settleFlight(state,state.bullet.lane):state;}
export function nextFlight(state:FlightState):FlightState {
 if(state.phase!=='feedback')return state;
 return state.hearts===0||state.cursor+1===state.questions.length?{...state,phase:'finished'}:{...state,phase:'running',cursor:state.cursor+1,progress:0,bullet:null,feedback:''};
}
export function pauseFlight(state:FlightState):FlightState {return state.phase==='intro'||state.phase==='running'?{...state,phase:'paused',pausedFrom:state.phase}:state;}
export function resumeFlight(state:FlightState,reduced=false):FlightState {
 if(state.phase!=='paused')return state;
 const resumed={...state,phase:reduced?'running' as const:state.pausedFrom,intro:reduced?3:state.intro,x:reduced?state.lane:state.x};
 return reduced?resolveFlightShot(resumed):resumed;
}
export function finishFlight(state:FlightState):FlightState {return state.phase==='paused'?{...state,phase:'finished',bullet:null}:state;}
export function flightDuration(state:FlightState):number {return Math.max(24,36-state.cursor*1.5);}
export function flightTargetY(state:FlightState):number {return .12+state.progress*.7;}
export function tickFlight(state:FlightState,delta:number):FlightState {
 if(!Number.isFinite(delta)||delta<=0||(state.phase!=='intro'&&state.phase!=='running'))return state;
 const dt=Math.min(.06,delta);
 if(state.phase==='intro'){const intro=Math.min(3,state.intro+dt);return {...state,intro,phase:intro>=3?'running':'intro'};}
 const distance=state.lane-state.x,x=Math.abs(distance)<=dt*5?state.lane:state.x+Math.sign(distance)*dt*5;
 const next={...state,x,elapsed:state.elapsed+dt,progress:Math.min(1,state.progress+dt/flightDuration(state)),bullet:state.bullet?{...state.bullet,y:state.bullet.y-dt*1.7}:null};
 if(next.bullet&&next.bullet.y<=flightTargetY(next))return settleFlight(next,next.bullet.lane);
 if(next.progress>=1)return settleFlight(next,null);
 return next;
}
export const FLIGHT_RECORD_KEY='mtm-flight-local-v1';
export function readFlightRecord(storage:Pick<Storage,'getItem'>|undefined,grade:StudyGrade):number {
 try {const raw=storage?.getItem(`${FLIGHT_RECORD_KEY}:${grade}`);if(!raw||!/^\d{1,4}$/.test(raw))return 0;const value=Number(raw);return value<=FLIGHT_MAX_SCORE?value:0;}catch{return 0;}
}
export function saveFlightRecord(storage:Pick<Storage,'getItem'|'setItem'>|undefined,grade:StudyGrade,state:FlightState):boolean {
 if(!storage||state.phase!=='finished'||!Number.isInteger(state.score)||state.score<0||state.score>FLIGHT_MAX_SCORE)return false;
 try{if(state.score>readFlightRecord(storage,grade))storage.setItem(`${FLIGHT_RECORD_KEY}:${grade}`,String(state.score));return true;}catch{return false;}
}

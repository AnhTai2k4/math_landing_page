import {studyGameQuestions,studyGameTopics,type StudyGameQuestion,type StudyGrade} from './playground/study-game-bank';

export const BOSS_VERSION='v1';
export type BossLane=0|1|2;
export type BossPhase='ready'|'intro'|'running'|'feedback'|'paused'|'finished';
export type BossHit={questionId:string;chosen:BossLane|null;correct:boolean;damage:number};
export type BossState={phase:BossPhase;pausedFrom:'intro'|'running';questions:readonly StudyGameQuestion[];cursor:number;lane:BossLane;x:number;progress:number;intro:number;guarding:boolean;hearts:number;health:number;maxHealth:number;combo:number;bestCombo:number;score:number;results:readonly BossHit[]};

export function bossDeck(grade:StudyGrade,topicId:string):readonly StudyGameQuestion[]{return studyGameQuestions(grade,topicId);}
export function freshBoss(questions:readonly StudyGameQuestion[]=[]):BossState {
 const first=questions[0],topic=first&&studyGameTopics(first.grade).find(t=>t.chapter===first.chapter),allowed=new Map((topic?bossDeck(first.grade,topic.id):[]).map(q=>[q.id,q]));
 const seen=new Set<string>(),deck:StudyGameQuestion[]=[];
 for(const input of questions){const question=allowed.get(input.id);if(!question||input.grade!==first.grade||input.chapter!==first.chapter||seen.has(input.id))continue;seen.add(input.id);deck.push(question);if(deck.length===8)break;}
 const maxHealth=deck.length+Math.floor(deck.length/3);
 return {phase:'ready',pausedFrom:'running',questions:deck,cursor:0,lane:1,x:1,progress:0,intro:0,guarding:false,hearts:3,health:maxHealth,maxHealth,combo:0,bestCombo:0,score:0,results:[]};
}
export function startBoss(state:BossState,reduced=false):BossState{return state.phase==='ready'?{...state,phase:state.questions.length?(reduced?'running':'intro'):'finished',intro:reduced?3:0}:state;}
export function skipBossIntro(state:BossState):BossState{return state.phase==='intro'?{...state,phase:'running',intro:3}:state;}
export function moveBoss(state:BossState,direction:-1|1,reduced=false):BossState {
 if(state.phase!=='running'||state.guarding||(direction!==-1&&direction!==1))return state;
 const lane=Math.max(0,Math.min(2,state.lane+direction)) as BossLane;
 return lane===state.lane?state:{...state,lane,x:reduced?lane:state.x};
}
export function canGuardBoss(state:BossState):boolean{return state.phase==='running'&&!state.guarding&&Math.abs(state.x-state.lane)<.02;}
export function guardBoss(state:BossState):BossState{return canGuardBoss(state)?{...state,guarding:true}:state;}
function settle(state:BossState):BossState {
 if(state.phase!=='running')return state;
 const question=state.questions[state.cursor];if(!question)return state;
 const chosen=state.guarding&&Math.abs(state.x-state.lane)<.02?state.lane:null,correct=chosen===question.correct,combo=correct?state.combo+1:0,damage=correct?(combo%3===0?2:1):0;
 return {...state,phase:'feedback',progress:1,guarding:false,hearts:state.hearts-(correct?0:1),health:Math.max(0,state.health-damage),combo,bestCombo:Math.max(state.bestCombo,combo),score:state.score+(correct?100+Math.min(combo-1,4)*20:0),results:[...state.results,{questionId:question.id,chosen,correct,damage}]};
}
export function resolveBossGuard(state:BossState):BossState{return state.phase==='running'&&state.guarding?settle(state):state;}
export function nextBoss(state:BossState):BossState {
 if(state.phase!=='feedback')return state;
 return state.hearts===0||state.health===0||state.cursor+1>=state.questions.length?{...state,phase:'finished'}:{...state,phase:'running',cursor:state.cursor+1,progress:0,guarding:false};
}
export function pauseBoss(state:BossState):BossState{return state.phase==='running'||state.phase==='intro'?{...state,phase:'paused',pausedFrom:state.phase}:state;}
export function resumeBoss(state:BossState,reduced=false):BossState {
 if(state.phase!=='paused')return state;
 const resumed={...state,phase:reduced?'running' as const:state.pausedFrom,intro:reduced?3:state.intro,x:reduced?state.lane:state.x};
 return reduced?resolveBossGuard(resumed):resumed;
}
export function finishBoss(state:BossState):BossState{return state.phase==='paused'?{...state,phase:'finished',guarding:false}:state;}
export function bossDuration(state:BossState):number{return 38-state.cursor*1.5;}
export function tickBoss(state:BossState,delta:number):BossState {
 if(!Number.isFinite(delta)||delta<=0||!['intro','running'].includes(state.phase))return state;
 const dt=Math.min(.06,delta);
 if(state.phase==='intro'){const intro=Math.min(3,state.intro+dt);return {...state,intro,phase:intro>=3?'running':'intro'};}
 const distance=state.lane-state.x,x=Math.abs(distance)<=dt*6?state.lane:state.x+Math.sign(distance)*dt*6;
 const progress=Math.min(1,state.progress+dt*(state.guarding?1.8:1/bossDuration(state))),next={...state,x,progress};
 return progress===1?settle(next):next;
}

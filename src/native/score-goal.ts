import {tracks,practiceURL} from './chapters/practice-shared';

export const goalDays=[2,3,4,5] as const;
export const goalMinutes=[15,20,30] as const;
export const goalTracks=tracks.filter(track=>['10','11','12'].includes(track.id));
export type GoalInput={grade:string;chapter:string;current:string;target:string;days:number;minutes:number};
export type GoalSession={title:string;foundation:number;practice:number;review:number;detail:string;href:string};
export type ScoreGoalPlan={current:number;target:number;chapter:string;grade:string;total:number;sessions:GoalSession[]};

function score(raw:string){
  if(typeof raw!=='string'||!/^\d{1,2}([.,]\d{1,2})?$/.test(raw.trim()))return null;
  const value=Number(raw.trim().replace(',','.'));
  return Number.isFinite(value)&&value>=0&&value<=10?value:null;
}

/** Gợi ý phân bổ thời gian tự học, không dự báo hay cam kết tăng điểm. */
export function createScoreGoal(input:GoalInput):ScoreGoalPlan|null{
  const track=goalTracks.find(item=>item.id===input.grade),chapter=track?.chapters.find(item=>item.id===input.chapter);
  const current=score(input.current),target=score(input.target);
  if(!track||!chapter||current===null||target===null||target<current||!goalDays.includes(input.days as 2)||!goalMinutes.includes(input.minutes as 15))return null;
  const foundation=Math.round(input.minutes*(current<5?.5:current<8?.35:.2));
  const review=Math.max(3,Math.round(input.minutes*.2)),practice=input.minutes-foundation-review;
  const titles=['Củng cố nền tảng','Làm chắc từng dạng','Tự giải rồi đối chiếu','Nối các dạng trong chương','Tự kiểm và chọn việc tiếp'];
  const sessions=Array.from({length:input.days},(_,index)=>({
    title:titles[index],foundation,practice,review,href:practiceURL(track.id,chapter.id),
    detail:index===0?'Nhắc lại định nghĩa, điều kiện và một ví dụ trong chương em đang học.':index===input.days-1?'Tự làm lại câu từng vướng, đối chiếu lời giải rồi ghi một điều cần hỏi thầy.':target>=8&&index>=2?'Sau khi làm chắc dạng cơ bản, thử bài vận dụng trong chính chương này; kiểm điều kiện và cách lập luận.':'Chọn một dạng trong chương, tự giải trước khi mở lời giải; ghi lại bước chưa chắc để làm lại.',
  }));
  return {current,target,chapter:chapter.title,grade:track.label,total:input.days*input.minutes,sessions};
}

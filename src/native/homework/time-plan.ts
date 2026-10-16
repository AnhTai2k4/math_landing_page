export type HomeworkTimePlan = {
  minutes:number; questions:number; readMinutes:number; solveMinutes:number;
  reviewMinutes:number; secondsPerQuestion:number;
};

export function planHomeworkTime(minutesText:string,questionsText:string):HomeworkTimePlan|null{
  if(!/^\d{1,3}$/.test(minutesText.trim())||!/^\d{1,3}$/.test(questionsText.trim()))return null;
  const minutes=Number(minutesText),questions=Number(questionsText);
  if(minutes<5||minutes>180||questions<1||questions>100)return null;
  const readMinutes=Math.max(1,Math.floor(minutes/10));
  const reviewMinutes=Math.max(2,Math.floor(minutes/5));
  const solveMinutes=minutes-readMinutes-reviewMinutes;
  return {minutes,questions,readMinutes,solveMinutes,reviewMinutes,secondsPerQuestion:Math.floor(solveMinutes*60/questions)};
}

export function questionPace(seconds:number):string{
  const minutes=Math.floor(seconds/60),rest=seconds%60;
  return [minutes?minutes+' phút':'',rest?rest+' giây':''].filter(Boolean).join(' ')||'0 giây';
}

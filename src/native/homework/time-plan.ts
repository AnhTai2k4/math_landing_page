export type HomeworkTimePlan = {
  minutes:number; questions:number; readMinutes:number; solveMinutes:number;
  reviewMinutes:number; secondsPerQuestion:number;
};
export type HomeworkTimeMode = 'balanced'|'review';

export function planHomeworkTime(minutesText:string,questionsText:string,mode:HomeworkTimeMode='balanced'):HomeworkTimePlan|null{
  if(!/^\d{1,3}$/.test(minutesText.trim())||!/^\d{1,3}$/.test(questionsText.trim()))return null;
  const minutes=Number(minutesText),questions=Number(questionsText);
  if(minutes<5||minutes>180||questions<1||questions>100||(mode!=='balanced'&&mode!=='review'))return null;
  const readMinutes=Math.max(1,Math.floor(minutes/10));
  const balancedReview=Math.max(2,Math.floor(minutes/5));
  // Giữ ít nhất 2 phút làm bài để cả cấu hình 100 câu vẫn có nhịp dương.
  const reviewMinutes=mode==='review'?Math.min(minutes-readMinutes-2,Math.max(balancedReview+1,Math.floor(minutes*3/10))):balancedReview;
  const solveMinutes=minutes-readMinutes-reviewMinutes;
  return {minutes,questions,readMinutes,solveMinutes,reviewMinutes,secondsPerQuestion:Math.floor(solveMinutes*60/questions)};
}

export function questionPace(seconds:number):string{
  const minutes=Math.floor(seconds/60),rest=seconds%60;
  return [minutes?minutes+' phút':'',rest?rest+' giây':''].filter(Boolean).join(' ')||'0 giây';
}

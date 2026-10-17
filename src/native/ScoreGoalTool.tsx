import {lazy} from 'react';
import PracticeTool from './chapters/PracticeTool';
const ScoreGoal=lazy(()=>import('./ScoreGoal'));
export default function ScoreGoalTool({grade}:{grade:string}){
  return <div className="course-score-goal"><PracticeTool label="Mục tiêu điểm · Tạo lộ trình một tuần" loading="Đang mở bộ lập lộ trình…"><ScoreGoal key={grade} grade={grade}/></PracticeTool></div>;
}

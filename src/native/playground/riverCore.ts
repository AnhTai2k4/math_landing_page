export const RIVER_VERSION = 'v1';
export const RIVER_MAX_SCORE = 1240;
export type Lane = 0 | 1 | 2;
export interface RiverQuestion {
  id: string;
  prompt: string;
  answers: readonly [string, string, string];
  correct: Lane;
  explanation: string;
  tip: string;
}

// Bài tự biên soạn, đại số THCS, không dùng làm bài thi hoặc bảng xếp hạng.
export const RIVER_QUESTIONS: readonly RiverQuestion[] = [
  {id:'r1',prompt:'3(x − 2) + 4 = 16. Tìm x.',answers:['6','4','8'],correct:0,explanation:'3(x − 2) + 4 = 16 ⇔ 3x − 2 = 16 ⇔ 3x = 18 ⇔ x = 6.',tip:'Phân phối 3 vào cả x và −2 trước khi chuyển vế.'},
  {id:'r2',prompt:'(x + 3)² − x² = 33. Tìm x.',answers:['3','4','5'],correct:1,explanation:'(x + 3)² − x² = 6x + 9. Vì 6x + 9 = 33 nên x = 4.',tip:'Bình phương một tổng có cả hạng tử 2ab.'},
  {id:'r3',prompt:'Với x = −2, tính (x² − 9)/(x − 3).',answers:['−1','5','1'],correct:2,explanation:'x − 3 = −5 ≠ 0. (x² − 9)/(x − 3) = x + 3 = 1 khi x = −2.',tip:'Chỉ rút gọn nhân tử x − 3 sau khi nêu x ≠ 3.'},
  {id:'r4',prompt:'(x − 2)(x + 2) = x² − 3x + 5. Tìm x.',answers:['3','−3','1'],correct:0,explanation:'x² − 4 = x² − 3x + 5 ⇔ 3x = 9 ⇔ x = 3.',tip:'Dùng hiệu hai bình phương rồi khử x² ở hai vế.'},
  {id:'r5',prompt:'(x − 3)² = 16. Nghiệm lớn hơn là bao nhiêu?',answers:['5','7','−1'],correct:1,explanation:'x − 3 = 4 hoặc x − 3 = −4, nên x = 7 hoặc x = −1. Nghiệm lớn hơn là 7.',tip:'u² = a² có hai khả năng u = a hoặc u = −a.'},
  {id:'r6',prompt:'Với x ≠ 2, (x² − 4)/(x − 2) = 7. Tìm x.',answers:['9','2','5'],correct:2,explanation:'Với x ≠ 2, (x² − 4)/(x − 2) = x + 2. Suy ra x + 2 = 7, tức x = 5, thỏa điều kiện.',tip:'Sau khi giải, đối chiếu nghiệm với điều kiện mẫu khác 0.'},
  {id:'r7',prompt:'(x + 1)(x − 1) − x(x − 3) = 11. Tìm x.',answers:['4','−4','10/3'],correct:0,explanation:'x² − 1 − x² + 3x = 11 ⇔ 3x − 1 = 11 ⇔ x = 4.',tip:'Dấu trừ trước tích làm đổi dấu cả hai hạng tử khi bỏ ngoặc.'},
  {id:'r8',prompt:'x > 0 và (x − 2)² + (x + 2)² = 26. Tìm x.',answers:['9','3','−3'],correct:1,explanation:'(x − 2)² + (x + 2)² = 2x² + 8 = 26 ⇔ x² = 9. Vì x > 0 nên x = 3.',tip:'Hai hạng tử −4x và +4x triệt tiêu, nhưng hai số 4 phải cộng lại.'},
];

export interface RiverAnswer { questionId: string; chosen: Lane; correct: boolean }
export interface RiverState {
  phase: 'ready' | 'intro' | 'running' | 'paused' | 'finished';
  lane: Lane;
  wave: 'answer' | 'rock' | 'feedback';
  cursor: number;
  progress: number;
  elapsed: number;
  introTime: number;
  score: number;
  hearts: number;
  combo: number;
  bestCombo: number;
  crashes: number;
  feedback: string;
  feedbackGood: boolean;
  results: RiverAnswer[];
}

export function freshRiver(): RiverState {
  return {phase:'ready',lane:1,wave:'answer',cursor:0,progress:0,elapsed:0,introTime:0,score:0,hearts:3,combo:0,bestCombo:0,crashes:0,feedback:'',feedbackGood:true,results:[]};
}
export function riverSpeed(state: RiverState) { return 1 + Math.min(state.score / 500, 0.45); }
export function riverRockLane(state: RiverState): Lane { return ((state.cursor + 1) % 3) as Lane; }
export function moveRiver(state: RiverState, direction: -1 | 1): RiverState {
  if (state.phase !== 'running' || state.wave === 'feedback') return state;
  return {...state,lane:Math.max(0,Math.min(2,state.lane + direction)) as Lane};
}
export function beginRiver(state: RiverState): RiverState { return state.phase === 'ready' ? {...state,phase:'intro'} : state; }
export function pauseRiver(state: RiverState): RiverState { return state.phase === 'running' || state.phase === 'intro' ? {...state,phase:'paused'} : state; }
export function resumeRiver(state: RiverState): RiverState { return state.phase === 'paused' ? {...state,phase:state.introTime < 3 ? 'intro' : 'running'} : state; }

// dt được giới hạn: mất khung không thể nhảy qua một cổng hoặc trừ nhiều tim.
export function tickRiver(state: RiverState, deltaSeconds: number): RiverState {
  if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0 || (state.phase !== 'intro' && state.phase !== 'running')) return state;
  const dt = Math.min(deltaSeconds, 0.1);
  if (state.phase === 'intro') {
    const introTime = Math.min(3,state.introTime + dt);
    return {...state,introTime,phase:introTime >= 3 ? 'running' : 'intro'};
  }
  const duration = state.wave === 'answer' ? 18 / riverSpeed(state) : state.wave === 'rock' ? 3.6 : 1.3;
  const progress = state.progress + dt / duration;
  const next = {...state,elapsed:state.elapsed + dt,progress};
  if (progress < 1) return next;
  if (state.wave === 'answer') {
    const question = RIVER_QUESTIONS[state.cursor];
    const correct = state.lane === question.correct;
    const combo = correct ? state.combo + 1 : 0;
    return {...next,wave:'feedback',progress:0,combo,bestCombo:Math.max(state.bestCombo,combo),score:state.score + (correct ? 100 + 20 * Math.min(combo - 1,4) : 0),hearts:state.hearts - (correct ? 0 : 1),results:[...state.results,{questionId:question.id,chosen:state.lane,correct}],feedback:correct ? (combo >= 3 ? 'Căng đét! Chuỗi đúng tăng tốc!' : 'Đúng phao rồi! Flex nhẹ thôi!') : 'Ủa alo! Mất 1 tim. Cuối màn mình gỡ lại nhé.',feedbackGood:correct};
  }
  if (state.wave === 'feedback') {
    if (state.hearts <= 0 || state.cursor === RIVER_QUESTIONS.length - 1) return {...next,phase:'finished',progress:0};
    return {...next,wave:'rock',progress:0,feedback:'Né đá! Lái sang một trong hai làn trống.',feedbackGood:true};
  }
  const hit = state.lane === riverRockLane(state);
  const hearts = state.hearts - (hit ? 1 : 0);
  return {...next,phase:hearts <= 0 ? 'finished' : 'running',wave:'answer',cursor:state.cursor + 1,progress:0,hearts,combo:hit ? 0 : state.combo,crashes:state.crashes + (hit ? 1 : 0),feedback:hit ? 'Va đá mất 1 tim. Chú ý đoạn sông tiếp theo!' : 'Né đá đẹp! Cổng Toán mới phía trước.',feedbackGood:!hit};
}

export const RIVER_RECORD_KEY = 'mtm-river-local-v1';
export function readRiverRecord(storage: Pick<Storage,'getItem'> | undefined): number {
  try { const value = storage?.getItem(RIVER_RECORD_KEY); if (!value || !/^\d{1,4}$/.test(value)) return 0; const score=Number(value); return score <= RIVER_MAX_SCORE ? score : 0; } catch { return 0; }
}
export function saveRiverRecord(storage: Pick<Storage,'getItem'|'setItem'> | undefined, score: number): boolean {
  if (!Number.isInteger(score) || score < 0 || score > RIVER_MAX_SCORE) return false;
  try { if (score > readRiverRecord(storage)) storage?.setItem(RIVER_RECORD_KEY,String(score)); return Boolean(storage); } catch { return false; }
}

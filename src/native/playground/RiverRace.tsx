import React, {useEffect, useRef, useState} from 'react';
import {beginRiver,freshRiver,moveRiver,pauseRiver,readRiverRecord,resumeRiver,riverModeLabel,riverRockLane,riverSpeed,riverWaveDuration,RIVER_QUESTIONS,RIVER_VERSION,saveRiverRecord,tickRiver,type Lane,type RiverMode,type RiverState} from './riverCore';
import './playground.css';

function Boat() { return <svg viewBox="0 0 80 120" aria-hidden="true"><path className="river-wake" d="M20 95L10 115m50-20 10 20M40 100v18" stroke="white" strokeWidth="4" strokeLinecap="round"/><path d="M40 5C7 30 9 85 20 98l20 15 20-15C71 85 73 30 40 5" fill="#FFCF24" stroke="#213269" strokeWidth="4"/><path d="M40 20v20" stroke="#fff6cf" strokeWidth="7" strokeLinecap="round"/><ellipse cx="40" cy="67" rx="15" ry="21" fill="#213269"/><circle cx="40" cy="56" r="11" fill="#f6c9a3"/><path d="M25 51h30M40 48v7" stroke="#213269" strokeWidth="3"/><path d="M8 57l64 27" stroke="#213269" strokeWidth="5" strokeLinecap="round"/><path d="M3 50l13 6-5 13-10-4m68 10 10 4-2 13-13-6" fill="#FFCF24" stroke="#213269" strokeWidth="2"/></svg>; }
function Rock() { return <svg viewBox="0 0 100 80" aria-hidden="true"><ellipse cx="50" cy="65" rx="48" ry="10" fill="white" opacity=".5"/><path d="M8 62L26 18 58 8l30 28 5 26z" fill="#758ba4" stroke="#213269" strokeWidth="4"/><path d="M26 18l15 27 17-37M41 45l47-9" fill="none" stroke="#a9b9c9" strokeWidth="4"/></svg>; }
function seconds(value: number) { return `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2,'0')}`; }
function safeStorage() { try { return window.localStorage; } catch { return undefined; } }

export default function RiverRace({onExit}: {onExit: () => void}) {
  const [game,setGame] = useState<RiverState>(() => freshRiver());
  const current = useRef(game);
  const stage = useRef<HTMLDivElement>(null);
  const focusStage = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const [reduced,setReduced] = useState(() => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const reducedRef = useRef(reduced);
  const [sound,setSound] = useState(false);
  const soundRef = useRef(false);
  const audio = useRef<AudioContext | null>(null);
  const mounted = useRef(false);
  const soundRequest = useRef(0);
  const session = useRef(0);
  const renderSession = session.current;
  const [best,setBest] = useState(() => typeof window === 'undefined' ? 0 : readRiverRecord(safeStorage()));
  const [saved,setSaved] = useState(true);
  const [review,setReview] = useState<string | null>(null);
  const [reviewAnswer,setReviewAnswer] = useState<Lane | null>(null);
  const reviewIdentity = useRef(0);
  const renderReview = reviewIdentity.current;
  const swipe = useRef<{pointerId: number; x: number; target: HTMLDivElement} | null>(null);
  const clearSwipe = () => {
    const active=swipe.current;swipe.current=null;
    try {if(active?.target.hasPointerCapture(active.pointerId))active.target.releasePointerCapture(active.pointerId);} catch { /* Con trỏ có thể đã được trình duyệt thả. */ }
  };
  const update = (next: RiverState) => {if(next.phase !== current.current.phase || next.wave !== current.current.wave)clearSwipe();current.current = next;setGame(next);};
  const steer = (direction: -1 | 1) => {if(renderSession === session.current)update(moveRiver(current.current,direction));};
  const pause = () => {if(renderSession === session.current)update(pauseRiver(current.current));};
  const beginSwipe = (event: React.PointerEvent<HTMLDivElement>) => {
    if(current.current.phase !== 'running' || current.current.wave === 'feedback' || event.button !== 0 || !event.isPrimary || swipe.current)return;
    if((event.target as Element).closest?.('button, a, input, select, textarea, summary, [role="button"]'))return;
    swipe.current={pointerId:event.pointerId,x:event.clientX,target:event.currentTarget};
    try {event.currentTarget.setPointerCapture(event.pointerId);} catch { /* Pointerleave sẽ hủy nếu không bắt được con trỏ. */ }
  };
  const endSwipe = (event: React.PointerEvent<HTMLDivElement>) => {
    const active=swipe.current;if(!active || active.pointerId !== event.pointerId)return;
    const delta=event.clientX-active.x;clearSwipe();if(Math.abs(delta)>25)steer(delta>0?1:-1);
  };
  const cancelSwipe = (event: React.PointerEvent<HTMLDivElement>) => {if(swipe.current?.pointerId === event.pointerId)clearSwipe();};
  const chooseMode = (mode: RiverMode) => {if(renderSession !== session.current || current.current.phase !== 'ready')return;update(freshRiver(mode));setBest(readRiverRecord(safeStorage(),mode));};
  const start = () => {if(renderSession !== session.current || (current.current.phase !== 'ready' && current.current.phase !== 'finished'))return;session.current++;reviewIdentity.current++;setReview(null);setReviewAnswer(null);focusStage.current=true;update(beginRiver(freshRiver(current.current.mode)));};
  const changeMode = () => {if(renderSession !== session.current || current.current.phase !== 'finished')return;session.current++;reviewIdentity.current++;setReview(null);setReviewAnswer(null);update(freshRiver(current.current.mode));heading.current?.focus();};
  const tone = (good: boolean) => {
    const context=audio.current;
    if (!soundRef.current || !context || context.state !== 'running') return;
    try {
      const oscillator=context.createOscillator(),gain=context.createGain();
      oscillator.type=good ? 'sine' : 'triangle';oscillator.frequency.setValueAtTime(good ? 620 : 180,context.currentTime);oscillator.frequency.exponentialRampToValueAtTime(good ? 930 : 95,context.currentTime + 0.16);
      gain.gain.setValueAtTime(0.0001,context.currentTime);gain.gain.exponentialRampToValueAtTime(0.045,context.currentTime + 0.01);gain.gain.exponentialRampToValueAtTime(0.0001,context.currentTime + 0.22);oscillator.connect(gain);gain.connect(context.destination);oscillator.start();oscillator.stop(context.currentTime + 0.24);
    } catch {soundRef.current=false;setSound(false);}
  };
  const toggleSound = async () => {
    const request=++soundRequest.current;
    if (soundRef.current) {soundRef.current=false;setSound(false);return;}
    try { if (!audio.current || audio.current.state === 'closed') audio.current=new AudioContext();await audio.current.resume();if(!mounted.current || request !== soundRequest.current)return;soundRef.current=true;setSound(true);tone(true); } catch {if(mounted.current && request === soundRequest.current){soundRef.current=false;setSound(false);}}
  };

  useEffect(() => {
    if(game.phase !== 'running' && game.phase !== 'intro')return;
    let frame=0,last=0,paint=0,disposed=false;
    const animate=(now: number) => {
      if (disposed) return;
      const before=current.current;
      const next=tickRiver(before,last ? (now - last)/1000 : 0);last=now;if(next.phase !== before.phase || next.wave !== before.wave)clearSwipe();current.current=next;
      if (next.results.length > before.results.length || next.crashes > before.crashes) tone(next.feedbackGood);
      if (stage.current) {
        const visualProgress=reducedRef.current ? Math.floor(next.progress * 5)/5 : next.progress;
        stage.current.style?.setProperty('--river-flow',String(visualProgress));
      }
      if (next !== before && (now - paint >= 90 || before.phase !== next.phase || before.wave !== next.wave || before.cursor !== next.cursor)) {setGame(next);paint=now;}
      frame=requestAnimationFrame(animate);
    };
    frame=requestAnimationFrame(animate);
    return () => {disposed=true;cancelAnimationFrame(frame);};
  },[game.phase]);
  useEffect(() => {
    mounted.current=true;
    if(heading.current?.closest?.('[data-river-focus-area]')?.contains(document.activeElement))heading.current?.focus();
    const hide=() => {if (document.hidden) update(pauseRiver(current.current));};
    document.addEventListener('visibilitychange',hide);
    return () => {mounted.current=false;clearSwipe();soundRequest.current++;soundRef.current=false;document.removeEventListener('visibilitychange',hide);void audio.current?.close().catch(() => {});};
  },[]);
  useEffect(() => {if(focusStage.current&&game.phase==='intro'){focusStage.current=false;stage.current?.focus();}},[game.phase]);
  useEffect(() => {reducedRef.current=reduced;},[reduced]);
  useEffect(() => {
    if (game.phase !== 'finished') return;
    const storage=safeStorage();setSaved(saveRiverRecord(storage,game.score,game.mode));setBest(Math.max(readRiverRecord(storage,game.mode),game.score));heading.current?.focus();
  },[game.phase]);

  const question=RIVER_QUESTIONS[game.cursor];
  const wrong=game.results.filter(result => !result.correct);
  const reviewQuestion=RIVER_QUESTIONS.find(item => item.id === review);
  const playing=game.phase === 'running' || game.phase === 'intro';
  const keyboard=(event: React.KeyboardEvent) => {
    if (renderSession !== session.current) return;
    if (event.altKey || event.ctrlKey || event.metaKey || event.repeat) return;
    if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') {event.preventDefault();steer(-1);}
    if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') {event.preventDefault();steer(1);}
    if (event.key.toLowerCase() === 'p') {event.preventDefault();if (current.current.phase === 'paused') update(resumeRiver(current.current));else pause();}
  };
  return <section className={`river-game${reduced ? ' river-reduced' : ''}`} data-version={RIVER_VERSION} onKeyDown={keyboard} aria-labelledby="river-game-heading">
    <div className="river-game-top"><div><span className="river-eyebrow">8 CỔNG · ĐẠI SỐ THCS</span><h2 id="river-game-heading" ref={heading} tabIndex={-1}>Đua thuyền Toán</h2></div><button type="button" className="river-secondary" onClick={onExit}>Về sân chơi</button></div>
    <div className="river-settings"><button type="button" aria-pressed={sound} onClick={() => void toggleSound()}>{sound ? '♪ Âm thanh: bật' : '♪ Âm thanh: tắt'}</button><button type="button" aria-pressed={reduced} onClick={() => setReduced(v => !v)}>{reduced ? 'Giảm chuyển động: bật' : 'Giảm chuyển động: tắt'}</button><span>Kỷ lục {riverModeLabel(game.mode)} trên máy: {best} điểm</span></div>
    {game.phase === 'ready' && <fieldset className="river-mode-picker"><legend>Chọn nhịp chèo trước khi chơi</legend><div><button type="button" aria-pressed={game.mode === 'standard'} onClick={() => chooseMode('standard')}>Tiêu chuẩn</button><button type="button" aria-pressed={game.mode === 'practice'} onClick={() => chooseMode('practice')}>Tập chèo chậm</button></div><p>{game.mode === 'practice' ? 'Tập chèo: tốc độ cố định 0,65×, khoảng 28 giây mỗi câu và thêm thời gian né đá. Kỷ lục được lưu riêng.' : 'Tiêu chuẩn: bắt đầu ở 1× và tăng tốc theo điểm, giữ nguyên luật chơi quen thuộc.'} Chế độ giữ nguyên trong cả lượt.</p></fieldset>}
    {game.phase === 'finished' ? <div className="river-result">
      <span className="river-tag">{game.hearts > 0 && game.results.length === RIVER_QUESTIONS.length ? 'ĐÃ VỀ BẾN!' : 'DỪNG CHÂN LẤY SỨC'}</span><h3>{game.score} điểm · {game.results.filter(v => v.correct).length}/{game.results.length} cổng đã qua đúng</h3><p>Chế độ: <strong>{riverModeLabel(game.mode)}</strong>. Em đã gặp {game.results.length}/8 câu. Combo cao nhất ×{game.bestCombo}, va đá {game.crashes} lần, thời gian chơi {seconds(game.elapsed)}.</p><p className="river-storage-note">{saved ? 'Máy này chỉ lưu kỷ lục điểm, không lưu tên hay câu trả lời.' : 'Trình duyệt không cho lưu kỷ lục. Kết quả vẫn xem được trong lượt này.'} Kỷ lục Tập chèo và Tiêu chuẩn được tách riêng.</p>
      <div className="river-result-actions"><button className="river-primary" type="button" onClick={start}>Chèo một lượt mới</button><button className="river-secondary" type="button" onClick={changeMode}>Đổi chế độ</button><button className="river-secondary" type="button" onClick={onExit}>Về sân chơi</button></div>
      <h3>Cùng gỡ câu sai</h3>{wrong.length === 0 ? <p>{game.results.length ? 'Các câu em đã gặp đều đúng. Mẹo giữ phong độ: nhìn điều kiện trước, rút gọn sau.' : 'Em chưa đi qua cổng Toán nào. Chơi một lượt để mở phần ôn nhé.'}</p> : <><p>Thử lại trước khi mở lời giải. Câu chưa gặp không tính là câu sai.</p><div className="river-wrong-list">{wrong.map(result => <button type="button" key={result.questionId} aria-pressed={review === result.questionId} onClick={() => {if(renderSession !== session.current || current.current.phase !== 'finished')return;reviewIdentity.current++;setReview(result.questionId);setReviewAnswer(null);}}>Ôn câu {RIVER_QUESTIONS.findIndex(q => q.id === result.questionId) + 1}</button>)}</div></>}
      {reviewQuestion && <div className="river-review" key={reviewQuestion.id}><h4>{reviewQuestion.prompt}</h4><div className="river-review-answers">{reviewQuestion.answers.map((answer,index) => <button type="button" key={answer} disabled={reviewAnswer !== null} onClick={() => {if(renderSession === session.current && renderReview === reviewIdentity.current && current.current.phase === 'finished' && reviewAnswer === null){reviewIdentity.current++;setReviewAnswer(index as Lane);}}}>{answer}</button>)}</div>{reviewAnswer !== null && <div role="status"><p><strong>{reviewAnswer === reviewQuestion.correct ? 'Đúng rồi, em đã gỡ được câu này!' : `Đáp án đúng là ${reviewQuestion.answers[reviewQuestion.correct]}.`}</strong></p><p>{reviewQuestion.explanation}</p><p>Mẹo: {reviewQuestion.tip}</p></div>}</div>}
      <details className="river-solutions"><summary>Xem lời giải các câu đã gặp</summary>{game.results.map(result => {const q=RIVER_QUESTIONS.find(item => item.id === result.questionId)!;return <article key={q.id}><h4>Câu {RIVER_QUESTIONS.indexOf(q) + 1}: {q.prompt}</h4><p>Em đi vào phao {q.answers[result.chosen]}. {result.correct ? 'Chính xác.' : `Đáp án: ${q.answers[q.correct]}.`}</p><p>{q.explanation}</p></article>;})}</details>
    </div> : <>
      <div className="river-hud" aria-label="Thông số lượt chơi"><span><small>ĐIỂM</small><strong>{game.score}</strong></span><span><small>TIM</small><strong aria-label={`${game.hearts} tim`}>{'♥'.repeat(game.hearts)}<i aria-hidden="true">{'♡'.repeat(3 - game.hearts)}</i></strong></span><span><small>COMBO</small><strong>×{game.combo}</strong></span><span><small>TỐC ĐỘ</small><strong>{riverSpeed(game).toFixed(2)}×</strong></span><span><small>THỜI GIAN</small><strong>{seconds(game.elapsed)}</strong></span><span className="river-mode-hud"><small>CHẾ ĐỘ</small><strong>{riverModeLabel(game.mode)}</strong></span></div>
      <div className="river-question"><span>CỔNG {game.cursor + 1}/8 · {game.wave === 'rock' ? 'NÉ ĐÁ' : 'CHỌN PHAO'}</span><p>{game.wave === 'rock' ? 'Đá đang trôi xuống! Lái vào làn trống.' : question.prompt}</p>{game.wave === 'answer' && <small>Còn khoảng {Math.max(0,Math.ceil((1 - game.progress) * riverWaveDuration(game)))} giây để chọn làn.</small>}</div>
      <div ref={stage} className={`river-stage river-${game.wave}${!playing ? ' river-still' : ''}${game.wave === 'feedback' ? game.feedbackGood ? ' river-win' : ' river-hit' : ''}`} tabIndex={0} role="group" aria-label="Sông ba làn. Dùng mũi tên trái phải, A hoặc D để lái; P để tạm dừng." onPointerDown={beginSwipe} onPointerUp={endSwipe} onPointerCancel={cancelSwipe} onLostPointerCapture={cancelSwipe} onPointerLeave={event => {if(swipe.current?.pointerId === event.pointerId && !event.currentTarget.hasPointerCapture(event.pointerId))clearSwipe();}}>
        <div className="river-bank river-bank-left" aria-hidden="true"><span>♣</span><span>✿</span><span>♣</span></div><div className="river-bank river-bank-right" aria-hidden="true"><span>✿</span><span>♣</span><span>✿</span></div><div className="river-stream-lines" aria-hidden="true"/>
        <div className="river-collision-line" aria-hidden="true"><span>VẠCH BẮT PHAO</span></div>
        {game.wave === 'answer' && question.answers.map((answer,index) => <div className="river-buoy" key={`${question.id}-${index}`} style={{left:`${20 + index * 30}%`}}><span>{answer}</span></div>)}
        {game.wave === 'rock' && <div className="river-rock" style={{left:`${20 + riverRockLane(game) * 30}%`}}><Rock/><span>ĐÁ!</span></div>}
        <div className="river-boat" style={{left:`${20 + game.lane * 30}%`}}><Boat/></div>
        {game.wave === 'feedback' && <div className="river-world-feedback" aria-hidden="true"><span>{game.feedbackGood ? '✦ + ĐIỂM ✦' : '−1 ♥'}</span>{game.feedbackGood && <b>✧ ✨ ✧</b>}</div>}
        {game.phase === 'ready' && <div className="river-overlay"><div><span className="river-tag">SẴN SÀNG XUỐNG SÔNG?</span><h3>Lái thuyền vào phao đúng</h3><div className="river-demo" aria-hidden="true"><span>←</span><div><Boat/></div><span>→</span></div><p>← → hoặc A/D để đổi làn.<br/>Trên điện thoại: chạm nút lái hoặc vuốt ngang trên sông.</p><p>Chạm phao đúng được điểm. Sai phao hoặc đụng đá mất 1 tim. Hết 3 tim thì về bến ôn lại.</p><button type="button" className="river-primary" onClick={start}>Bắt đầu đua thuyền</button></div></div>}
        {game.phase === 'intro' && <div className="river-countdown" role="status"><strong>{Math.max(1,3 - Math.floor(game.introTime))}</strong><span>Nhìn câu hỏi, chọn làn, giữ tay lái!</span></div>}
        {game.phase === 'paused' && <div className="river-overlay"><div><span className="river-tag">ĐÃ TẠM DỪNG</span><h3>Thuyền đang neo an toàn</h3><p>Thời gian và cổng Toán cùng dừng. Khi đổi tab, game cũng tự tạm dừng.</p><button type="button" className="river-primary" onClick={() => {if(renderSession !== session.current || current.current.phase !== 'paused')return;update(resumeRiver(current.current));stage.current?.focus();}}>Tiếp tục chèo</button><button type="button" className="river-secondary" onClick={() => {if(renderSession === session.current && current.current.phase === 'paused')update({...current.current,phase:'finished'});}}>Kết thúc và xem lời giải</button></div></div>}
      </div>
      <p className="river-live" role="status" aria-live="polite">{game.feedback || 'Chọn đúng làn trước khi phao chạm vạch. Sẵn sàng chưa?'}</p>
      <div className="river-controls"><button type="button" aria-label="Lái thuyền sang trái" disabled={game.phase !== 'running' || game.lane === 0 || game.wave === 'feedback'} onClick={() => steer(-1)}>← <span>Trái</span></button><button type="button" className="river-pause" disabled={!playing} onClick={pause}>Ⅱ Tạm dừng</button><button type="button" aria-label="Lái thuyền sang phải" disabled={game.phase !== 'running' || game.lane === 2 || game.wave === 'feedback'} onClick={() => steer(1)}><span>Phải</span> →</button></div>
      <p className="river-hint">Thuyền ở làn {game.lane + 1}/3. Mẹo: tính xong sớm thì giữ làn. Đoạn có đá hãy quan sát rồi đổi làn. Nhấn P để tạm dừng.</p>
    </>}
    <footer className="river-credit">MTM sưu tầm và biên soạn · Bộ câu tự biên soạn: hằng đẳng thức và phương trình THCS · Luyện cá nhân trên thiết bị này.</footer>
  </section>;
}

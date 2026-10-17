import {useEffect,useId,useRef,useState} from 'react';
import {checkWarmupAnswer,HOMEWORK_WARMUP_TOPICS,warmupCards,type WarmupCard,type WarmupTopic} from './warmup';
import './warmup.css';
type Session={cards:readonly WarmupCard[];index:number;input:string;result:'correct'|'retry'|null;invalid:boolean;again:string[];correct:number;review:boolean};
type TopicChange={topic:WarmupTopic;session:Session};
export default function HomeworkWarmup(){
  const id=useId(),[topic,setTopic]=useState<WarmupTopic>('conditions'),[session,setSession]=useState<Session|null>(null),[topicChange,setTopicChange]=useState<TopicChange|null>(null);
  const active=useRef(session),activeTopic=useRef(topic),pending=useRef(topicChange),target=useRef<'card'|'solution'|'summary'|'chooser'|'confirmation'|'input'|null>(null);
  const cardRef=useRef<HTMLHeadingElement>(null),solutionRef=useRef<HTMLDivElement>(null),summaryRef=useRef<HTMLDivElement>(null),inputRef=useRef<HTMLInputElement>(null),chooserRef=useRef<HTMLSelectElement>(null),confirmationRef=useRef<HTMLDivElement>(null);
  active.current=session;activeTopic.current=topic;pending.current=topicChange;
  useEffect(()=>{if(target.current==='card')cardRef.current?.focus();if(target.current==='solution')solutionRef.current?.focus();if(target.current==='summary')summaryRef.current?.focus();if(target.current==='chooser')chooserRef.current?.focus();if(target.current==='confirmation')confirmationRef.current?.focus();if(target.current==='input')inputRef.current?.focus();target.current=null;},[session,topicChange]);
  const commit=(next:Session|null,focus:'card'|'solution'|'summary'|'chooser'|null=null)=>{active.current=next;target.current=focus;setSession(next);};
  const start=(cards:readonly WarmupCard[],review=false)=>commit({cards,index:0,input:'',result:null,invalid:false,again:[],correct:0,review},'card');
  const card=session?.cards[session.index],finished=!!session&&session.index===session.cards.length;
  const requestTopic=(value:string)=>{
    if(pending.current||!HOMEWORK_WARMUP_TOPICS.some(item=>item.id===value)||value===activeTopic.current)return;
    const nextTopic=value as WarmupTopic,current=active.current;
    if(current&&current.index<current.cards.length){const request={topic:nextTopic,session:current};pending.current=request;target.current='confirmation';setTopicChange(request);return;}
    activeTopic.current=nextTopic;setTopic(nextTopic);commit(null,'chooser');
  };
  const keepTopic=()=>{
    if(!topicChange||pending.current!==topicChange)return;
    pending.current=null;target.current=topicChange.session.result?'solution':'input';setTopicChange(null);
  };
  const acceptTopic=()=>{
    if(!topicChange||pending.current!==topicChange||active.current!==topicChange.session)return;
    activeTopic.current=topicChange.topic;setTopic(topicChange.topic);pending.current=null;setTopicChange(null);commit(null,'chooser');
  };
  const check=()=>{
    if(pending.current||!session||active.current!==session||!card||session.result)return;
    const result=checkWarmupAnswer(card,session.input);
    if(result==='invalid'){commit({...session,invalid:true});inputRef.current?.focus();return;}
    commit({...session,result,invalid:false},'solution');
  };
  const next=()=>{
    if(pending.current||!session||active.current!==session||!card||!session.result)return;
    const index=session.index+1;
    commit({...session,index,input:'',result:null,invalid:false,again:session.result==='retry'?[...session.again,card.id]:session.again,correct:session.correct+(session.result==='correct'?1:0)},index===session.cards.length?'summary':'card');
  };
  return <div className="btvn-warmup" data-version="v1">
    <p className="btvn-warmup-note">Bộ thẻ nền tảng THCS do MTM biên soạn, độc lập với đề BTVN. Không tính điểm, không gửi dữ liệu và chỉ giữ phiên này khi trang còn mở. Thời lượng là gợi ý, không có đếm ngược.</p>
    <label htmlFor={id+'-topic'}>Chọn trọng tâm khởi động</label><select ref={chooserRef} id={id+'-topic'} value={topic} disabled={!!topicChange} aria-describedby={id+'-topic-help'} onChange={event=>requestTopic(event.target.value)}>{HOMEWORK_WARMUP_TOPICS.map(item=><option key={item.id} value={item.id}>{item.title}</option>)}</select>
    <p id={id+'-topic-help'} className="btvn-warmup-note">Khi lượt thẻ chưa kết thúc, em sẽ xác nhận trước khi đổi trọng tâm. Bài làm BTVN không bị ảnh hưởng.</p>
    {topicChange&&<div ref={confirmationRef} tabIndex={-1} className="btvn-warmup-confirmation" role="group" aria-labelledby={id+'-change-title'} aria-describedby={id+'-change-help'} onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();keepTopic();}}}>
      <h3 id={id+'-change-title'}>Đổi sang {HOMEWORK_WARMUP_TOPICS.find(item=>item.id===topicChange.topic)?.title}?</h3>
      <p id={id+'-change-help'}>Em đang ở thẻ {session!.index+1}/{session!.cards.length}. Đổi trọng tâm sẽ xóa lượt thẻ hiện tại, gồm cả phần đang nhập. Chọn tiếp tục để giữ nguyên bài đang làm.</p>
      <button type="button" className="btvn-warmup-primary" onClick={keepTopic}>Tiếp tục lượt thẻ hiện tại</button><button type="button" onClick={acceptTopic}>Đổi trọng tâm và xóa lượt thẻ</button>
      <p className="btvn-warmup-note">Có thể nhấn Escape để tiếp tục lượt thẻ hiện tại.</p>
    </div>}
    {!session?<button type="button" className="btvn-warmup-primary" onClick={()=>{if(active.current===null&&activeTopic.current===topic)start(warmupCards(topic));}}>Bắt đầu 3 thẻ</button>:finished?<div className="btvn-warmup-summary" ref={summaryRef} tabIndex={-1} role="group" aria-labelledby={id+'-summary'}>
      <h3 id={id+'-summary'}>{session.review?'Đã đối chiếu lượt ôn lại':'Đã đối chiếu 3 thẻ'}</h3>
      <p role="status">Khớp đáp án từ lần nhập: {session.correct}/{session.cards.length}. Cần luyện lại: {session.again.length} thẻ.</p>
      {session.again.length>0?<><p>Ôn lại đúng các thẻ chưa khớp, thử tự giải trước khi xem lời giải:</p><ul>{session.cards.filter(item=>session.again.includes(item.id)).map(item=><li key={item.id}>{item.prompt}</li>)}</ul><button type="button" className="btvn-warmup-primary" onClick={()=>{if(active.current===session)start(session.cards.filter(item=>session.again.includes(item.id)),true);}}>Ôn lại {session.again.length} thẻ cần luyện</button></>:<p>Em đã khớp cả lượt này. Hãy mang thói quen kiểm điều kiện, dấu và thử nghiệm vào bài BTVN.</p>}
      <button type="button" onClick={()=>{if(active.current===session)commit(null,'chooser');}}>Chọn lượt khởi động mới</button>
    </div>:card&&<article className="btvn-warmup-card">
      <p className="btvn-warmup-note">{session.review?'Ôn lại · ':''}Thẻ {session.index+1}/{session.cards.length}</p>
      <h3 ref={cardRef} tabIndex={-1}>{card.prompt}</h3>
      {!session.result?<><label htmlFor={id+'-input'}>Kết quả em tự tìm được</label><input ref={inputRef} id={id+'-input'} type="text" inputMode="decimal" autoComplete="off" maxLength={30} value={session.input} disabled={!!topicChange} aria-invalid={session.invalid} aria-describedby={id+'-input-help'} onChange={event=>{if(!pending.current&&active.current===session)commit({...session,input:event.target.value,invalid:false});}} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();check();}}}/><p id={id+'-input-help'} className="btvn-warmup-note">Nhập một số, dùng dấu trừ nếu cần. Chấp nhận dấu phẩy hoặc dấu chấm thập phân.</p>{session.invalid&&<p role="alert">Em nhập một số hợp lệ trước khi đối chiếu.</p>}<button type="button" className="btvn-warmup-primary" disabled={!!topicChange} onClick={check}>Đối chiếu và xem từng bước</button></>:<>
        <div ref={solutionRef} tabIndex={-1} className="btvn-warmup-solution" role="group" aria-labelledby={id+'-solution'}><h4 id={id+'-solution'}>{session.result==='correct'?'Kết quả khớp. Em đọc lại cách làm nhé.':'Kết quả chưa khớp. Cùng tìm bước cần sửa nhé.'}</h4><p>Em đã nhập: <b>{session.input}</b>. Kết quả cần tìm: <b>{String(card.answer).replace('-','−')}</b>.</p><ol>{card.steps.map((step,index)=><li key={index}>{step}</li>)}</ol><p><b>Điều cần nhớ:</b> {card.takeaway}</p></div>
        <button type="button" className="btvn-warmup-primary" disabled={!!topicChange} onClick={next}>{session.index+1===session.cards.length?'Xem tổng kết thẻ':'Sang thẻ tiếp'}</button>
      </>}
    </article>}
    <p className="btvn-warmup-note">MTM sưu tầm và biên soạn. Thu gọn giữ phiên; rời trang, tải lại hoặc xác nhận đổi trọng tâm sẽ xóa tiến độ thẻ.</p>
  </div>;
}

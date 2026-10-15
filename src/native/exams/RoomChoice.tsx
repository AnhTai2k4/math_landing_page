import {useContext,type ReactNode} from 'react';
import type {Choice} from './assessment';
import {RoomAnswerContext} from './RoomAnswerContext';

/** Chỉ bật tương tác trong phòng; ngoài phòng giữ nguyên chữ nguồn. */
export default function RoomChoice({questionId,choice,children}:{questionId:string;choice:string;children:ReactNode}) {
  const room=useContext(RoomAnswerContext);
  if(!room||room.questionId!==questionId||!['A','B','C','D'].includes(choice))return <>{children}</>;
  return <button type="button" className="fr-source-choice" aria-pressed={room.answer===choice} disabled={room.disabled} onClick={()=>room.choose(choice as Choice)}><span className="fr-sr-only">Chọn </span><span className="fr-choice-letter">{choice}</span><span>{children}</span><span className="fr-choice-tick" aria-hidden="true">✓</span></button>;
}

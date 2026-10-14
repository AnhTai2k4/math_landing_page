import {useContext,type ReactNode} from 'react';
import type {Choice} from './assessment';
import {RoomAnswerContext} from './RoomAnswerContext';

/** Chỉ bật tương tác trong phòng; ngoài phòng giữ nguyên chữ nguồn. */
export default function RoomChoice({questionId,choice,children}:{questionId:string;choice:string;children:ReactNode}) {
  const room=useContext(RoomAnswerContext);
  if(!room||room.questionId!==questionId||!['A','B','C','D'].includes(choice))return <>{children}</>;
  return <button type="button" className="fr-source-choice" aria-label={`Chọn ${choice}`} aria-pressed={room.answer===choice} disabled={room.disabled} onClick={()=>room.choose(choice as Choice)}>{children}</button>;
}

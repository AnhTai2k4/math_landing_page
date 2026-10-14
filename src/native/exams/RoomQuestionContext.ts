import {createContext} from 'react';
/** null: trình đọc cũ. number: chỉ hiển thị đúng câu trong phòng tập trung. */
export const RoomQuestionContext=createContext<number|null>(null);

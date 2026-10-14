import {createContext} from 'react';
import type {Choice} from './assessment';
export const RoomAnswerContext=createContext<{questionId:string;answer:unknown;disabled:boolean;choose:(choice:Choice)=>void}|null>(null);

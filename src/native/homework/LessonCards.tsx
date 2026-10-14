import React,{useState} from 'react';
import type {HomeworkLesson} from './btvn-contract';
import {isDemoVideo} from './presentation';
const dateTime=(at:number)=>new Date(at).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'});
export function LessonVideo({lesson,demo}:{lesson:HomeworkLesson;demo:boolean}){
  if(!lesson.videoId)return lesson.videoUrl?<p id={'video-'+lesson.lessonCode}><a href={lesson.videoUrl} target="_blank" rel="noopener noreferrer">Mở video buổi học ở trang ngoài</a></p>:null;
  return <div id={'video-'+lesson.lessonCode} className="btvn-player">{demo&&isDemoVideo(lesson.videoId)?<div className="btvn-video-placeholder" role="img" aria-label={'Video mẫu buổi '+lesson.date}><b>▶</b><span>Video buổi {lesson.date.slice(8,10)}/{lesson.date.slice(5,7)}</span><small>Khung minh họa · chưa có video thật</small></div>:<iframe title={'Video bài giảng: '+lesson.title} src={'https://www.youtube-nocookie.com/embed/'+lesson.videoId+'?rel=0'} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen referrerPolicy="strict-origin-when-cross-origin"/>}</div>;
}
export default function LessonCards({lessons,busy,onHomework,demo=false}:{lessons:HomeworkLesson[];busy:boolean;onHomework:(code:string)=>void;demo?:boolean}){
  const [opened,setOpened]=useState<string|null>(null),[invited,setInvited]=useState<string|null>(null);
  return <div className="btvn-cards"><div className="btvn-lead"><h1>Các buổi học của lớp</h1><p>Mỗi buổi có video bài giảng và BTVN. Em xem video trước hoặc làm BTVN luôn, tùy em.</p><div className="btvn-legend"><span className="btvn-chip vid">▶ Có video bài giảng</span><span className="btvn-chip review">↻ Buổi ôn tập, không có video</span></div></div>
    {[...lessons].sort((a,b)=>b.date.localeCompare(a.date)).map(lesson=>{const isOpen=opened===lesson.lessonCode;
      const day=new Date(lesson.date+'T00:00:00+07:00');const status=lesson.bestScore===null?'Chưa làm BTVN':`${lesson.late===true?'Nộp muộn':'Đã nộp'} · ${lesson.bestScore.toLocaleString('vi-VN')}/10`;
      const doHomework=()=>onHomework(lesson.lessonCode);
      return <section key={lesson.lessonCode} className={'btvn-card'+(isOpen?' open':'')}><div className="btvn-card-head"><div className="btvn-date"><b>{lesson.date.slice(8,10)+'/'+lesson.date.slice(5,7)}</b><span>{day.toLocaleDateString('vi-VN',{weekday:'long',timeZone:'Asia/Ho_Chi_Minh'})}</span></div><div className="btvn-title"><h2>{lesson.title}</h2><span className={'btvn-chip '+((lesson.videoId||lesson.videoUrl)?'vid':'review')}>{(lesson.videoId||lesson.videoUrl)?'▶ Có video bài giảng':'↻ Buổi ôn tập, không có video'}</span></div><div className="btvn-card-status"><b className={lesson.bestScore===null?'todo':lesson.late?'late':'ok'}>{status}</b><span>Hạn: {lesson.dueAt===null?'Chờ xác minh buổi thực học kế tiếp':dateTime(lesson.dueAt)}</span>{lesson.submittedAt!==null&&<span>Nộp: {dateTime(lesson.submittedAt)}{lesson.late===null?' · Chờ xác minh hạn':''}</span>}</div></div>
      {!lesson.videoId&&!lesson.videoUrl&&<p className="btvn-review-note">Buổi ôn tập, không có kiến thức mới nên không có video</p>}
      <div className={'btvn-card-actions'+(!(lesson.videoId||lesson.videoUrl)?' single':'')}>{(lesson.videoId||lesson.videoUrl)&&<button className="btvn-btn gold" aria-expanded={isOpen} aria-controls={'video-'+lesson.lessonCode} onClick={()=>{setOpened(isOpen?null:lesson.lessonCode);if(isOpen)setInvited(lesson.lessonCode);}}>{isOpen?'Đóng video':'▶ Xem video'}</button>}<button className="btvn-btn primary" disabled={busy||!lesson.available} onClick={doHomework}>✎ Làm BTVN</button></div>
      {!lesson.available&&<p className="btvn-review-note">BTVN buổi này đang chờ chuẩn bị.</p>}
      {isOpen&&<LessonVideo lesson={lesson} demo={demo}/>}
      <div className="btvn-files">{lesson.materialUrl&&<a href={lesson.materialUrl} target="_blank" rel="noopener noreferrer">📄 Tài liệu buổi học</a>}{lesson.handoutUrl&&<a href={lesson.handoutUrl} target="_blank" rel="noopener noreferrer">📄 Handout</a>}{lesson.homeworkNote&&<span>{lesson.homeworkNote}</span>}</div>
      {(isOpen||invited===lesson.lessonCode)&&<div className="btvn-after"><p><b>Xem xong rồi?</b> Em có thể làm BTVN của buổi này ngay.</p><button className="btvn-btn primary" disabled={busy||!lesson.available} onClick={doHomework}>Làm BTVN buổi này</button></div>}
    </section>;})}
    {!lessons.length&&<p>Chưa có buổi học được xác minh cho lớp em.</p>}<p className="btvn-footnote">Buổi mới nhất ở trên cùng. Điểm lấy lần cao nhất; nộp sau giờ vào buổi kế tiếp mà em thực học vẫn được nhưng ghi nộp muộn.</p>
  </div>;
}

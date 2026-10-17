import React, {Component, lazy, Suspense, useEffect, useRef, useState} from 'react';
import './playground.css';

const createRiver = () => lazy(() => import('./RiverRace'));
export class RiverBoundary extends Component<{children: React.ReactNode; retry: () => void; onExit: () => void}, {failed: boolean}> {
  state = {failed:false};
  private retryButton = React.createRef<HTMLButtonElement>();
  static getDerivedStateFromError() { return {failed:true}; }
  componentDidCatch() { this.retryButton.current?.focus(); }
  render() { return this.state.failed ? <div role="alert" className="river-error"><p>Game chưa tải được. Em có thể thử mở lại hoặc về sân chơi.</p><button ref={this.retryButton} type="button" onClick={this.props.retry}>Thử tải lại game</button><button type="button" onClick={this.props.onExit}>Về sân chơi</button></div> : this.props.children; }
}

export default function Playground() {
  const [open,setOpen] = useState(false);
  const [loader,setLoader] = useState(() => ({View:createRiver(),revision:0}));
  const launchButton=useRef<HTMLButtonElement>(null),gameArea=useRef<HTMLDivElement>(null),returnFocus=useRef(false);
  useEffect(() => {
    if(open&&!gameArea.current?.contains?.(typeof document==='undefined'?null:document.activeElement))(gameArea.current?.querySelector?.<HTMLElement>('#river-game-heading')??gameArea.current)?.focus();
    else if(returnFocus.current){launchButton.current?.focus();returnFocus.current=false;}
  },[open,loader.revision]);
  const close=() => {returnFocus.current=true;setOpen(false);};
  const RiverRace=loader.View;
  return <div className="mtm-playground" data-version="river-v1">
    <a className="river-back" href="/luyen-tap">← Về Luyện tập</a>
    <header className="playground-heading"><span className="river-eyebrow">MINH THÀNH MATH · HỌC MÀ CHƠI</span><h1>Sân chơi Toán</h1><p>Đầu nghĩ, tay lái. Mỗi đáp án đúng đưa em đi xa hơn.</p></header>
    {open ? <div ref={gameArea} data-river-focus-area role="region" aria-label="Khu vực Đua thuyền Toán" tabIndex={-1}><RiverBoundary key={loader.revision} onExit={close} retry={() => setLoader(previous => ({View:createRiver(),revision:previous.revision + 1}))}><Suspense fallback={<div className="river-loading"><p role="status">Đang đưa thuyền xuống sông…</p><button type="button" onClick={close}>Hủy mở game</button></div>}><RiverRace onExit={close}/></Suspense></RiverBoundary></div> : <section className="river-launch-card" aria-labelledby="river-card-heading">
      <div className="river-cover" aria-hidden="true"><svg viewBox="0 0 600 300"><path fill="#d8f2e7" d="M0 0h600v300H0z"/><path fill="#72d1e5" d="M140 0h320l-10 60 30 80-15 70 40 90H90l30-80-15-70 40-80z"/><path d="M220 0l-10 300M390 0l20 300" stroke="white" strokeWidth="3" strokeDasharray="15 17" opacity=".6"/><g className="river-cover-waves" fill="none" stroke="white" strokeWidth="3"><path d="M155 70q15 8 30 0m240 60q15 8 30 0M160 220q15 8 30 0m200 25q15 8 30 0"/></g><g transform="translate(285 165)"><path d="M0-45Q-28-18-20 35L0 48l20-13Q28-18 0-45" fill="#FFCF24" stroke="#213269" strokeWidth="5"/><ellipse cy="0" rx="12" ry="18" fill="#213269"/><circle cy="-8" r="8" fill="#f6c9a3"/><path d="M-28-3l55 22" stroke="#213269" strokeWidth="7" strokeLinecap="round"/></g><g fontSize="24" fontWeight="800" textAnchor="middle" fill="#213269"><circle cx="190" cy="70" r="28" fill="white"/><text x="190" y="78">6</text><circle cx="300" cy="60" r="28" fill="#FFCF24"/><text x="300" y="68">4</text><circle cx="410" cy="70" r="28" fill="white"/><text x="410" y="78">8</text></g><path d="M100 275l30-40 35 40m310-220 23-32 27 32" fill="#213269" opacity=".3"/></svg><span>3 LÀN · 8 CỔNG TOÁN · 3 TIM</span></div>
      <div className="river-launch-copy"><span className="river-tag">GAME MỚI · ĐẠI SỐ THCS</span><h2 id="river-card-heading">Đua thuyền Toán</h2><p>Lái thuyền ăn phao đáp án, né đá giữa dòng và giữ combo để tăng tốc. Về bến rồi cùng gỡ những câu sai.</p><ul><li>Phím ← →, A/D hoặc chạm hai nút lái.</li><li>Hằng đẳng thức và phương trình, mức vận dụng.</li><li>Một lượt khoảng 2 đến 3 phút. Có tạm dừng.</li></ul><button ref={launchButton} type="button" className="river-primary" onClick={() => setOpen(true)}>Xuống sông chơi thử →</button><small>MTM tự biên soạn. Luyện cá nhân, không xếp hạng trực tuyến.</small></div>
    </section>}
  </div>;
}

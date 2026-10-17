import {useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type TouchEvent} from 'react';
import {ArrowRight, ArrowUpRight, ChevronLeft, ChevronRight, Pause, Play, X} from 'lucide-react';
import {courses, step as courseStep} from './catalogue';
import {Link} from './navigation';
import {SocialLinks} from '../components/SocialLinks';
import './R104Hero.css';

const photographs = [
  {src: '/r104-photos/classroom-original.png', tab: 'Lớp học', caption: 'Một khoảnh khắc cùng lớp', alt: 'Ảnh lớp học Minh Thành Math từ thư viện MTM'},
  {src: '/r104-photos/learning-original.webp', tab: 'Học cùng MTM', caption: 'Học cùng thầy cô và những người bạn', alt: 'Thầy và các bạn cùng học tại Minh Thành Math'},
  {src: '/r104-photos/teacher-original.jpg', tab: 'Thầy Thành', caption: 'Thầy Tô Minh Thành', alt: 'Ấn phẩm giới thiệu thầy Tô Minh Thành được giữ nguyên từ MTM'},
] as const;
const programmes = ['THCS', 'Toán 10 & 11', 'Toán 12', 'HSA', 'TSA'] as const;
const labels = ['Nền tảng', 'Vận dụng', 'Nâng cao', 'Luyện đề', 'ĐGNL / ĐGTD'];
const roadmap = [1, 2, 3, 4, 5].map(n => courses.find(course => course.grade === 12 && courseStep(course) === n));
type Programme = typeof programmes[number];
type Variables = CSSProperties & Record<`--${string}`, string | number>;
const wrap = (n: number) => (n + photographs.length) % photographs.length;

/** Selected R100.4 composition, with the real course catalogue and native navigation. */
export default function R104Hero() {
  const [programme, setProgramme] = useState<Programme>('Toán 12');
  const [selected, setSelected] = useState(0);
  const [paused, setPaused] = useState(false);
  const [photo, setPhoto] = useState(1);
  const [shown, setShown] = useState(1);
  const [incoming, setIncoming] = useState<number | null>(null);
  const [photoError, setPhotoError] = useState('');
  const [view, setView] = useState(1);
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const imageLayer = useRef<HTMLImageElement>(null);
  const shownRef = useRef(shown);
  const generation = useRef(0);
  const gesture = useRef<{x: number; y: number} | null>(null);
  const suppressOpenUntil = useRef(0);
  const thumbnailBar = useRef<HTMLDivElement>(null);
  shownRef.current = shown;
  const guided = programme === 'THCS' || programme === 'Toán 10 & 11';
  const effectiveStep = programme === 'HSA' || programme === 'TSA' ? 4 : selected;
  const course = roadmap[effectiveStep];
  const courseTitle = guided ? programme === 'THCS' ? 'Học chắc nền tảng Toán THCS' : 'Từng bước vững Toán 10 & 11' : course?.title || 'Tìm lộ trình phù hợp';
  const courseHref = guided ? '/#courses' : course ? '/khoa-hoc/' + encodeURIComponent(course.slug) : '/khoa-hoc';

  useEffect(() => {
    const token = ++generation.current;
    setIncoming(null);
    setPhotoError('');
    if (shownRef.current === photo) return;
    let disposed = false;
    const preload = new Image();
    preload.decoding = 'async';
    const loaded = new Promise<void>((resolve, reject) => {preload.onload = () => resolve(); preload.onerror = () => reject(new Error('image-unavailable'));});
    preload.src = photographs[photo].src;
    // Both promises have rejection handlers immediately, including browsers with decode().
    const ready = typeof preload.decode === 'function' ? Promise.all([loaded, preload.decode()]) : loaded;
    void ready.then(() => {
      if (disposed || generation.current !== token) return;
      if (paused || matchMedia('(prefers-reduced-motion: reduce)').matches) setShown(photo);
      else setIncoming(photo);
    }).catch(() => {if (!disposed && generation.current === token) setPhotoError('Chưa tải được ảnh này. Em vẫn có thể xem ảnh hiện tại.');});
    return () => {disposed = true; preload.onload = null; preload.onerror = null;};
  }, [photo, paused]);

  useLayoutEffect(() => {
    if (incoming === null) return;
    const layer = imageLayer.current;
    if (!layer) return;
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    let disposed = false;
    const commit = () => {if (!disposed) {setShown(incoming); setIncoming(null);}};
    if (paused || media.matches || typeof layer.animate !== 'function') {commit(); return;}
    const animation = layer.animate([{opacity: 0, transform: 'translateX(4px)'}, {opacity: 1, transform: 'translateX(0)'}], {duration: 500, easing: 'cubic-bezier(.2,.75,.25,1)', fill: 'both'});
    const change = () => {if (media.matches) commit();};
    media.addEventListener('change', change);
    void animation.finished.then(commit).catch(() => {});
    return () => {disposed = true; animation.cancel(); media.removeEventListener('change', change);};
  }, [incoming, paused]);

  useLayoutEffect(() => {
    const bar = thumbnailBar.current;
    if (!bar) return;
    const measure = () => {const target = bar.children[shown] as HTMLElement | undefined; if (!target) return; bar.style.setProperty('--tab-x', target.offsetLeft + 'px'); bar.style.setProperty('--tab-y', target.offsetTop + 'px'); bar.style.setProperty('--tab-w', target.offsetWidth + 'px'); bar.style.setProperty('--tab-h', target.offsetHeight + 'px');};
    const observer = new ResizeObserver(measure);
    observer.observe(bar); measure();
    return () => observer.disconnect();
  }, [shown]);

  const advance = (delta: number) => setPhoto(current => wrap(current + delta));
  const openPhoto = () => {if (performance.now() < suppressOpenUntil.current) return; opener.current = document.activeElement as HTMLElement; setView(shownRef.current); dialog.current?.showModal();};
  const photoKeys = (event: KeyboardEvent) => {if (event.altKey || event.ctrlKey || event.metaKey) return; if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {event.preventDefault(); advance(event.key === 'ArrowRight' ? 1 : -1);}};
  const touchEnd = (event: TouchEvent) => {const start = gesture.current; gesture.current = null; const end = event.changedTouches[0]; if (!start || !end) return; const dx = end.clientX - start.x, dy = end.clientY - start.y; if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.2) {suppressOpenUntil.current = performance.now() + 550; advance(dx < 0 ? 1 : -1);}};
  const selectStep = (next: number) => {setSelected(next); setProgramme('Toán 12');};
  const roadmapKeys = (event: KeyboardEvent<HTMLDivElement>) => {let next: number; if (['ArrowRight', 'ArrowDown'].includes(event.key)) next = (effectiveStep + 1) % 5; else if (['ArrowLeft', 'ArrowUp'].includes(event.key)) next = (effectiveStep + 4) % 5; else if (event.key === 'Home') next = 0; else if (event.key === 'End') next = 4; else return; event.preventDefault(); selectStep(next); event.currentTarget.querySelectorAll<HTMLButtonElement>('button')[next]?.focus();};

  return <section className="r104-hero" id="home" aria-labelledby="r104-home-title" data-motion-paused={paused}>
    <div className="r104-workspace">
      <GoldenArch selected={effectiveStep} programme={programme} paused={paused}/>
      <div className="r104-intro">
        <p className="r104-eyebrow"><i/> TOÁN THCS · THPT · HSA · TSA</p>
        <h1 id="r104-home-title"><span>Hiểu bản chất.</span><em>Vững từng bước.</em></h1>
        <p className="r104-description">Học Toán cùng thầy cô và những người bạn.<br/>Trực tiếp và online, từ nền tảng đến vận dụng.</p>
        <div className="r104-actions mtm-hero-actions"><Link href="/#courses" className="r104-primary">Tìm lớp phù hợp <span><ArrowRight size={20}/></span></Link><SocialLinks label="Kênh MTM cạnh nút tìm lớp"/><Link href="/btvn" className="r104-text-link">Vào BTVN <ArrowUpRight size={17}/></Link></div>
      </div>
      <aside className="r104-programmes" aria-label="Chương trình học">
        <span className="r104-kicker">CHỌN ĐIỂM BẮT ĐẦU</span>
        <div className="r104-programme-nav" style={{'--programme-index': programmes.indexOf(programme)} as Variables}>{programmes.map((item, index) => <button type="button" key={item} aria-pressed={item === programme} onClick={() => setProgramme(item)}><small>0{index + 1}</small><strong>{item}</strong><ArrowUpRight size={17}/></button>)}</div>
        <label className="r104-programme-select"><span>Chương trình của em</span><select value={programme} onChange={event => setProgramme(event.target.value as Programme)}>{programmes.map(item => <option key={item}>{item}</option>)}</select></label>
        <p>Mỗi bạn một điểm bắt đầu.<br/>Cùng MTM tìm lộ trình phù hợp.</p>
      </aside>
      <div className="r104-album">
        <span className="r104-scene-label">CÓ TOÁN. CÓ BẠN. CÓ MTM.</span>
        <button className="r104-photo" type="button" aria-label="Mở ảnh MTM đầy đủ" aria-busy={photo !== shown} onClick={openPhoto} onKeyDown={photoKeys} onTouchStart={event => {const touch = event.touches[0]; gesture.current = event.touches.length === 1 ? {x: touch.clientX, y: touch.clientY} : null;}} onTouchEnd={touchEnd} onTouchCancel={() => {gesture.current = null;}} onDragStart={event => event.preventDefault()}>
          <img src={photographs[shown].src} alt={photographs[shown].alt} width={2048} height={1282} decoding="async" draggable={false}/>
          {incoming !== null && <img ref={imageLayer} className="r104-incoming" src={photographs[incoming].src} alt="" aria-hidden="true" width={2048} height={1282} decoding="async" draggable={false}/>}
        </button>
        <div className="r104-photo-caption"><strong aria-live="polite"><span className="r104-caption-full">{photographs[shown].caption}</span><span className="r104-caption-short">{photographs[shown].tab}</span></strong><div><button type="button" aria-label="Mở ảnh MTM đang hiển thị" onClick={openPhoto}><ArrowUpRight size={18}/></button><button type="button" aria-label="Ảnh MTM trước" onClick={() => advance(-1)}><ChevronLeft size={18}/></button><span>0{shown + 1} / 03</span><button type="button" aria-label="Ảnh MTM sau" onClick={() => advance(1)}><ChevronRight size={18}/></button></div></div>
        <div className="r104-photo-tabs" ref={thumbnailBar} role="group" aria-label="Chọn ảnh MTM">{photographs.map((item, index) => <button type="button" key={item.src} aria-pressed={shown === index} onClick={() => setPhoto(index)}><img src={item.src} alt="" width={90} height={82} decoding="async"/><span>{item.tab}</span></button>)}</div>
        {photoError && <p className="r104-image-error" role="status">{photoError}</p>}
      </div>
      <div className="r104-mobile-actions mtm-hero-actions"><Link href="/#courses" className="r104-primary">Tìm lớp phù hợp <span><ArrowRight size={20}/></span></Link><SocialLinks label="Kênh MTM cạnh nút tìm lớp trên điện thoại"/><Link href="/btvn" className="r104-text-link">Vào BTVN <ArrowUpRight size={17}/></Link></div>
      <article className="r104-course" aria-label="Lộ trình của em">
        <div className="r104-course-top"><span>LỘ TRÌNH CỦA EM</span><span>{guided ? 'LỚP HỌC' : programme === 'Toán 12' ? 'TOÁN 12' : 'HSA · TSA'}</span></div>
        <div className="r104-course-heading"><span className="r104-course-number" aria-hidden="true">{guided ? '↗' : '0' + (effectiveStep + 1)}</span><h2>{courseTitle.startsWith('Step ') ? <><small>{courseTitle.split(':')[0]}:</small>{courseTitle.split(':').slice(1).join(':').trim()}</> : courseTitle}</h2></div>
        {guided ? <div className="r104-guidance"><p>Học chắc nền tảng, rèn cách trình bày và tìm lớp phù hợp tiến độ ở trường.</p><Link href="/#timetable" className="r104-text-link">Xem lịch tham chiếu <ArrowRight size={16}/></Link></div> : <div className="r104-dial"><div className="r104-dial-label"><span>CHỌN KHÓA HỌC</span><strong>{labels[effectiveStep]}</strong></div><div className="r104-roadmap" role="group" aria-label="Chọn khóa học" onKeyDown={roadmapKeys}>{labels.map((label, index) => <button type="button" key={label} aria-label={`Khóa ${index + 1}: ${label}`} aria-pressed={effectiveStep === index} tabIndex={effectiveStep === index ? 0 : -1} onClick={() => selectStep(index)}><span className="r104-node">0{index + 1}</span><small>{label}</small></button>)}</div><p className="r104-dial-note">Chọn một khóa. Hoặc dùng phím mũi tên.</p></div>}
        <Link href={courseHref} className="r104-course-explore"><span>{guided ? 'Tìm lớp phù hợp' : 'Xem nội dung khóa học'}</span><ArrowUpRight size={19}/></Link>
        <div className="r104-course-foot"><span>Hiểu điều kiện.<br/>Trình bày có căn cứ.</span><div><button type="button" aria-label="Khóa học trước" onClick={() => selectStep((effectiveStep + 4) % 5)}><ChevronLeft size={16}/></button><button type="button" aria-label="Khóa học tiếp theo" onClick={() => selectStep((effectiveStep + 1) % 5)}><ChevronRight size={16}/></button></div></div>
      </article>
      <button className="r104-motion-control" type="button" aria-pressed={paused} onClick={() => setPaused(value => !value)}>{paused ? <Play size={12}/> : <Pause size={12}/>} {paused ? 'Bật' : 'Dừng'} chuyển động</button>
    </div>
    <div className="r104-bottom"><span>Học chắc từng bước. Tiến bộ cùng nhau.</span><nav aria-label="Học cùng MTM"><Link href="/btvn">Bài tập về nhà <ArrowUpRight size={15}/></Link><Link href="/#timetable">Lịch học <ArrowUpRight size={15}/></Link><a href="#home-leaderboard">Bảng xếp hạng <ArrowUpRight size={15}/></a></nav></div>
    <dialog ref={dialog} className="r104-photo-dialog" aria-label="Ảnh MTM đầy đủ" onClose={() => opener.current?.focus()} onClick={event => {if (event.target === dialog.current) dialog.current?.close();}} onKeyDown={event => {if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {event.preventDefault(); setView(value => wrap(value + (event.key === 'ArrowRight' ? 1 : -1)));}}}>
      <div className="r104-dialog-head"><strong>{photographs[view].caption}</strong><button type="button" aria-label="Đóng ảnh" onClick={() => dialog.current?.close()}><X size={22}/></button></div><img src={photographs[view].src} alt={photographs[view].alt} decoding="async"/><div className="r104-dialog-controls"><button type="button" onClick={() => setView(value => wrap(value - 1))}>← Ảnh trước</button><span>{view + 1} / 3</span><button type="button" onClick={() => setView(value => wrap(value + 1))}>Ảnh sau →</button></div>
    </dialog>
  </section>;
}

function GoldenArch({selected, programme, paused}: {selected: number; programme: Programme; paused: boolean}) {
  const host = useRef<HTMLDivElement>(null);
  const settings = useRef({paused}); settings.current.paused = paused;
  const id = useId().replace(/:/g, '');
  useLayoutEffect(() => {
    const el = host.current, area = el?.parentElement;
    if (!el || !area) return;
    const svg = el.querySelector('svg')!, paths = el.querySelectorAll<SVGPathElement>('path');
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    let raf = 0, last = 0, current: number[] | null = null, target: number[] | null = null, visible = true, disposed = false;
    const wake = () => {if (!disposed && !raf && visible && !document.hidden) raf = requestAnimationFrame(draw);};
    const measure = () => {
      const photo = area.querySelector('.r104-album'), node = area.querySelector('.r104-roadmap button[aria-pressed="true"] .r104-node') || area.querySelector('.r104-course-explore');
      if (!photo || !node) return;
      const a = area.getBoundingClientRect(), p = photo.getBoundingClientRect(), n = node.getBoundingClientRect(), rail = area.querySelector('.r104-programme-nav')?.getBoundingClientRect();
      const compact = innerWidth <= 760;
      target = [p.left - a.left, p.top - a.top, p.width, p.height, n.left - a.left + n.width / 2, n.top - a.top + n.height / 2, rail?.width ? rail.right - a.left + 44 : compact ? -8 : -10000, compact ? a.width - 2 : a.width + 300];
      svg.setAttribute('viewBox', `0 0 ${a.width} ${a.height}`);
      if (!current || settings.current.paused || media.matches) current = target.slice();
      wake();
    };
    function draw(time: number) {
      raf = 0; if (!current || !target) return;
      const ease = settings.current.paused || media.matches ? 1 : 1 - Math.exp(-Math.min((time - (last || time - 16)) / 1000, .05) * 13); last = time;
      current = current.map((value, index) => value + (target![index] - value) * ease);
      const [x, y, width, height, ex, ey, limit, edge] = current, right = Math.min(x + width, edge), gap = Math.min(right + 27, edge);
      const d = innerWidth <= 760
        ? `M ${Math.max(x - 40, limit)} ${y + height * .81} C ${Math.max(x - 112, limit)} ${y + 44}, ${x + width * .3} ${y - 92}, ${right - 35} ${y - 17} C ${edge} ${y - 1}, ${edge} ${ey - 70}, ${edge} ${ey - 34} Q ${edge} ${ey}, ${edge - 34} ${ey} H ${ex}`
        : `M ${Math.max(x - 40, limit)} ${y + height * .81} C ${Math.max(x - 112, limit)} ${y + 44}, ${x + width * .3} ${y - 92}, ${right - 35} ${y - 17} C ${Math.min(right + 47, edge)} ${y - 1}, ${gap - 8} ${ey - 35}, ${Math.min(gap + 15, edge)} ${ey - 20} S ${ex - 20} ${ey - 3}, ${ex} ${ey}`;
      paths.forEach(path => path.setAttribute('d', d));
      if (current.some((value, index) => Math.abs(value - target![index]) > .08)) wake(); else last = 0;
    }
    const mutation = new MutationObserver(measure); mutation.observe(el, {attributes: true, attributeFilter: ['data-step', 'data-programme', 'data-paused']});
    const resize = new ResizeObserver(measure); resize.observe(area); for (const child of area.querySelectorAll('.r104-album,.r104-course')) resize.observe(child);
    const intersection = new IntersectionObserver(entries => {visible = entries[0].isIntersecting; if (visible) measure(); else {cancelAnimationFrame(raf); raf = 0; last = 0;}}); intersection.observe(area);
    const visibility = () => {if (document.hidden) {cancelAnimationFrame(raf); raf = 0; last = 0;} else measure();};
    void document.fonts.ready.then(() => {if (!disposed) measure();});
    media.addEventListener('change', measure); document.addEventListener('visibilitychange', visibility); measure();
    return () => {disposed = true; cancelAnimationFrame(raf); mutation.disconnect(); resize.disconnect(); intersection.disconnect(); media.removeEventListener('change', measure); document.removeEventListener('visibilitychange', visibility);};
  }, []);
  return <div ref={host} className="r104-arch" aria-hidden="true" data-step={selected} data-programme={programme} data-paused={paused}><svg preserveAspectRatio="none"><defs><linearGradient id={'r104-gold-' + id} x1="0" y1="0" x2=".75" y2="1"><stop stopColor="#fff4b2"/><stop offset=".19" stopColor="#ffcf24"/><stop offset=".4" stopColor="#ffe983"/><stop offset=".55" stopColor="#ffcf24"/><stop offset=".8" stopColor="#e4b622"/><stop offset="1" stopColor="#fff0a1"/></linearGradient><filter id={'r104-shadow-' + id} x="-20%" y="-45%" width="145%" height="200%"><feDropShadow dx="0" dy="12" stdDeviation="10" floodColor="#213269" floodOpacity=".11"/></filter></defs><g fill="none" strokeLinecap="round" filter={`url(#r104-shadow-${id})`}><path stroke="#d5ab24" strokeWidth="43"/><path stroke={`url(#r104-gold-${id})`} strokeWidth="41"/><path stroke="#fff4b2" strokeWidth="32" opacity=".2"/><path stroke="#fff8cf" strokeWidth="1" opacity=".55"/></g></svg></div>;
}

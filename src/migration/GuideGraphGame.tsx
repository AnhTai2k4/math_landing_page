import {useId,useRef,useState} from 'react';
import {GRAPH_COEFFICIENTS,compareGraphs,graphEquation,graphInfo,readGraphCoefficient,type GraphLine} from './guide-graph-game';
import './guide-graph-game.css';

const displayNumber=(value:number)=>String(value).replace('-','−');

export function LineGraph({line,pinned,id}:{line:GraphLine;pinned:GraphLine|null;id:string}){
 const grid=Array.from({length:9},(_,i)=>i-4),x=(n:number)=>144+n*30,y=(n:number)=>144-n*30,info=graphInfo(line);
 const description=`Phần đồ thị trong khung từ −4 đến 4 trên mỗi trục; hai trục cùng đơn vị, mỗi ô là 1 đơn vị. Trục Ox nằm ngang, chiều dương sang phải; trục Oy thẳng đứng, chiều dương hướng lên. Đồ thị hiện tại ${info.equation}, nét liền. Khi x lần lượt là −1, 0, 1 thì y lần lượt là ${info.values.map(p=>p.y).join(', ')}. ${info.behaviour} ${info.ox} ${info.oy} ${pinned?'Đồ thị ghim '+graphEquation(pinned)+', nét đứt. '+compareGraphs(line,pinned).text:'Chưa ghim đồ thị so sánh.'}`;
 const draw=(value:GraphLine,css:string)=><line className={css} x1={x(-4)} y1={y(value.a*-4+value.b)} x2={x(4)} y2={y(value.a*4+value.b)} clipPath={'url(#'+id+'-clip)'} aria-hidden="true"/>;
 return <figure className="guide-graph-figure">
  <svg viewBox="0 0 292 292" role="img" aria-labelledby={id+'-graph-title '+id+'-graph-desc'}>
   <title id={id+'-graph-title'}>{'Khám phá đồ thị '+info.equation}</title><desc id={id+'-graph-desc'}>{description}</desc>
   <defs><clipPath id={id+'-clip'}><rect x="24" y="24" width="240" height="240"/></clipPath><marker id={id+'-arrow'} markerWidth="7" markerHeight="7" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6" fill="none" stroke="#213269"/></marker></defs>
   <g className="guide-graph-grid" aria-hidden="true">{grid.map(n=><g key={n}><line x1={x(n)} y1="24" x2={x(n)} y2="264"/><line x1="24" y1={y(n)} x2="264" y2={y(n)}/></g>)}</g>
   <g className="guide-graph-axes" aria-hidden="true"><line x1="18" y1="144" x2="280" y2="144" markerEnd={'url(#'+id+'-arrow)'}/><line x1="144" y1="274" x2="144" y2="14" markerEnd={'url(#'+id+'-arrow)'}/></g>
   {pinned&&draw(pinned,'guide-graph-pinned')}{draw(line,'guide-graph-line')}
   <g className="guide-graph-ticks" aria-hidden="true">{grid.filter(n=>n!==0).map(n=><g key={n}><line x1={x(n)} y1="141" x2={x(n)} y2="147"/><text x={x(n)} y="162" textAnchor="middle">{displayNumber(n)}</text><line x1="141" y1={y(n)} x2="147" y2={y(n)}/><text x="132" y={y(n)+4} textAnchor="end">{displayNumber(n)}</text></g>)}<text x="132" y="159">O</text><text x="279" y="164">x</text><text x="155" y="18">y</text></g>
  </svg>
  <figcaption>Mỗi ô: 1 đơn vị. Khung vẽ từ −4 đến 4 trên mỗi trục. Các giá trị trong bảng có thể nằm ngoài khung.</figcaption>
 </figure>;
}

type LabState=GraphLine&{pinned:GraphLine|null};
const start=():LabState=>({a:1,b:0,pinned:null});
export default function GuideGraphGame(){
 const id=useId(),[state,setState]=useState(start),live=useRef(state),generation=useRef(0),revision=generation.current;
 const firstSelect=useRef<HTMLSelectElement>(null),pinButton=useRef<HTMLButtonElement>(null);
 live.current=state;
 const info=graphInfo(state),comparison=state.pinned?compareGraphs(state,state.pinned):null;
 function update(next:LabState){live.current=next;setState(next);}
 function choose(field:'a'|'b',raw:string){if(revision!==generation.current)return;const value=readGraphCoefficient(raw);if(value!==null)update({...live.current,[field]:value});}
 function pin(){if(revision===generation.current)update({...live.current,pinned:{a:live.current.a,b:live.current.b}});}
 function unpin(){if(revision!==generation.current)return;update({...live.current,pinned:null});pinButton.current?.focus();}
 function reset(){if(revision!==generation.current)return;generation.current++;update(start());firstSelect.current?.focus();}
 return <div className="guide-graph-game">
  <p>Chọn a và b trong y = ax + b, quan sát đồ thị và bảng giá trị thay đổi cùng nhau. Với a = 0, em đang xem hàm hằng.</p>
  <div className="guide-graph-controls">{(['a','b'] as const).map(field=><label key={field} htmlFor={id+'-'+field}>Hệ số {field}<select id={id+'-'+field} ref={field==='a'?firstSelect:undefined} value={state[field]} onChange={event=>choose(field,event.target.value)}>{GRAPH_COEFFICIENTS.map(value=><option key={value} value={value}>{displayNumber(value)}</option>)}</select></label>)}</div>
  <div className="guide-graph-actions"><button ref={pinButton} type="button" onClick={pin}>{state.pinned?'Cập nhật đồ thị ghim':'Ghim để so sánh'}</button>{state.pinned&&<button type="button" className="guide-graph-secondary" onClick={unpin}>Bỏ ghim</button>}<button type="button" className="guide-graph-secondary" onClick={reset}>Đặt lại a = 1, b = 0</button></div>
  <p role="status" aria-live="polite" className="guide-graph-summary">Hiện tại: {info.equation}. {comparison?comparison.text:'Chưa ghim đồ thị so sánh.'}</p>
  <LineGraph line={state} pinned={state.pinned} id={id}/>
  <ul className="guide-graph-legend" aria-label="Chú giải đồ thị"><li><span className="guide-graph-swatch" aria-hidden="true"/>Nét liền: {info.equation}</li>{state.pinned&&<li><span className="guide-graph-swatch guide-graph-swatch-pinned" aria-hidden="true"/>Nét đứt đã ghim: {graphEquation(state.pinned)}</li>}</ul>
  <table className="guide-graph-table"><caption>Bảng giá trị của đồ thị hiện tại {info.equation}</caption><thead><tr><th scope="col">x</th>{info.values.map(point=><th key={point.x} scope="col">{point.x}</th>)}</tr></thead><tbody><tr><th scope="row">y</th>{info.values.map(point=><td key={point.x}>{point.y}</td>)}</tr></tbody></table>
  <div className="guide-graph-reading"><h3>Đọc từ hệ số đến đồ thị</h3><p>{info.behaviour}</p><p>{info.ox}</p><p>{info.oy}</p></div>
  <details className="guide-graph-prompts"><summary>Thử hai cách quan sát</summary><ol><li>Giữ a = 1, chọn b = 0 rồi ghim. Đổi riêng b thành 2. Hai đường có cùng độ dốc không? Đọc nhận xét để kiểm tra.</li><li>Giữ b = 0, chọn a = 1 rồi ghim. Đổi riêng a thành −1. Quan sát chiều tăng giảm và giao điểm. Thử thêm a = 0 để so sánh với hàm hằng.</li></ol></details>
  <p className="guide-graph-note">MTM sưu tầm và biên soạn. Phòng khám phá ôn kiến thức THCS, không tính điểm thi. Lựa chọn và đồ thị ghim chỉ ở lần mở này, không lưu kết quả.</p>
 </div>;
}

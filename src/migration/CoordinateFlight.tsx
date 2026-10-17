import {useEffect,useId,useRef,useState} from 'react';
import {GRAPH_COEFFICIENTS,graphEquation,readGraphCoefficient,type GraphLine} from './guide-graph-game';
import {advanceFlight,evaluateFlight,flightPoint,FLIGHT_MISSIONS,sampleFlight} from './coordinate-flight';
import './coordinate-flight.css';

type FlightState={run:number;index:number;line:GraphLine;phase:'ready'|'flying'|'paused'|'feedback'|'done';progress:number;results:{line:GraphLine;hit:boolean;index:number}[]};
const initial=(run=0):FlightState=>({run,index:0,line:{a:1,b:0},phase:'ready',progress:0,results:[]});
export default function CoordinateFlight(){
 const id=useId(),[state,setState]=useState(initial),live=useRef(state),mounted=useRef(true),[reduced,setReduced]=useState(()=>typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches),[simple,setSimple]=useState(false);
 const title=useRef<HTMLHeadingElement>(null),feedback=useRef<HTMLDivElement>(null),first=useRef<HTMLSelectElement>(null),run=state.run;
 const mission=FLIGHT_MISSIONS[state.index],outcome=evaluateFlight(state.line,mission),point=flightPoint(state.line,mission.x,state.progress),still=reduced||simple;
 function update(next:FlightState){if(mounted.current){live.current=next;setState(next);}}
 function change(field:'a'|'b',raw:string){const old=live.current,value=readGraphCoefficient(raw);if(old.run===run&&old.phase==='ready'&&value!==null)update({...old,line:{...old.line,[field]:value}});}
 function finish(){const old=live.current;if(old.run!==run||!['flying','paused'].includes(old.phase))return;const result=evaluateFlight(old.line,FLIGHT_MISSIONS[old.index]);update({...old,progress:1,phase:'feedback',results:[...old.results,{line:{...old.line},hit:result.hit,index:old.index}]});}
 function launch(){const old=live.current;if(old.run!==run||old.phase!=='ready')return;update({...old,progress:0,phase:'flying'});}
 function pause(){const old=live.current;if(old.run!==run||old.phase!==state.phase)return;if(old.phase==='flying')update({...old,phase:'paused'});else if(old.phase==='paused')update({...old,phase:'flying'});}
 function reset(){if(live.current.run!==run)return;update(initial(run+1));title.current?.focus();}
 function retry(){const old=live.current;if(old.run!==run||old.phase!=='feedback')return;update({...old,run:run+1,phase:'ready',progress:0,results:old.results.filter(result=>result.index!==old.index)});}
 function next(){const old=live.current;if(old.run!==run||old.phase!=='feedback')return;update(old.index+1===FLIGHT_MISSIONS.length?{...old,run:run+1,phase:'done'}:{...old,run:run+1,index:old.index+1,line:{a:1,b:0},phase:'ready',progress:0});}
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 useEffect(()=>{const query=typeof matchMedia==='function'?matchMedia('(prefers-reduced-motion: reduce)'):null;const changed=()=>{setReduced(query?.matches??false);const old=live.current;if(old.phase==='flying')update({...old,phase:'paused'});};query?.addEventListener('change',changed);return()=>query?.removeEventListener('change',changed);},[]);
 useEffect(()=>{const hide=()=>{const old=live.current;if(document.hidden&&old.phase==='flying')update({...old,phase:'paused'});};document.addEventListener('visibilitychange',hide);return()=>document.removeEventListener('visibilitychange',hide);},[]);
 useEffect(()=>{if(state.phase==='feedback')feedback.current?.focus();else if(state.phase==='ready')first.current?.focus();else if(state.phase==='done')title.current?.focus();},[state.phase,state.index]);
 useEffect(()=>{
  if(state.phase!=='flying'||still)return;
  let raf=0,last:number|null=null,active=true;
  const tick=(now:number)=>{if(!active||!mounted.current)return;const old=live.current;if(old.phase!=='flying'||old.run!==run)return;const progress=last===null?old.progress:advanceFlight(old.progress,now-last);last=now;
   if(progress>=1){finish();return;}update({...old,progress});raf=requestAnimationFrame(tick);
  };raf=requestAnimationFrame(tick);return()=>{active=false;cancelAnimationFrame(raf);};
 },[state.phase,state.run,still]);
 const px=(n:number)=>180+n*36,py=(n:number)=>180-n*36,grid=[-4,-3,-2,-1,0,1,2,3,4];
 return <section className="coordinate-flight" aria-labelledby={id+'-title'} data-version="2">
  <h3 id={id+'-title'} tabIndex={-1} ref={title}>Điều khiển tàu tọa độ</h3>
  <p>Chọn a, b để vẽ tuyến y = ax + b, rồi phóng tàu qua đèn tọa độ. Mỗi lượt 3 màn, không giới hạn thời gian suy nghĩ.</p>
  <label className="coordinate-flight-setting"><input type="checkbox" checked={simple} onChange={event=>{setSimple(event.target.checked);const old=live.current;if(old.phase==='flying')update({...old,phase:'paused'});}}/>Chơi từng bước, giảm chuyển động</label>
  {state.phase==='done'?<div role="status"><p>Đã hoàn thành 3 màn. Tuyến đúng: {state.results.filter(result=>result.hit).length}/3.</p><ol>{state.results.map(result=><li key={result.index}>{FLIGHT_MISSIONS[result.index].title}: {result.hit?'Đã tới đèn':'Cần thử lại'}. Tuyến đã phóng: {graphEquation(result.line)}. {evaluateFlight(result.line,FLIGHT_MISSIONS[result.index]).explanation}</li>)}</ol><p>Mẹo: b là tung độ tại x = 0; dấu của a cho biết tàu lên cao hay hạ thấp khi x tăng.</p><button type="button" onClick={reset}>Chơi lại 3 màn tọa độ</button></div>:<>
   <p className="coordinate-flight-mission"><strong>Màn {state.index+1}/3: {mission.title}</strong></p>
   <div className="guide-graph-controls">{(['a','b'] as const).map(field=><label key={field} htmlFor={id+'-'+field}>Hệ số {field}<select id={id+'-'+field} ref={field==='a'?first:undefined} value={state.line[field]} disabled={state.phase!=='ready'} onChange={event=>change(field,event.target.value)}>{GRAPH_COEFFICIENTS.map(value=><option key={value} value={value}>{value}</option>)}</select></label>)}</div>
   <p>Tuyến đang chọn: <strong>{graphEquation(state.line)}</strong>. Mỗi ô 1 đơn vị. Tàu dừng tại biên nếu tuyến ra khỏi khung trước khi đến hoành độ của đèn.</p>
   <svg className="coordinate-flight-scene" viewBox="0 0 360 360" role="img" aria-labelledby={id+'-scene-title '+id+'-scene-desc'}>
    <title id={id+'-scene-title'}>Tàu trên tuyến {graphEquation(state.line)}</title><desc id={id+'-scene-desc'}>Khung từ −4 đến 4 trên hai trục, cùng đơn vị. Đèn tại ({mission.x}; {mission.y}). Tàu đi trên đường thẳng đã chọn; chỉ sau chuyến bay mới đối chiếu kết quả.</desc>
    <defs><clipPath id={id+'-clip'}><rect x="36" y="36" width="288" height="288"/></clipPath></defs>
    <g className="coordinate-flight-grid" aria-hidden="true">{grid.map(n=><g key={n}><line x1={px(n)} x2={px(n)} y1="36" y2="324"/><line x1="36" x2="324" y1={py(n)} y2={py(n)}/>{n!==0&&<><text x={px(n)} y="198" textAnchor="middle">{n}</text><text x="165" y={py(n)+4} textAnchor="end">{n}</text></>}</g>)}</g>
    <g className="coordinate-flight-axes" aria-hidden="true"><line x1="26" x2="335" y1="180" y2="180"/><line x1="180" x2="180" y1="335" y2="26"/><text x="337" y="173">x</text><text x="190" y="24">y</text><text x="165" y="198">O</text></g>
    <line className="coordinate-flight-route" x1={px(-4)} x2={px(4)} y1={py(-4*state.line.a+state.line.b)} y2={py(4*state.line.a+state.line.b)} clipPath={'url(#'+id+'-clip)'} aria-hidden="true"/>
    <g transform={`translate(${px(mission.x)} ${py(mission.y)})`} aria-hidden="true"><circle className={'coordinate-flight-beacon'+(state.phase==='feedback'&&outcome.hit?' is-hit':'')} r="13"/><path d="M0,-9 L4,-2 L-4,-2 L0,9" fill="none" stroke="#213269" strokeWidth="2"/></g>
    <g className={'coordinate-flight-ship'+(state.phase==='feedback'&&!outcome.hit?' is-missed':'')} transform={`translate(${px(point.x)} ${py(point.y)})`} aria-hidden="true"><path d="M-16,0 L-6,-9 L13,-5 L18,0 L13,5 L-6,9 Z" fill="#213269" stroke="#fff" strokeWidth="2"/><circle cx="3" cy="0" r="4" fill="#FFCF24"/><path d="M-17,-4 L-25,0 L-17,4" fill="#FFCF24"/></g>
   </svg>
   <div className="guide-graph-actions">{state.phase==='ready'&&<button type="button" onClick={launch}>Phóng tàu theo tuyến này</button>}{['flying','paused'].includes(state.phase)&&<><button type="button" onClick={pause}>{state.phase==='paused'?'Tiếp tục chuyến bay':'Tạm dừng chuyến bay'}</button>{still&&<button type="button" onClick={finish}>Đưa tàu tới điểm đối chiếu</button>}</>}</div>
   {state.phase==='paused'&&<p role="status">Đã tạm dừng. Bấm Tiếp tục khi em sẵn sàng.</p>}
   {state.phase==='feedback'&&<div className="coordinate-flight-feedback" ref={feedback} tabIndex={-1}><p role="status"><strong>{outcome.hit?'Tới đèn rồi, tuyến bay chuẩn!':'Lệch tọa độ rồi, mình chỉnh tuyến nhé.'}</strong></p><p>{outcome.explanation}</p><p>Một tuyến đáp ứng yêu cầu: {sampleFlight(mission)}. {mission.rule==='any'?'Có thể có nhiều cặp a, b đúng. Em chỉ cần tuyến thỏa yêu cầu.':mission.rule==='horizontal'?'Hàm hằng có a = 0.':'Hệ số a âm cho đường thẳng đi xuống từ trái qua phải.'}</p><div className="guide-graph-actions"><button type="button" onClick={retry}>Chỉnh tuyến màn này</button><button type="button" onClick={next}>{state.index===2?'Xem tổng kết tọa độ':'Màn tọa độ tiếp theo'}</button></div><p className="guide-graph-note">Tổng kết lấy lần phóng gần nhất của mỗi màn, kể cả sau khi em chỉnh tuyến.</p></div>}
   <p><button type="button" className="guide-graph-secondary" onClick={reset}>Làm lại từ màn 1</button></p>
  </>}
  <p className="guide-graph-note">MTM sưu tầm và biên soạn. Màn riêng ôn đồ thị THCS, không dùng đề BTVN và không tính điểm thi. Chuyến bay chỉ giữ trong lần mở này. Chế độ này không có âm thanh.</p>
 </section>;
}

export function LoadingCards({label}:{label:string}){
 return <div className="mtm-loading-cards" role="status" aria-live="polite" aria-busy="true"><p>{label}</p><div aria-hidden="true">{[0,1,2].map(key=><div className="mtm-skeleton-card" key={key}><span/><span/><span/></div>)}</div></div>;
}

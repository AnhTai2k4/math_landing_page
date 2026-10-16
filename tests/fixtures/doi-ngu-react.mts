const runtime=()=> (globalThis as any).__doiNguRuntime;
export const useState=(initial:unknown)=>runtime().state(initial);
export const useRef=(initial:unknown)=>runtime().ref(initial);
export const useEffect=(fn:unknown,deps:unknown)=>runtime().effect(fn,deps);
export const useLayoutEffect=useEffect;
export const useMemo=(fn:()=>unknown,deps:unknown)=>runtime().memo(fn,deps);
export const useCallback=(fn:unknown,deps:unknown)=>runtime().memo(()=>fn,deps);
export const useContext=(context:any)=>context.value;
export const createContext=(value:unknown)=>({value,Provider:'provider'});
export const lazy=(load:unknown)=>({lazy:load});
export const Suspense='suspense';
export const jsx=(type:unknown,props:unknown)=>({type,props});
export const jsxs=jsx;
export const createElement=jsx;
export const Fragment='fragment';
export const createPortal=(children:unknown)=>children;
export const useId=()=> 'doi-ngu-test-id';
// Ranh lỗi chỉ cần lớp nền khi bundle; các ca này không dựng cây class trong DOM.
export class Component<P=unknown,S=unknown>{props:P;state:S;constructor(props:P){this.props=props;this.state={} as S;}}
export default {createElement:jsx};

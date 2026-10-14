// Runtime hook tổng hợp: chạy hook thật với effect/dependency và đồng hồ được kiểm soát.
// Không giả nhận đây là render trình duyệt; không dùng dữ liệu học sinh.
const runtime = () => (globalThis as any).__mtmHookRuntime;
export const useState = (initial: unknown) => runtime().state(initial);
export const useRef = (initial: unknown) => runtime().ref(initial);
export const useEffect = (fn: unknown, deps: unknown) => runtime().effect(fn,deps);
export const useCallback = (fn: unknown, deps: unknown) => runtime().memo(fn,deps);
export const useId = () => 'test-id';
export const createElement = (type: unknown, props: unknown) => ({type,props});
export const jsx = createElement;
export const jsxs = createElement;
export const Fragment = 'fragment';

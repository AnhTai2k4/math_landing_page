import {createElement,useEffect,useRef,useState} from 'react';
import {BEFORE_NAVIGATION_EVENT,navigate} from '../../migration/navigation';
import ExamConfirm from './ExamConfirm';

/** Capture popstate before the shared router's bubble listener can unmount us.
 * Query/hash changes on the same attempt are safe and never reset its RAM. */
export function useUnsavedGuard(hasUnsaved: () => boolean, message = 'Bài đang làm chưa được lưu trên trình duyệt. Rời trang sẽ mất phần chưa lưu. Bạn có muốn rời trang?') {
  const readUnsaved = useRef(hasUnsaved);
  const [pending,setPending]=useState<{href:string;traversal:boolean}|null>(null);
  const approved=useRef<string|null>(null);
  readUnsaved.current = hasUnsaved;
  useEffect(() => {
    let acceptedUrl = location.href;
    const leavingAttempt = (href: string) => {
      const next = new URL(href, location.href), previous = new URL(acceptedUrl);
      return next.origin !== previous.origin || next.pathname.replace(/\/$/, '') !== previous.pathname.replace(/\/$/, '');
    };
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!readUnsaved.current()) return;
      event.preventDefault();
      event.returnValue = '';
    };
    const beforeNavigation = (event: Event) => {
      const href = (event as CustomEvent<{href?: string}>).detail?.href;
      if(href&&approved.current===href){approved.current=null;return;}
      if(href&&leavingAttempt(href)&&readUnsaved.current()){
        event.preventDefault();setPending({href,traversal:false});
      }
    };
    const popstate = (event: PopStateEvent) => {
      if(approved.current===location.href){approved.current=null;acceptedUrl=location.href;return;}
      if(document.querySelector('[role="alertdialog"]')){
        event.stopImmediatePropagation();history.pushState(null,'',acceptedUrl);window.dispatchEvent(new Event('mtm:cancel-confirm'));return;
      }
      if (leavingAttempt(location.href) && readUnsaved.current()) {
        // Keep the mounted attempt and restore its complete filter/hash URL.
        event.stopImmediatePropagation();
        const requested=location.href;
        history.pushState(null, '', acceptedUrl);
        setPending({href:requested,traversal:true});
        return;
      }
      acceptedUrl = location.href;
    };
    const acceptedNavigation = () => { acceptedUrl = location.href; };
    window.addEventListener('beforeunload', beforeUnload);
    window.addEventListener(BEFORE_NAVIGATION_EVENT, beforeNavigation);
    window.addEventListener('popstate', popstate, true);
    window.addEventListener('mtm:migration:navigate', acceptedNavigation);
    window.addEventListener('hashchange', acceptedNavigation);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      window.removeEventListener(BEFORE_NAVIGATION_EVENT, beforeNavigation);
      window.removeEventListener('popstate', popstate, true);
      window.removeEventListener('mtm:migration:navigate', acceptedNavigation);
      window.removeEventListener('hashchange', acceptedNavigation);
    };
  }, []);
  return pending?createElement(ExamConfirm,{title:'Có rời trang đang làm?',message,confirmLabel:'Rời trang',onCancel:()=>setPending(null),onConfirm:()=>{approved.current=pending.href;setPending(null);if(pending.traversal)history.back();else navigate(pending.href);}}):null;
}

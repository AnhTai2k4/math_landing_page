import {useEffect, useRef} from 'react';
import {BEFORE_NAVIGATION_EVENT} from '../../migration/navigation';

/** Capture popstate before the shared router's bubble listener can unmount us.
 * Query/hash changes on the same attempt are safe and never reset its RAM. */
export function useUnsavedGuard(hasUnsaved: () => boolean) {
  const readUnsaved = useRef(hasUnsaved);
  readUnsaved.current = hasUnsaved;
  useEffect(() => {
    let acceptedUrl = location.href;
    const leavingAttempt = (href: string) => {
      const next = new URL(href, location.href), previous = new URL(acceptedUrl);
      return next.origin !== previous.origin || next.pathname.replace(/\/$/, '') !== previous.pathname.replace(/\/$/, '');
    };
    const confirmLeave = () => window.confirm('Bài đang làm chưa được lưu trên trình duyệt. Rời trang sẽ mất phần chưa lưu. Bạn có muốn rời trang?');
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!readUnsaved.current()) return;
      event.preventDefault();
      event.returnValue = '';
    };
    const beforeNavigation = (event: Event) => {
      const href = (event as CustomEvent<{href?: string}>).detail?.href;
      if (href && leavingAttempt(href) && readUnsaved.current() && !confirmLeave()) event.preventDefault();
    };
    const popstate = (event: PopStateEvent) => {
      if (leavingAttempt(location.href) && readUnsaved.current() && !confirmLeave()) {
        // Keep the mounted attempt and restore its complete filter/hash URL.
        event.stopImmediatePropagation();
        history.pushState(null, '', acceptedUrl);
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
}

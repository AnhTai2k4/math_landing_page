import { useEffect, useRef, useState, type ComponentType } from 'react';
import { MtmLifeTabs } from './components/MtmLifeTabs';
import { MtmTimetable } from './components/MtmTimetable';
import { MtmNewsSection } from './components/MtmNewsSection';
import { Header } from "./components/Header";
import { HeroSection } from "./components/HeroSection";
import { PromotionsSection } from "./components/PromotionsSection";
import { CoursesSection } from "./components/CoursesSection";
import { FAQSection } from "./components/FAQSection";
import { BenefitsSection } from "./components/BenefitsSection";


import { TeachersSection } from "./components/TeachersSection";
import { RegisterSection } from "./components/RegisterSection";
import { FloatingContact } from "./components/FloatingContact";
import { Footer } from "./components/Footer";
import { Toaster } from "./components/ui/sonner";
import { SEOProvider } from "./components/SEOProvider";
import { SEO } from "./components/SEO";
import { StructuredData } from "./components/StructuredData";

function DeferredReferenceLibrary() {
  const container = useRef<HTMLDivElement>(null);
  const [wanted, setWanted] = useState(false);
  const [Library, setLibrary] = useState<ComponentType | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const followAnchor = () => { if (window.location.hash === '#tai-lieu-tham-khao') setWanted(true); };
    followAnchor();
    window.addEventListener('hashchange', followAnchor);
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setWanted(true); observer?.disconnect(); }
    }, { rootMargin: '600px 0px' });
    if (container.current) observer?.observe(container.current);
    return () => { observer?.disconnect(); window.removeEventListener('hashchange', followAnchor); };
  }, []);
  useEffect(() => {
    if (!wanted) return;
    let cancelled = false;
    setError(false);
    void import('./components/MtmReferenceLibrary').then(module => {
      if (!cancelled) setLibrary(() => module.default);
    }).catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [wanted, retry]);
  return <div ref={container} id={Library ? undefined : 'tai-lieu-tham-khao'}>
    {Library ? <Library /> : <section aria-label="Thư viện tham khảo" style={{maxWidth:1200,margin:'48px auto',padding:24,minHeight:220}}>
      <h2>Thư viện tài liệu tham khảo</h2>
      <p>{error ? 'Chưa tải được danh mục. Em có thể thử lại khi có kết nối.' : wanted ? 'Đang tải danh mục bài nguồn…' : '1.200 bài nguồn, có bộ lọc lớp và dạng tài liệu.'}</p>
      <button type="button" disabled={wanted && !error} onClick={() => { setWanted(true); setRetry(n => n + 1); }} style={{minHeight:48,padding:'12px 20px',background:'#213269',color:'#fff',borderRadius:10}}>{error ? 'Thử tải lại thư viện' : 'Mở thư viện tham khảo'}</button>
      <p role="status" aria-live="polite">{error ? 'Tải danh mục chưa thành công.' : wanted ? 'Đang tải thư viện.' : ''}</p>
    </section>}
  </div>;
}
export default function App() {
  return (
    <SEOProvider>
      <SEO />
      <StructuredData />
      <div className="min-h-screen">
        <a className="mtm-skip" href="#main-content">Đến nội dung chính</a>
        <Header />
        <main id="main-content" role="main">
          <HeroSection />
          <MtmNewsSection />
          <CoursesSection />
          <MtmTimetable />
          <TeachersSection />
          <BenefitsSection />
          

          <PromotionsSection />   
          <RegisterSection />
          <FAQSection />
          <DeferredReferenceLibrary />
          <div className="mtm-shell"><MtmLifeTabs /></div>
        </main>
        <Footer />
        <FloatingContact />
        <Toaster position="top-center" />
      </div>
    </SEOProvider>
  );
}


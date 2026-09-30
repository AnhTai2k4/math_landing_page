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
          <div className="mtm-shell"><MtmLifeTabs /></div>
        </main>
        <Footer />
        <FloatingContact />
        <Toaster position="top-center" />
      </div>
    </SEOProvider>
  );
}

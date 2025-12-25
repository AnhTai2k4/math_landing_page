import { Header } from "./components/Header";
import { HeroSection } from "./components/HeroSection";
import { PromotionsSection } from "./components/PromotionsSection";
import { CoursesSection } from "./components/CoursesSection";
import { BenefitsSection } from "./components/BenefitsSection";
import { ClassSection } from "./components/ClassSection";
import { FeedbackSection } from "./components/FeedbackSection";
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
        <Header />
        <main id="main-content" role="main">
          <HeroSection />
          <CoursesSection />
          <TeachersSection />
          <BenefitsSection />
          
          <ClassSection />
          <FeedbackSection />
          <PromotionsSection />   
          <RegisterSection />
        </main>
        <Footer />
        <FloatingContact />
        <Toaster position="top-center" />
      </div>
    </SEOProvider>
  );
}
import { Button } from "./ui/button";
import { GraduationCap, TrendingUp, Award } from "lucide-react";
import avatarImg from '../assets/avatar.jpg';
import heroImage from "figma:asset/bd36b26f465734ac6ed738bfb7b629af3f695065.png";
import backgroundImage from "figma:asset/3a0a47e483030d752b74a16044b2bd5c5183d3ba.png";
import React from "react";

export function HeroSection() {
  const scrollToRegister = () => {
    const element = document.getElementById("register");
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section id="home" className="pt-32 md:pt-40 pb-20 relative overflow-hidden min-h-screen flex items-center" aria-labelledby="hero-heading">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0 z-0">
        <img 
          src={backgroundImage} 
          alt="Lớp học Minh Thành Math" 
          className="w-full h-full object-cover blur-[3px] opacity-25"
        />
        <div className="absolute inset-0 bg-gradient-to-br "></div>
      </div>

      {/* Decorative Elements */}
      <div className="absolute inset-0 opacity-10 z-[1]">
        <div className="absolute top-10 left-10 w-72 h-72 bg-yellow-400 rounded-full blur-3xl"></div>
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-yellow-300 rounded-full blur-3xl"></div>
      </div>

      <div className="container mx-auto px-4 relative z-10 w-full">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center max-w-7xl mx-auto">
          {/* Left Content */}
          <article className="space-y-5 text-white text-center lg:text-left">
            <div className="flex justify-center lg:justify-start">
              <span className="inline-block bg-yellow-400 text-blue-900 px-4 py-1.5 rounded-full font-bold shadow-lg text-sm" role="text">
                🎓 Trung Tâm Toán Uy Tín Hàng Đầu
              </span>
            </div>
            
            <h1 id="hero-heading" className="text-3xl md:text-4xl lg:text-5xl font-bold text-blue-900 leading-tight">
              Chinh Phục Môn Toán Cùng Thầy Giáo 8+ Năm Kinh Nghiệm Giảng Dạy <span className="text-yellow-500">Minh Thành Math</span>
            </h1>
            
            <p className="text-gray-700 text-base md:text-lg leading-relaxed">
              Lớp học sĩ số nhỏ - Xây dựng tư duy toán - Học bản chất - Bứt phá kết quả học trong thời gian ngắn
            </p>

            <nav className="flex flex-wrap gap-3 justify-center lg:justify-start" aria-label="Call to action">
              <Button size="lg" onClick={scrollToRegister} className="gap-2 bg-yellow-400 hover:bg-yellow-500 text-blue-900 font-bold shadow-lg text-base px-6 py-5" aria-label="Đăng ký học thử miễn phí">
                <GraduationCap size={20} aria-hidden="true" />
                <span className="hidden sm:inline">Đăng Ký Học Thử Miễn Phí</span>
                <span className="sm:hidden">Đăng Ký Ngay</span>
              </Button>
              <Button size="lg" variant="outline" onClick={() => {
                const element = document.getElementById("courses");
                if (element) element.scrollIntoView({ behavior: "smooth" });
              }} className="border-2 border-yellow-400 text-yellow-600 hover:bg-yellow-400 hover:text-blue-900 font-bold text-base px-6 py-5" aria-label="Xem thông tin khóa học">
                Xem Khóa Học
              </Button>
            </nav>

            {/* Stats */}
            <aside className="grid grid-cols-3 gap-4 pt-6 border-t-2 border-gray-300" aria-label="Thống kê trung tâm">
              <div className="text-center">
                <strong className="text-2xl md:text-3xl font-bold text-yellow-500 block">2000+</strong>
                <p className="text-gray-700 text-xs md:text-sm mt-1">Học Sinh</p>
              </div>
              <div className="text-center">
                <strong className="text-2xl md:text-3xl font-bold text-yellow-500 block">95%</strong>
                <p className="text-gray-700 text-xs md:text-sm mt-1">Đạt Điểm Cao</p>
              </div>
              <div className="text-center">
                <strong className="text-2xl md:text-3xl font-bold text-yellow-500 block">8+</strong>
                <p className="text-gray-700 text-xs md:text-sm mt-1">Năm Kinh Nghiệm</p>
              </div>
            </aside>
          </article>

          {/* Right Content - Teacher Image */}
          <aside className="mt-6 lg:mt-0 flex justify-center" aria-label="Giáo viên Minh Thành">
            <div className="relative inline-block">
              <div className="rounded-3xl overflow-hidden shadow-2xl border-4 border-yellow-400 max-w-sm md:max-w-md lg:max-w-lg">
                <img 
                  src={avatarImg}
                  alt="Thầy giáo Tô Minh Thành - Tự tin giỏi toán, hiểu sâu nhớ lâu, đỗ trường top đầu" 
                  className="w-full h-auto object-cover "
                />
              </div>

              {/* Floating elements */}
              <div className="absolute -top-3 -right-3 md:-top-4 md:-right-4 bg-yellow-400 text-blue-900 px-4 py-2 md:px-5 md:py-2.5 rounded-xl md:rounded-2xl shadow-xl transform rotate-12 font-bold text-sm whitespace-nowrap" aria-label="Top 1">
                ⭐ Top 1
              </div>
              <div className="absolute -bottom-3 -left-3 md:-bottom-4 md:-left-4 bg-white text-blue-900 px-4 py-2 md:px-5 md:py-2.5 rounded-xl md:rounded-2xl shadow-xl font-bold text-sm whitespace-nowrap" aria-label="Uy tín">
                ✓ Uy Tín 100%
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
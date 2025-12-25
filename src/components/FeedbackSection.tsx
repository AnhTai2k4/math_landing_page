import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Quote, Sparkles } from "lucide-react";
import { ScrollReveal } from "./ScrollReveal";

import feedback1 from "figma:asset/9d658ea6d8327bc9490e1829f8861bb4221904ef.png";
import feedback3 from "figma:asset/e65f7186f6bc7a7850301b3d3ae8015d83670579.png";

export function FeedbackSection() {
  const [currentSlide, setCurrentSlide] = useState(0);

  const testimonials = [
    
    {
      id: 1,
      image: feedback1,
      name: "Phạm Quang Anh",
      school: "THPT Việt Đức",
      title: "Anh Thành luôn sẵn sàng giúp đỡ mỗi khi học sinh cần",
      description: "Anh Thành luôn sẵn sàng giúp đỡ mỗi khi học sinh cần, tạo cảm giác thoải mái trong lúc học tập. Anh luôn tạo ra một môi trường học lành mạnh, thoải mái. GPA Toán lớp 12: 10.0. Đỗ khoa Phân tích Kinh doanh (NEU)"
    },
    {
      id: 2,
      image: "/GiaHan.jpg",
      name: "Gia Hân",
      school: "THPT Gia Hân",
      title: "Bí quyết ôn thi DGNL đạt điểm cao của học sinh Gia Hân",
      description: "Bí quyết ôn thi ĐGNL đạt điểm cao luôn là điều mà nhiều học sinh và phụ huynh quan tâm mỗi mùa thi. Tại Trung tâm Minh Thành Math, học sinh Gia Hân đã xuất sắc giành 105+ điểm thi HSA, vào được ngôi trường Ngoại Thương mơ ước [...]"
    },
    {
      id: 3,
      image: feedback3,
      name: "Nguyễn Việt Bảo Linh",
      school: "THPT HN - Amsterdam",
      title: " Mình luôn cảm thấy biết ơn và tự hào",
      description: "Mình luôn cảm thấy biết ơn và tự hào khi anh đã biến mình từ một đứa không dám đối diện với nỗi sợ góc toán trở thành một Bảo Linh sẵn sàng đi học 5 buổi toán/tuần trong những ngày chạy nước rút. GPA lớp 12: 9.9. Đỗ FTU, AJC, HLU, DAV. HSGQG môn Văn 2024-2025"
    },
    {
      id: 4,
      image: "/fb.jpg",
      // name: "Nguyễn Việt Bảo Linh",
      // school: "THPT HN - Amsterdam",
      title: " Minh Thành MATH - Nơi lớp học là nhà",
      description: "Em xin cảm ơn anh vì sự tận tâm và gần gũi trong từng buổi học. Nhờ anh, lớp học luôn ấm áp và thân thiện, khiến em cảm thấy như đang học ở chính ngôi nhà của mình. Em rất trân trọng những gì anh đã dành cho chúng em.",
    }
  ];

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % testimonials.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  };

  useEffect(() => {
    const interval = setInterval(() => {
      nextSlide();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const getPrevIndex = (index: number) => (index - 1 + testimonials.length) % testimonials.length;
  const getNextIndex = (index: number) => (index + 1) % testimonials.length;

  return (
    <section id="feedback" className="py-14 bg-gradient-to-br from-yellow-50 to-white relative overflow-hidden" aria-labelledby="feedback-heading">
      {/* Decorative Stars */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <Sparkles className="absolute top-10 right-20 text-yellow-300 opacity-40" size={40} />
        <Sparkles className="absolute top-32 right-40 text-yellow-400 opacity-30" size={24} />
        <Sparkles className="absolute top-20 left-32 text-orange-300 opacity-35" size={32} />
        <Sparkles className="absolute bottom-40 right-60 text-yellow-300 opacity-25" size={28} />
        <Sparkles className="absolute top-1/2 left-20 text-orange-200 opacity-30" size={36} />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <ScrollReveal>
          <header className="text-center mb-10">
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-5 py-1.5 rounded-full mb-3 shadow-lg">
              <Quote size={18} />
              <span className="font-bold text-2xl">PHẢN HỒI</span>
            </div>
            <h2 id="feedback-heading" className="text-3xl md:text-4xl font-bold text-blue-900 mb-3">
              HALL OF FAME - <span className="text-yellow-600">Câu Chuyện Thành Công</span>
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Những câu chuyện truyền cảm hứng từ các học sinh xuất sắc của Minh Thành Math
            </p>
          </header>
        </ScrollReveal>

        <ScrollReveal delay={0.2}>
          <div className="max-w-4xl mx-auto relative">
            {/* Navigation Arrows */}
            <button
              onClick={prevSlide}
              className="absolute left-0 top-32 -translate-x-4 md:-translate-x-16 z-10 bg-white hover:bg-gray-100 text-gray-500 rounded-full p-3 shadow-lg transition-all duration-300"
              aria-label="Previous testimonial"
            >
              <ChevronLeft size={24} />
            </button>
            
            <button
              onClick={nextSlide}
              className="absolute right-0 top-32 translate-x-4 md:translate-x-16 z-10 bg-white hover:bg-gray-100 text-gray-500 rounded-full p-3 shadow-lg transition-all duration-300"
              aria-label="Next testimonial"
            >
              <ChevronRight size={24} />
            </button>

            {/* Overlapping Circular Images */}
            <div className="flex justify-center items-center mb-8 relative h-64">
              {/* Left Image (Previous) */}
              <div className="absolute left-1/2 -translate-x-64 z-10">
                <div className="w-48 h-48 rounded-full overflow-hidden border-4 border-white shadow-xl opacity-60">
                  <img
                    src={testimonials[getPrevIndex(currentSlide)].image}
                    alt={testimonials[getPrevIndex(currentSlide)].name}
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>

              {/* Center Image (Current) */}
              <div className="relative z-20">
                <div className="w-72 h-72 rounded-full overflow-hidden border-8 border-white shadow-2xl">
                  <img
                    src={testimonials[currentSlide].image}
                    alt={testimonials[currentSlide].name}
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>

              {/* Right Image (Next) */}
              <div className="absolute right-1/2 translate-x-64 z-10">
                <div className="w-48 h-48 rounded-full overflow-hidden border-4 border-white shadow-xl opacity-60">
                  <img
                    src={testimonials[getNextIndex(currentSlide)].image}
                    alt={testimonials[getNextIndex(currentSlide)].name}
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            </div>

            {/* Text Content Box */}
            <div className="max-w-2xl mx-auto bg-white rounded-2xl border-4 border-yellow-400 p-8 shadow-lg mb-6">
              <h3 className="text-blue-900 font-bold mb-3 text-center">
                {testimonials[currentSlide].title}
              </h3>
              <p className="text-gray-600 text-center leading-relaxed">
                {testimonials[currentSlide].description}
              </p>
            </div>

            {/* Dots Indicator */}
            <div className="flex justify-center gap-2 mb-6">
              {testimonials.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentSlide(index)}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    currentSlide === index 
                      ? "bg-orange-500 w-8" 
                      : "bg-gray-300 w-2 hover:bg-gray-400"
                  }`}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
            </div>

          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
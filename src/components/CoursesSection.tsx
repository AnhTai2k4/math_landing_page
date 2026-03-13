import { Button } from "./ui/button";
import { ScrollReveal } from "./ScrollReveal";
import { BookOpen, Calculator, TrendingUp, Target, CheckCircle2 } from "lucide-react";
import React from "react";
export function CoursesSection() {
  const courses = [
    {
      title: "Lớp 10",
      subtitle: "Nền tảng vững chắc cho toán học THPT",
      icon: BookOpen,
      iconBg: "bg-blue-500",
      borderColor: "border-blue-300",
      badgeBg: "bg-blue-50",
      badgeText: "text-blue-700",
      topics: [
        "Hàm số, phương trình, bất phương trình, hệ thức lượng trong tam giác,...",
        "Vectơ, tích vô hướng, phương trình đường thẳng, đường tròn,...",
        "Lượng giác cơ bản",
        "Phương pháp giải toán tư duy"
      ],
      schedule: "2 buổi/tuần - 2h/buổi"
    },
    {
      title: "Lớp 11",
      subtitle: "Phát triển tư duy và kỹ năng giải toán",
      icon: Calculator,
      iconBg: "bg-orange-500",
      borderColor: "border-orange-300",
      badgeBg: "bg-orange-50",
      badgeText: "text-orange-700",
      topics: [
        "Dãy số, cấp số, giới hạn, hàm số mũ, logarit",
        "Quan hệ song song và vuông góc trong không gian, khoảng cách, thể tích",
        "Lượng giác nâng cao",
        "Đạo hàm và ứng dụng",
        "Các quy tắc tính xác suất"
      ],
      schedule: "2 buổi/tuần - 2h/buổi"
    },
    {
      title: "Lớp 12",
      subtitle: "Luyện thi THPT Quốc Gia đạt điểm cao",
      icon: TrendingUp,
      iconBg: "bg-amber-600",
      borderColor: "border-amber-300",
      badgeBg: "bg-amber-50",
      badgeText: "text-amber-700",
      topics: [
        "Đơn điệu, cực trị, min max của hàm số",
        "Nguyên hàm, tích phân, ứng dụng tích phân",
        "Hình học không gian nâng cao, phương pháp tọa độ trong không gian,...",
        "Luyện đề thi THPT Quốc Gia chuyên sâu"
      ],
      schedule: "3 buổi/tuần - 2h/buổi"
    },
    {
      title: "Lớp ĐGNL",
      subtitle: "Chinh phục kỳ thi đánh giá năng lực",
      icon: Target,
      iconBg: "bg-red-600",
      borderColor: "border-red-300",
      badgeBg: "bg-red-50",
      badgeText: "text-red-700",
      topics: [
        "Toán tư duy logic và phân tích",
        "Toán ứng dụng thực tiễn",
        "Kỹ thuật giải nhanh câu hỏi trắc nghiệm",
        "Luyện đề ĐGNL ĐHQG Hà Nội"
      ],
      schedule: "2 buổi/tuần - 3h/buổi"
    }
  ];

  const scrollToRegister = () => {
    const element = document.getElementById("register");
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section id="courses" className="py-14 bg-gradient-to-br from-gray-50 via-white to-blue-50" aria-labelledby="courses-heading">
      <div className="container mx-auto px-4">
        <ScrollReveal>
          <header className="text-center mb-3">
            <div className="inline-block bg-blue-600 text-white px-4 py-1 rounded-full mb-3 text-2xl font-bold">
              ⭐ KHÓA HỌC
            </div>
            <h2 id="courses-heading" className="text-3xl md:text-4xl font-bold mb-3 text-blue-900">
              Chương Trình Học Toán Điển Hình
            </h2>
            <p className="text-gray-600 max-w-3xl mx-auto">
              Các khóa học được thiết kế bài bản, phù hợp với từng cấp độ, giúp học sinh nâng cao kiến thức và tự tin trong mọi kỳ thi.
            </p>
          </header>
        </ScrollReveal>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
          {courses.map((course, index) => {
            const Icon = course.icon;
            return (
              <ScrollReveal key={index} delay={index * 0.1}>
                <div className={`bg-white rounded-2xl p-6 border-4 ${course.borderColor} shadow-lg flex flex-col h-full hover:shadow-xl transition-shadow`}>
                  {/* Icon */}
                  <div className="flex justify-center mb-4">
                    <div className={`${course.iconBg} w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg`}>
                      <Icon className="text-white" size={32} />
                    </div>
                  </div>

                  {/* Title */}
                  <h3 className="font-bold text-2xl text-center mb-2 text-gray-900">{course.title}</h3>
                  
                  {/* Subtitle */}
                  <p className="text-center text-gray-500 text-sm mb-4">{course.subtitle}</p>

                  {/* Schedule Badge */}
                  <div className={`${course.badgeBg} ${course.badgeText} text-center py-2 rounded-lg mb-4 font-bold text-sm`}>
                    {course.schedule}
                  </div>

                  {/* Topics List */}
                  <div className="mb-4">
                    <p className="font-bold text-gray-900 mb-3">Nội dung học:</p>
                    <div className="space-y-2 flex-grow">
                      {course.topics.map((topic, idx) => (
                        <div key={idx} className="flex gap-2 items-start">
                          <CheckCircle2 className="text-green-500 flex-shrink-0 mt-0.5" size={16} />
                          <p className="text-sm text-gray-700 leading-relaxed">{topic}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Button */}
                  <Button 
                    className="w-full bg-yellow-400 hover:bg-yellow-500 text-blue-900 font-bold shadow-md rounded-lg mt-auto"
                    onClick={scrollToRegister}
                  >
                    Đăng Ký Học Ngay
                  </Button>
                </div>
              </ScrollReveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
import { ScrollReveal } from "./ScrollReveal";
import backgroundImage from "figma:asset/9f15f8306d80b093260628ceb1f8fb76e40aec8d.png";
import React from "react";

export function BenefitsSection() {
  const benefits = [
    {
      number: "01",
      title: "Phương Pháp Hướng Dẫn Tự Học",
      description: "Học sinh học chủ động, hiệu quả, năm chắc, vận dụng tốt kiến thức, tư duy, kỹ năng, tư duy giải quyết vấn đề."
    },
    {
      number: "02",
      title: "Đội Ngũ Giáo Viên Giỏi Và Tâm Huyết",
      description: "100% giáo viên chuyên Toán, tốt nghiệp Đại học Sư phạm, yêu tâu, tâm huyết với nghề, có lối sống tích cực."
    },
    {
      number: "03",
      title: "Phân Lớp Theo Năng Lực Học Sinh",
      description: "Học sinh được đánh giá năng lực đầu vào, phân lớp có nhân hóa. Sĩ số tối đa 5, 10, 15 học sinh/lớp tuỳ theo hình thức học trực tiếp hoặc tương tác online."
    },
    {
      number: "04",
      title: "Tổ Chức Kiểm Tra Và Đánh Giá Định Kỳ",
      description: "Học sinh được nhắn xét, chăm chỉa bài mỗi buổi học cũng như kiểm tra, rà soát định kỳ hằng tháng."
    },
    {
      number: "05",
      title: "Cung Cấp Chương Trình Và Tài Liệu Tiêu Chuẩn",
      description: "Chương trình, tài liệu đáp ứng đầy đủ các tiêu chí của Bộ Giáo dục & Đào tạo và cập nhật các tiêu chuẩn giáo dục của thế giới."
    },
    {
      number: "06",
      title: "Cam Kết Chất Lượng Đầy Vào Học",
      description: "Học sinh được cam kết mục tiêu đầu ra theo từng khóa học như: Sự tiến bộ ý thức, thái độ, điểm thi học kỳ, điểm thi vào lớp 10, điểm thi Đại học."
    }
  ];

  return (
    <section id="benefits" className="py-14 relative overflow-hidden" aria-labelledby="benefits-heading">
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <img 
          src="/bg.jpg" 
          alt="Background" 
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-white/60"></div>
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <ScrollReveal>
          <header className="text-center mb-10">
            <div className="inline-block bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-5 py-1.5 rounded-full mb-3 font-bold shadow-lg text-2xl">
              ⭐ LỢI ÍCH
            </div>
            <h2 id="benefits-heading" className="text-3xl md:text-4xl font-bold text-blue-900 mb-3">
              Lý Do Nên Chọn <span className="text-yellow-600">Minh Thành Math</span>
            </h2>
            <p className="text-gray-700 max-w-2xl mx-auto">
              Chúng tôi cam kết mang đến cho học sinh một môi trường học tập tốt nhất, 
              giúp các em phát triển toàn diện và đạt kết quả cao.
            </p>
          </header>
        </ScrollReveal>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {benefits.map((benefit, index) => (
            <ScrollReveal key={index} delay={index * 0.1}>
              <div className="space-y-2">
                <div className="text-5xl font-bold text-yellow-500 mb-3">
                  {benefit.number}
                </div>
                <h3 className="font-bold text-blue-900 mb-2 text-lg">
                  {benefit.title}
                </h3>
                <p className="text-gray-700 text-sm leading-relaxed">
                  {benefit.description}
                </p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
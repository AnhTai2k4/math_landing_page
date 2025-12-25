import { CheckCircle } from "lucide-react";
import teacherImage from "figma:asset/bd36b26f465734ac6ed738bfb7b629af3f695065.png";
import { ScrollReveal } from "./ScrollReveal";
import React from "react";
export function TeachersSection() {
  return (
    <section id="teachers" className="py-14 bg-white relative overflow-hidden" aria-labelledby="teachers-heading">
      {/* Background decoration */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-20 right-20 w-96 h-96 bg-yellow-400 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 left-20 w-80 h-80 bg-blue-400 rounded-full blur-3xl"></div>
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <ScrollReveal>
          <header className="text-center mb-12">
            <div className="inline-block bg-gradient-to-r from-blue-600 to-blue-800 text-white px-5 py-1.5 rounded-full mb-3 font-bold shadow-lg text-2xl">
            👨🏻‍🏫 GIẢNG VIÊN
            </div>
            <h2 id="teachers-heading" className="text-3xl md:text-5xl font-bold text-gray-900 mb-4">
              Cam kết đạt ít nhất <span className="text-cyan-500">8 ĐIỂM</span> môn toán
            </h2>
            <h3 className="text-2xl md:text-3xl font-bold text-gray-900">
              Nếu theo đúng lộ trình của lớp học!
            </h3>
          </header>
        </ScrollReveal>

        {/* Main Content Grid */}
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <ScrollReveal direction="left">
              <div className="space-y-6">
                {/* Teacher Info */}
                <div className="space-y-2">
                  <h4 className="text-xl text-gray-700">
                    Thầy <span className="font-bold">Tô Minh Thành</span> - Founder Trung Tâm Minh Thành Math
                  </h4>
                  
                </div>

                {/* Achievements */}
                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-orange-400 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg">
                      <CheckCircle className="text-white" size={24} />
                    </div>
                    <div>
                      <p className="text-gray-700 leading-relaxed">
                        Cử nhân <span className="font-bold">Đại học Ngoại Thương</span>
                      </p>
                      <p className="text-gray-700 leading-relaxed">
                        <span className="font-bold">8+ năm kinh nghiệm</span> dạy Toán
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-orange-400 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg">
                      <CheckCircle className="text-white" size={24} />
                    </div>
                    <p className="text-gray-700 leading-relaxed">
                      Nội tiếng về việc đưa rất nhiều học sinh trung bình, thậm chí mất gốc đạt {">"} 9 điểm toán các kỳ thi chỉ trong 1 thời gian ngắn theo học
                    </p>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-orange-400 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg">
                      <CheckCircle className="text-white" size={24} />
                    </div>
                    <p className="text-gray-700 leading-relaxed">
                      <span className="font-bold">Chuyên gia phân tích đề thi THPT Quốc gia</span>
                      <br />
                      Ôn trúng 45/50 câu đề thi chính thức
                    </p>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-orange-400 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg">
                      <CheckCircle className="text-white" size={24} />
                    </div>
                    <p className="text-gray-700 leading-relaxed">
                      Giáo viên Toán duy nhất cam kết được điểm số và đảm bảo tỉ lệ{" "}
                      <span className="font-bold">100% đỗ Đại Học</span>.
                    </p>
                  </div>
                </div>
              </div>
            </ScrollReveal>

            {/* Right - Teacher Image */}
            <ScrollReveal direction="right">
              <div className="relative">
                {/* Yellow decorative circle */}
                <div className="absolute -bottom-8 -left-8 w-80 h-80 bg-gradient-to-br from-yellow-400 to-orange-400 rounded-full opacity-30 blur-2xl"></div>
                <div className="absolute bottom-0 right-0 w-96 h-96 bg-gradient-to-tl from-yellow-300 to-orange-300 rounded-full -z-10"></div>
                
                {/* Teacher image */}
                <div className="relative z-10">
                  <img
                    src={teacherImage}
                    alt="Thầy Tô Minh Thành - Founder Minh Thành Math"
                    className="w-full h-auto object-cover rounded-3xl"
                  />
                </div>
              </div>
            </ScrollReveal>
          </div>

          {/* Stats Section */}
          <ScrollReveal delay={0.4}>
            <div className="grid md:grid-cols-3 gap-8 mt-16">
              <div className="text-center">
                <div className="text-4xl md:text-5xl font-bold text-cyan-500 mb-2">5000+</div>
                <p className="text-gray-600">
                  Học sinh khắp VN theo dõi trên
                  <br />
                  Fanpage, Youtube, Tiktok
                </p>
              </div>
              <div className="text-center">
                <div className="text-4xl md:text-5xl font-bold text-cyan-500 mb-2">90%</div>
                <p className="text-gray-600">
                  Học sinh trên 8 điểm
                  <br />
                  trong kỳ thi Đại học
                </p>
              </div>
              <div className="text-center">
                <div className="text-4xl md:text-5xl font-bold text-cyan-500 mb-2">Giáo viên</div>
                <p className="text-gray-600">
                  Giảng dạy hàng ngày trên các nền tảng
                  <br />
                  <span className="font-bold text-red-600">trực tuyến</span>
                </p>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}

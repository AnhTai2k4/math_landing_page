import { Button } from "./ui/button";
import { Gift, Sparkles, Clock } from "lucide-react";
import promotionImage from "figma:asset/7e1c4bdfd740391c0189286f640a886737fbeea2.png";
import { ScrollReveal } from "./ScrollReveal";
import React from "react";

export function PromotionsSection() {
  const scrollToRegister = () => {
    const element = document.getElementById("register");
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section id="promotions" className="py-14 bg-gradient-to-br from-blue-50 via-white to-gray-50 relative overflow-hidden" aria-labelledby="promotions-heading">
      {/* Decorative patterns */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-400 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-400 rounded-full blur-3xl"></div>
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <ScrollReveal>
          <header className="text-center mb-10">
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-5 py-1.5 rounded-full mb-3 shadow-lg">
              <Gift className="animate-bounce" size={18} />
              <span className="font-bold text-2xl">ƯU ĐÃI ĐẶC BIỆT</span>
            </div>
            <h2 id="promotions-heading" className="text-3xl md:text-4xl font-bold text-blue-900 mb-3">
              Chương Trình <span className="text-yellow-600">Ưu Đãi Hấp Dẫn</span>
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Đăng ký ngay hôm nay để nhận được các ưu đãi học phí cực khủng!
            </p>
          </header>
        </ScrollReveal>

        <div className="grid lg:grid-cols-2 gap-10 items-center max-w-6xl mx-auto">
          {/* Promotion Image */}
          <ScrollReveal direction="left">
            <div className="relative group">
              <div className="absolute -inset-4 bg-gradient-to-r from-yellow-400 to-orange-400 rounded-3xl blur-xl opacity-30 group-hover:opacity-50 transition-opacity"></div>
              <div className="relative rounded-3xl overflow-hidden shadow-2xl border-4 border-yellow-400">
                <img 
                  src="/sale.jpg"
                  alt="Ưu đãi hấp dẫn - Giảm 20%, 25%, 30% khi đăng ký 1, 2, 3 bạn" 
                  className="w-full h-auto object-cover"
                />
              </div>
            </div>
          </ScrollReveal>

          {/* Promotion Details */}
          <div className="space-y-6">
            <ScrollReveal delay={0.2}>
              <div className="bg-white rounded-2xl shadow-xl p-8 border-l-4 border-yellow-400">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl flex items-center justify-center">
                    <span className="text-white text-2xl font-bold">1</span>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-blue-900">Giảm 20%</h3>
                    <p className="text-gray-600">Đăng ký 1 bạn cùng học</p>
                  </div>
                </div>
                <p className="text-gray-700">
                  Rủ một người bạn cùng học và nhận ngay ưu đãi <span className="font-bold text-yellow-600">giảm 20%</span> học phí cho cả hai!
                </p>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={0.3}>
              <div className="bg-white rounded-2xl shadow-xl p-8 border-l-4 border-orange-500">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center">
                    <span className="text-white text-2xl font-bold">2</span>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-blue-900">Giảm 25%</h3>
                    <p className="text-gray-600">Đăng ký nhóm 2 bạn</p>
                  </div>
                </div>
                <p className="text-gray-700">
                  Học nhóm 2 bạn để nhận ưu đãi <span className="font-bold text-orange-600">giảm 25%</span> và cùng tiến bộ hơn mỗi ngày!
                </p>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={0.4}>
              <div className="bg-white rounded-2xl shadow-xl p-8 border-l-4 border-red-500">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-pink-600 rounded-xl flex items-center justify-center">
                    <span className="text-white text-2xl font-bold">3</span>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-blue-900">Giảm 30%</h3>
                    <p className="text-gray-600">Đăng ký nhóm 3 bạn</p>
                  </div>
                </div>
                <p className="text-gray-700">
                  Nhóm từ 3 bạn trở lên nhận ưu đãi <span className="font-bold text-red-600">giảm đến 30%</span> - Tiết kiệm nhất!
                </p>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={0.5}>
              <div className="bg-gradient-to-r from-blue-900 to-blue-800 rounded-2xl p-8 text-white shadow-xl">
                <div className="flex items-start gap-3 mb-4">
                  <Sparkles className="text-yellow-400 flex-shrink-0" size={28} />
                  <div>
                    <h3 className="text-xl font-bold mb-2">Quà Tặng Đặc Biệt</h3>
                    <p className="text-blue-100">
                      <span className="font-bold text-yellow-400">TẶNG TRỌN BỘ</span> tài liệu lấy gốc Toán 10 và 11 khi đăng ký bất kỳ gói nào!
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-6 bg-blue-800 rounded-lg p-3">
                  <Clock className="text-yellow-400" size={20} />
                  <p className="text-sm">Ưu đãi có thời hạn - Đăng ký ngay để không bỏ lỡ!</p>
                </div>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={0.6}>
              <Button 
                size="lg" 
                onClick={scrollToRegister}
                className="w-full bg-gradient-to-r from-yellow-400 to-orange-400 hover:from-yellow-500 hover:to-orange-500 text-blue-900 font-bold text-lg py-6 shadow-xl"
              >
                <Gift className="mr-2" size={24} />
                Đăng Ký Nhận Ưu Đãi Ngay
              </Button>
            </ScrollReveal>
          </div>
        </div>
      </div>
    </section>
  );
}
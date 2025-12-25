import { Star, Heart } from "lucide-react";
import feedbackClassImage from "figma:asset/d56a53b54b176fd3ff4b77016e41cca55d662b40.png";
import feedbackNotesImage from "figma:asset/35b1461c5a7359dbd98f1549d1acd92a614c862b.png";
import { ScrollReveal } from "./ScrollReveal";
import React from "react";

export function ClassSection() {
  return (
    <section id="class" className="py-14 bg-white relative overflow-hidden" aria-labelledby="class-heading">
      {/* Background decoration */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-20 right-20 w-96 h-96 bg-blue-400 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 left-20 w-80 h-80 bg-yellow-400 rounded-full blur-3xl"></div>
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <ScrollReveal>
          <header className="text-center mb-7">
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-800 text-white px-5 py-1.5 rounded-full mb-3 shadow-lg">
              <Heart className="fill-yellow-400 text-yellow-400" size={18} />
              <span className="font-bold text-2xl">LỚP HỌC</span>
            </div>
            <h2 id="class-heading" className="text-3xl md:text-4xl font-bold text-blue-900 mb-3">
              Khoảnh Khắc Tại <span className="text-yellow-600">Minh Thành Math</span>
            </h2>
          </header>
        </ScrollReveal>

        {/* Class Photos Section */}
        <div className="mb-16">
          <ScrollReveal>
            <div className="text-center mb-6">
             
              <p className="text-gray-600 text-sm">
                "Từ từng ghét toán, giờ thầy toán cùng chill" - Không khí học tập vui vẻ, năng động
              </p>
            </div>
          </ScrollReveal>
          
          <ScrollReveal delay={0.2}>
            <div className="relative group max-w-3xl mx-auto">
              <div className="absolute -inset-4 bg-gradient-to-r from-blue-400 to-yellow-400 rounded-3xl blur-2xl opacity-20 group-hover:opacity-40 transition-opacity"></div>
              <div className="relative rounded-2xl overflow-hidden shadow-2xl border-4 border-blue-200">
                <img 
                  src={feedbackClassImage} 
                  alt="Học sinh Minh Thành Math - Khoảnh khắc vui vẻ tại lớp học" 
                  className="w-full h-auto object-cover"
                />
              </div>
            </div>
          </ScrollReveal>
        </div>

        {/* Student Notes & Achievements Section */}
        <div>
          <ScrollReveal>
            <div className="text-center mb-6">
              <h3 className="text-2xl font-bold text-blue-900 mb-2">
                Hành Trình Chinh Phục Toán Của Các Bạn Học Sinh
              </h3>
              <p className="text-gray-600 text-sm">
                Đồng hành cùng 2000+ hành trình chinh phục toán - Bài viết, cảm nhận chân thành từ học sinh
              </p>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={0.2}>
            <div className="relative group max-w-3xl mx-auto">
              <div className="absolute -inset-4 bg-gradient-to-r from-yellow-400 to-orange-400 rounded-3xl blur-2xl opacity-20 group-hover:opacity-40 transition-opacity"></div>
              <div className="relative rounded-2xl overflow-hidden shadow-2xl border-4 border-yellow-200">
                <img 
                  src={feedbackNotesImage} 
                  alt="Phản hồi học sinh Minh Thành Math - Hơn 1000 hành trình chinh phục toán" 
                  className="w-full h-auto object-cover"
                />
              </div>
            </div>
          </ScrollReveal>

         
        </div>
      </div>
    </section>
  );
}

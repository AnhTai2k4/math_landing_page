import { Facebook, Mail, Phone, MapPin, Youtube, Instagram } from "lucide-react";
import logoImage from "figma:asset/c3828b87f854d6b00602b5cf82b0722439681986.png";
import React from "react";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gradient-to-br from-blue-900 to-blue-950 text-gray-300" role="contentinfo">
      <div className="container mx-auto px-4 py-16">
        <div className="grid md:grid-cols-4 gap-12">
          {/* Logo and About */}
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <img 
                src={logoImage} 
                alt="Minh Thành Math Logo" 
                className="h-16 w-auto"
              />
            </div>
            <div className="text-xl font-bold text-white">MINH THÀNH MATH</div>
            <p className="text-blue-200 leading-relaxed">
              Đồng hành cùng học sinh chinh phục đỉnh cao tri thức toán học
            </p>
            <div className="flex gap-3">
              <a
                href="#"
                className="w-10 h-10 bg-blue-600 hover:bg-blue-500 rounded-xl flex items-center justify-center transition-all hover:scale-110 shadow-lg"
                aria-label="Facebook"
              >
                <Facebook size={20} className="text-white" />
              </a>
              <a
                href="#"
                className="w-10 h-10 bg-red-600 hover:bg-red-500 rounded-xl flex items-center justify-center transition-all hover:scale-110 shadow-lg"
                aria-label="Youtube"
              >
                <Youtube size={20} className="text-white" />
              </a>
              <a
                href="#"
                className="w-10 h-10 bg-gradient-to-br from-pink-500 to-orange-500 hover:from-pink-400 hover:to-orange-400 rounded-xl flex items-center justify-center transition-all hover:scale-110 shadow-lg"
                aria-label="Instagram"
              >
                <Instagram size={20} className="text-white" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-white font-bold text-lg mb-6 border-b-2 border-yellow-400 pb-2 inline-block">Liên Kết Nhanh</h4>
            <ul className="space-y-3">
              <li>
                <a
                  href="#courses"
                  className="text-blue-200 hover:text-yellow-400 transition-colors flex items-center gap-2"
                >
                  <span className="text-yellow-400">▸</span> Khóa học
                </a>
              </li>
              <li>
                <a
                  href="#teachers"
                  className="text-blue-200 hover:text-yellow-400 transition-colors flex items-center gap-2"
                >
                  <span className="text-yellow-400">▸</span> Giảng Viên
                </a>
              </li>
              <li>
                <a
                  href="#benefits"
                  className="text-blue-200 hover:text-yellow-400 transition-colors flex items-center gap-2"
                >
                  <span className="text-yellow-400">▸</span> Lợi Ích
                </a>
              </li>
              <li>
                <a
                  href="#class"
                  className="text-blue-200 hover:text-yellow-400 transition-colors flex items-center gap-2"
                >
                  <span className="text-yellow-400">▸</span> Lớp Học
                </a>
              </li>
              <li>
                <a
                  href="#feedback"
                  className="text-blue-200 hover:text-yellow-400 transition-colors flex items-center gap-2"
                >
                  <span className="text-yellow-400">▸</span> Phản Hồi
                </a>
              </li>
              <li>
                <a
                  href="#promotions"
                  className="text-blue-200 hover:text-yellow-400 transition-colors flex items-center gap-2"
                >
                  <span className="text-yellow-400">▸</span> Ưu Đãi
                </a>
              </li>
              <li>
                <a
                  href="#register"
                  className="text-blue-200 hover:text-yellow-400 transition-colors flex items-center gap-2"
                >
                  <span className="text-yellow-400">▸</span> Đăng ký 
                </a>
              </li>
            </ul>
          </div>

          {/* Courses */}
          <div>
            <h4 className="text-white font-bold text-lg mb-6 border-b-2 border-yellow-400 pb-2 inline-block">Khóa Học</h4>
            <ul className="space-y-3 text-blue-200">
              <li className="flex items-center gap-2">
                <span className="text-yellow-400">✓</span> Toán lớp 10
              </li>
              <li className="flex items-center gap-2">
                <span className="text-yellow-400">✓</span> Toán lớp 11
              </li>
              <li className="flex items-center gap-2">
                <span className="text-yellow-400">✓</span> Toán lớp 12
              </li>
              <li className="flex items-center gap-2">
                <span className="text-yellow-400">✓</span> Luyện thi THPT Quốc gia
              </li>
              <li className="flex items-center gap-2">
                <span className="text-yellow-400">✓</span> Học thử miễn phí
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-white font-bold text-lg mb-6 border-b-2 border-yellow-400 pb-2 inline-block">Liên Hệ</h4>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <Phone size={20} className="text-yellow-400 flex-shrink-0 mt-1" />
                <div className="text-blue-200">
                  <p className="hover:text-yellow-400 transition-colors">0964345413</p>
  
                </div>
              </li>
              <li className="flex items-start gap-3">
                <Mail size={20} className="text-yellow-400 flex-shrink-0 mt-1" />
                <p className="text-blue-200 hover:text-yellow-400 transition-colors">contact@minhthanhmath.com</p>
              </li>
              <li className="flex items-start gap-3">
                <MapPin size={20} className="text-yellow-400 flex-shrink-0 mt-1" />
                <p className="text-blue-200">
                  82 Chùa Láng, Láng Thượng<br />
                  Đống Đa, Hà Nội
                </p>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-blue-800 mt-12 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-blue-300">
              © {currentYear} <span className="text-yellow-400 font-bold">Minh Thành Math</span>. Bảo lưu mọi quyền.
            </p>
            <div className="flex gap-8">
              <a href="#" className="text-blue-200 hover:text-yellow-400 transition-colors">
                Chính sách bảo mật
              </a>
              <a href="#" className="text-blue-200 hover:text-yellow-400 transition-colors">
                Điều khoản sử dụng
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
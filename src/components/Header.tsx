import { Menu, X } from "lucide-react";
import { Button } from "./ui/button";
import { useState } from "react";
import logoImage from "figma:asset/c3828b87f854d6b00602b5cf82b0722439681986.png";
import React from "react";
export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
      setIsMenuOpen(false);
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 bg-white shadow-lg z-50 border-b-4 border-yellow-400" role="banner">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Logo with Brand Name */}
          <div className="flex items-center gap-4">
            <img 
              src={logoImage} 
              alt="Minh Thành Math Logo" 
              className="h-16 w-auto"
            />
            <div className="hidden sm:block">
              <div className="text-xl font-bold text-blue-900">MINH THÀNH MATH</div>
              <div className="text-xs text-yellow-600 uppercase tracking-wide">Luyện Thi Toán THCS - THPT</div>
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            
            <button
              onClick={() => scrollToSection("courses")}
              className="text-gray-700 hover:text-blue-900 transition-colors font-medium"
            >
              Khóa Học
            </button>

            <button
              onClick={() => scrollToSection("teachers")}
              className="text-gray-700 hover:text-blue-900 transition-colors font-medium"
            >
              Giảng Viên
            </button>

            <button
              onClick={() => scrollToSection("benefits")}
              className="text-gray-700 hover:text-blue-900 transition-colors font-medium"
            >
              Lợi Ích
            </button>

            <button
              onClick={() => scrollToSection("class")}
              className="text-gray-700 hover:text-blue-900 transition-colors font-medium"
            >
              Lớp Học
            </button>

            <button
              onClick={() => scrollToSection("feedback")}
              className="text-gray-700 hover:text-blue-900 transition-colors font-medium"
            >
              Phản Hồi
            </button>
            
            <button
              onClick={() => scrollToSection("promotions")}
              className="text-gray-700 hover:text-blue-900 transition-colors font-medium"
            >
              Ưu Đãi
            </button>
            
            
            
            
            <Button onClick={() => scrollToSection("register")} className="bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-blue-900 font-bold shadow-md">
              Đăng Ký Ngay
            </Button>
          </nav>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden text-gray-700"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <nav className="md:hidden mt-4 pb-4 flex flex-col gap-3">
            <button
              onClick={() => scrollToSection("home")}
              className="text-gray-700 hover:text-blue-900 transition-colors text-left font-medium"
            >
              Trang Chủ
            </button>
            <button
              onClick={() => scrollToSection("promotions")}
              className="text-gray-700 hover:text-blue-900 transition-colors text-left font-medium"
            >
              Ưu Đãi
            </button>
            <button
              onClick={() => scrollToSection("courses")}
              className="text-gray-700 hover:text-blue-900 transition-colors text-left font-medium"
            >
              Khóa Học
            </button>
            <button
              onClick={() => scrollToSection("benefits")}
              className="text-gray-700 hover:text-blue-900 transition-colors text-left font-medium"
            >
              Lợi Ích
            </button>
            <button
              onClick={() => scrollToSection("class")}
              className="text-gray-700 hover:text-blue-900 transition-colors text-left font-medium"
            >
              Lớp Học
            </button>
            <button
              onClick={() => scrollToSection("feedback")}
              className="text-gray-700 hover:text-blue-900 transition-colors text-left font-medium"
            >
              Phản Hồi
            </button>
            <Button onClick={() => scrollToSection("register")} className="w-full bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-blue-900 font-bold">
              Đăng Ký Ngay
            </Button>
          </nav>
        )}
      </div>
    </header>
  );
}
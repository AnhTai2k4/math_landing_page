import { Button } from "./ui/button";
import { Gift } from "lucide-react";
import { ScrollReveal } from "./ScrollReveal";
import React from "react";

export function PromotionsSection() {
  return <section id="promotions" className="py-14 bg-blue-50" aria-labelledby="promotions-heading">
    <div className="container mx-auto px-4 max-w-6xl">
      <ScrollReveal><header className="text-center mb-10">
        <Gift className="mx-auto mb-3 text-yellow-600" size={32}/>
        <h2 id="promotions-heading" className="text-3xl md:text-4xl font-bold text-blue-900 mb-3">Ưu đãi nhóm XPT online</h2>
        <p className="text-gray-700 max-w-3xl mx-auto">Dành cho nhóm đăng ký và bắt đầu học cùng nhau trong tháng 9/2026, thuộc gói online 2K9 XPT, 2K10 XPT hoặc 2K11 XPT. Giảm học phí chỉ trong tháng học đầu tiên sau khi trung tâm xác nhận đủ điều kiện.</p>
      </header></ScrollReveal>
      <div className="grid md:grid-cols-3 gap-6">
        {[{group:"Nhóm 2 bạn",discount:"10%"},{group:"Nhóm 3–5 bạn",discount:"15%"},{group:"Nhóm từ 6 bạn",discount:"25%"}].map(({group,discount})=><div key={group} className="bg-white rounded-2xl shadow-lg p-8 border-t-4 border-yellow-400 text-center"><h3 className="text-xl font-bold text-blue-900">{group}</h3><p className="text-4xl font-bold text-yellow-600 my-4">Giảm {discount}</p><p className="text-gray-600">Học phí tháng đầu của gói XPT online đủ điều kiện.</p></div>)}
      </div>
      <div className="mt-8 bg-white rounded-2xl p-6 text-gray-700 space-y-3">
        <p>Không áp dụng chung cho mọi khóa học; không cộng vào học phí theo buổi, lớp trực tiếp, HSA/TSA hoặc mức riêng đã được xác nhận cho từng học sinh.</p>
        <p>Đăng ký ngoài đợt tháng 9/2026 cần được trung tâm xác nhận chính sách trước khi áp dụng. Các tháng tiếp theo không tiếp tục giảm nhóm.</p>
        <p>Liên hệ để được kiểm tra đúng gói học và điều kiện của nhóm trước khi đóng học phí.</p>
        <Button className="bg-blue-900 text-white" onClick={()=>document.getElementById("register")?.scrollIntoView({behavior:"smooth"})}>Hỏi về gói học phù hợp</Button>
      </div>
    </div>
  </section>;
}
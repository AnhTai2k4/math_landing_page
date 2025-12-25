import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { useState } from "react";
import { toast } from "sonner@2.0.3";
import { ScrollReveal } from "./ScrollReveal";
import emailjs from "@emailjs/browser";

export function RegisterSection() {
  const [formData, setFormData] = useState({
    studentName: "",
    phone: "",
    grade: "",
    message: "",
  });

  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault();

  // Validate rỗng
  if (!formData.studentName || !formData.phone || !formData.grade) {
    toast.error("Vui lòng điền đầy đủ thông tin bắt buộc!");
    return;
  }

  // ✅ Validate số điện thoại (10 chữ số)
  const phoneRegex = /^[0-9]{10}$/;
  if (!phoneRegex.test(formData.phone)) {
    toast.error("Số điện thoại không hợp lệ (phải đủ 10 chữ số)");
    return;
  }

  // Dữ liệu gửi EmailJS
  const templateParams = {
    studentName: formData.studentName,
    phone: formData.phone,
    grade: formData.grade,
    message: formData.message,
    time: new Date().toLocaleString("vi-VN"),
  };

  emailjs
    .send(
      import.meta.env.VITE_SERVICE_KEY,
      import.meta.env.VITE_TEMPLATE_KEY,
      templateParams,
      import.meta.env.VITE_PUBLIC_KEY
    )
    .then(
      () => {
        toast.success("Đăng ký thành công! Chúng tôi sẽ liên hệ sớm.");
        setIsSubmitted(true);

        setFormData({
          studentName: "",
          phone: "",
          grade: "",
          message: "",
        });

        setTimeout(() => setIsSubmitted(false), 3000);
      },
      () => {
        toast.error("Gửi đăng ký thất bại. Vui lòng thử lại!");
      }
    );
};


  return (
    <section
      id="register"
      className="py-14 bg-white relative overflow-hidden"
    >
      <div className="container mx-auto px-4">
        <ScrollReveal>
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold text-blue-600 mb-8 uppercase">
              Đăng Ký Học Thử Miễn Phí
            </h2>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Họ tên */}
              <div className="space-y-2">
                <Label>Họ và tên học sinh *</Label>
                <Input
                  value={formData.studentName}
                  onChange={(e) =>
                    setFormData({ ...formData, studentName: e.target.value })
                  }
                />
              </div>

              {/* Phone */}
              <div className="space-y-2">
                <Label>Số điện thoại *</Label>
                <Input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                />
              </div>

              {/* Grade */}
              <div className="space-y-2">
                <Label>Lớp học *</Label>
                <Select
                  value={formData.grade}
                  onValueChange={(value) =>
                    setFormData({ ...formData, grade: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn lớp học" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">Lớp 10</SelectItem>
                    <SelectItem value="11">Lớp 11</SelectItem>
                    <SelectItem value="12">Lớp 12</SelectItem>
                    <SelectItem value="dgnl">ĐGNL</SelectItem>
                    <SelectItem value="thcs">THCS</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Message */}
              <div className="space-y-2">
                <Label>Hình thức học *</Label>
                <Select
                  value={formData.message}
                  onValueChange={(value) =>
                    setFormData({ ...formData, message: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn hình thức" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="truc-tiep">
                      LỚP HỌC TOÁN TRỰC TIẾP
                    </SelectItem>
                    <SelectItem value="online">
                      LỚP HỌC TOÁN ONLINE
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                type="submit"
                disabled={isSubmitted}
                className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold px-10 py-2 rounded-full"
              >
                Đăng ký
              </Button>

              {isSubmitted && (
                <p className="text-sm text-green-500">
                  Form đã được gửi thành công 🎉
                </p>
              )}
            </form>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}

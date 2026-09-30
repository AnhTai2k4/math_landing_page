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
import { useRef, useState } from "react";
import { toast } from "sonner@2.0.3";
import { ScrollReveal } from "./ScrollReveal";
import emailjs from "@emailjs/browser";

import { createRegistrationGate } from './registration-submit';

export function RegisterSection() {
  const [formData, setFormData] = useState({
    studentName: "",
    phone: "",
    grade: "",
    message: "",
  });

  const [isSubmitted, setIsSubmitted] = useState(false);

  const [isPending,setIsPending]=useState(false);
  const gate=useRef(createRegistrationGate()); const submitting=useRef(false);
  const handleSubmit=async(e:React.FormEvent)=>{
    e.preventDefault();if(isSubmitted||submitting.current)return;submitting.current=true;
    try{
      const sent=await gate.current(formData,async(data)=>{
        if(!import.meta.env.VITE_SERVICE_KEY||!import.meta.env.VITE_TEMPLATE_KEY||!import.meta.env.VITE_PUBLIC_KEY)throw new Error('Form chưa sẵn sàng. Vui lòng liên hệ trung tâm qua kênh tư vấn.');
        setIsPending(true);
        await emailjs.send(import.meta.env.VITE_SERVICE_KEY,import.meta.env.VITE_TEMPLATE_KEY,{...data,time:new Date().toLocaleString('vi-VN',{timeZone:'Asia/Saigon'})},import.meta.env.VITE_PUBLIC_KEY);
      });
      if(sent){toast.success('Đã gửi yêu cầu tư vấn. Trung tâm sẽ liên hệ để xác nhận.');setIsSubmitted(true);setFormData({studentName:'',phone:'',grade:'',message:''});}
    }catch(error){toast.error(error instanceof Error?error.message:'Chưa xác nhận gửi được. Kiểm tra thông tin trước khi thử lại.');}
    finally{submitting.current=false;setIsPending(false);}
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
              Đăng Ký Tư Vấn
            </h2>

            <form onSubmit={handleSubmit} className="space-y-6"><fieldset disabled={isPending || isSubmitted} className="space-y-6">
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
                disabled={isSubmitted || isPending}
                className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold px-10 py-2 rounded-full"
              >
                {isPending ? "Đang gửi…" : "Gửi yêu cầu tư vấn"}
              </Button>

              {isSubmitted && (
                <p className="text-sm text-green-500">
                  Yêu cầu tư vấn đã được gửi; lịch học và đăng ký cần trung tâm xác nhận.
                </p>
              )}
            </fieldset></form>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}

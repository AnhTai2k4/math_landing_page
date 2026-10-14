-- 15/10/2026 (Claude, nghiệm thu preview): cổng chỉ liệt kê lớp đã có ít nhất một buổi BTVN đang mở.
-- Lớp chưa có bài trước đây vẫn hiện, học sinh nhập đúng vẫn nhận lỗi chung và tưởng mình nhập sai.
-- Lớp mới tự hiện khi buổi đầu tiên của lớp được đăng. Giữ nguyên quyền thực thi hiện có.
create or replace function public.mtm_btvn_classes() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(label order by label),'[]'::jsonb) from (
  select distinct c.label from mtm_hw_private.classes c
  where c.active and exists(select 1 from mtm_hw_private.btvn_lessons l where l.active and c.id=any(l.class_ids))
 ) x
$$;

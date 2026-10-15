-- 15/10/2026 17:40: HS báo web lỗi làm BTVN. support_events cho thấy: gõ nhầm 1 chữ tên (Vu/Vy) dù SĐT đúng; đúng họ tên nhưng SĐT khác 2 số đã đăng ký.
-- Sửa: SĐT khớp thì nhận tên lệch tối đa 2 ký tự (levenshtein, đã bỏ dấu); không khớp SĐT thì nhận nếu đúng nguyên họ tên của duy nhất 1 em cùng khoá, ghi sự kiện sdt_khac.
create extension if not exists fuzzystrmatch with schema extensions;
alter table mtm_hw_private.support_events drop constraint if exists support_events_kind_check;
alter table mtm_hw_private.support_events add constraint support_events_kind_check check (kind in ('tu_dong_them','dang_nhap_that_bai','sdt_khac'));
CREATE OR REPLACE FUNCTION public.mtm_btvn_forgot(p_full_name text, p_phone text, p_class_name text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare sid uuid;n integer;total integer;nk integer;sidk uuid;np integer;sidp uuid;sidplus uuid;raw text;mismatch boolean=false;begin
 if not mtm_hw_private.valid_text(p_full_name,160) or not mtm_hw_private.valid_text(p_phone,160) or not mtm_hw_private.valid_text(p_class_name,160) or mtm_hw_private.btvn_phone2(p_phone) !~ '^0[0-9]{9}$' then if mtm_hw_private.valid_text(p_full_name,160) and mtm_hw_private.valid_text(p_phone,160) then insert into mtm_hw_private.support_events(kind,class_name,full_name,phone) values('dang_nhap_that_bai',left(p_class_name,160),left(p_full_name,160),left(p_phone,40)); end if; return '{"ok":false}'::jsonb;end if;
 with candidates as (
  select s.id,c.label from mtm_hw_private.students s join mtm_hw_private.classes c on c.id=s.class_id
  where s.active and c.active and length(mtm_hw_private.btvn_fold(p_full_name))>=2
  and mtm_hw_private.btvn_phone2(p_phone) in (mtm_hw_private.btvn_phone2(s.student_phone),mtm_hw_private.btvn_phone2(s.parent_phone))
  and (mtm_hw_private.btvn_fold(p_full_name) in (mtm_hw_private.btvn_fold(s.full_name),mtm_hw_private.btvn_fold(s.parent_name))
   or extensions.levenshtein(mtm_hw_private.btvn_fold(p_full_name),mtm_hw_private.btvn_fold(s.full_name))<=2
   or extensions.levenshtein(mtm_hw_private.btvn_fold(p_full_name),coalesce(mtm_hw_private.btvn_fold(s.parent_name),''))<=2
   or mtm_hw_private.btvn_fold(s.full_name) like '% '||mtm_hw_private.btvn_fold(p_full_name)
   or mtm_hw_private.btvn_fold(s.parent_name) like '% '||mtm_hw_private.btvn_fold(p_full_name))
 ) select count(*),count(*) filter(where mtm_hw_private.btvn_name(label)=mtm_hw_private.btvn_name(p_class_name)),
 coalesce((array_agg(id) filter(where mtm_hw_private.btvn_name(label)=mtm_hw_private.btvn_name(p_class_name)))[1],(array_agg(id))[1]),
 count(*) filter(where substring(lower(label) from '^2k[0-9]+')=substring(lower(p_class_name) from '^2k[0-9]+')),
 (array_agg(id) filter(where substring(lower(label) from '^2k[0-9]+')=substring(lower(p_class_name) from '^2k[0-9]+')))[1]
,
 count(*) filter(where substring(lower(label) from '^2k[0-9]+')=substring(lower(p_class_name) from '^2k[0-9]+') and label~'[0-9]\+$' and p_class_name~'[0-9]\+$'),
 (array_agg(id) filter(where substring(lower(label) from '^2k[0-9]+')=substring(lower(p_class_name) from '^2k[0-9]+') and label~'[0-9]\+$' and p_class_name~'[0-9]\+$'))[1]
,
 (array_agg(id) filter(where label~'[0-9]\+$'))[1]
 into total,n,sid,nk,sidk,np,sidp,sidplus from candidates;
 -- 16: không có trong DS học sinh thì tra sổ điểm danh, khớp thì tự thêm hồ sơ.
 if total=0 then sid=mtm_hw_private.btvn_auto_add_from_attendance(p_full_name,p_phone,p_class_name); if sid is not null then total=1;n=1; end if; end if;
 -- 18: SĐT khác hồ sơ nhưng đúng nguyên họ tên (>= 2 chữ) của DUY NHẤT một em cùng khoá với lớp chọn: cho vào, ghi sự kiện để giáo vụ cập nhật SĐT.
 if total=0 and position(' ' in mtm_hw_private.btvn_fold(p_full_name))>0 then
  select (array_agg(s.id))[1],count(*) into sidk,nk from mtm_hw_private.students s join mtm_hw_private.classes c on c.id=s.class_id
  where s.active and c.active and mtm_hw_private.btvn_fold(s.full_name)=mtm_hw_private.btvn_fold(p_full_name)
   and substring(lower(c.label) from '^2k[0-9]+')=substring(lower(p_class_name) from '^2k[0-9]+');
  if nk=1 then sid=sidk;total=1;n=1;
   insert into mtm_hw_private.support_events(kind,class_name,full_name,phone,student_id) values('sdt_khac',left(p_class_name,160),left(p_full_name,160),left(p_phone,40),sid);
  end if;
 end if;
 -- 15/10 anh Thành: 2K9 chọn 8+ hay 9+ đều được miễn cùng khoá; em học 2 lớp (vd. 9+ và HSA) chọn nhầm lớp cùng khoá vẫn vào lớp duy nhất khớp khoá.
 if n=1 then mismatch=false;elsif n=0 and np=1 then sid=sidp;mismatch=true;elsif n=0 and nk=1 then sid=sidk;mismatch=true;elsif n=0 and total=1 then mismatch=true;
 -- 17: nhiều hồ sơ cùng một người (đã khớp tên + SĐT) mà lớp chọn không khớp hồ sơ nào: ưu tiên lớp 8+/9+, rồi hồ sơ đầu.
 elsif n=0 and total>1 then sid=coalesce(sidplus,sid);mismatch=true;
 else insert into mtm_hw_private.support_events(kind,class_name,full_name,phone) values('dang_nhap_that_bai',left(p_class_name,160),left(p_full_name,160),left(p_phone,40)); return '{"ok":false}'::jsonb;end if;
 raw=mtm_hw_private.random_token();insert into mtm_hw_private.btvn_identity_sessions values(mtm_hw_private.token_digest('btvn-identity',raw),sid,clock_timestamp()+interval '4 hours',null);
 return jsonb_build_object('ok',true,'session',raw,'classMismatch',mismatch);
end$function$
;

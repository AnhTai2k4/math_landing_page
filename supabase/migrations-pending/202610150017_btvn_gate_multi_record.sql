-- 15/10/2026: em có 2 hồ sơ (vd. 2K9 9+ và HSA CN) chọn lớp HSA thứ Năm (không có hồ sơ) thì bị từ chối. Sửa: vẫn cho vào hồ sơ ưu tiên 8+/9+.
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
 -- 15/10 anh Thành: 2K9 chọn 8+ hay 9+ đều được miễn cùng khoá; em học 2 lớp (vd. 9+ và HSA) chọn nhầm lớp cùng khoá vẫn vào lớp duy nhất khớp khoá.
 if n=1 then mismatch=false;elsif n=0 and np=1 then sid=sidp;mismatch=true;elsif n=0 and nk=1 then sid=sidk;mismatch=true;elsif n=0 and total=1 then mismatch=true;
 -- 17: nhiều hồ sơ cùng một người (đã khớp tên + SĐT) mà lớp chọn không khớp hồ sơ nào: ưu tiên lớp 8+/9+, rồi hồ sơ đầu.
 elsif n=0 and total>1 then sid=coalesce(sidplus,sid);mismatch=true;
 else insert into mtm_hw_private.support_events(kind,class_name,full_name,phone) values('dang_nhap_that_bai',left(p_class_name,160),left(p_full_name,160),left(p_phone,40)); return '{"ok":false}'::jsonb;end if;
 raw=mtm_hw_private.random_token();insert into mtm_hw_private.btvn_identity_sessions values(mtm_hw_private.token_digest('btvn-identity',raw),sid,clock_timestamp()+interval '4 hours',null);
 return jsonb_build_object('ok',true,'session',raw,'classMismatch',mismatch);
end$function$
;

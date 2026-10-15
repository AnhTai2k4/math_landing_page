-- 15/10/2026 anh Thành: "quét thật kỹ tất cả các phần đăng nhập... để tất cả học sinh đều phải vào làm được".
-- Thử trên web thật: gõ tên không dấu, SĐT thiếu số 0 đầu, chỉ gõ tên riêng đều bị từ chối;
-- 30 hồ sơ có ghi chú trong ngoặc ở họ tên (vd. "(CHỈ HỌC THỨ 2)") nên gõ đúng tên thật cũng không khớp.
-- Sửa: so tên đã bỏ dấu, bỏ ghi chú ngoặc; nhận tên riêng/đuôi họ tên khi SĐT khớp; SĐT 9 số hoặc 84... đổi về 0...
-- Không đổi btvn_name/btvn_phone (hàm đồng bộ khác còn dùng). Bản gốc hàm: mtm_btvn_forgot trước 015.
create or replace function mtm_hw_private.btvn_fold(v text) returns text language sql immutable set search_path to '' as $$
 select btrim(translate(regexp_replace(lower(regexp_replace(normalize(coalesce(v,''),NFC),'\s*[\(\[].*$','')),'\s+',' ','g'),'àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ','aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd'))
$$;
create or replace function mtm_hw_private.btvn_phone2(v text) returns text language sql immutable set search_path to '' as $$
 select case when d ~ '^84[1-9][0-9]{8}$' then '0'||substr(d,3) when d ~ '^[1-9][0-9]{8}$' then '0'||d else d end
 from (select regexp_replace(coalesce(v,''),'[^0-9]','','g') d) x
$$;
CREATE OR REPLACE FUNCTION public.mtm_btvn_forgot(p_full_name text, p_phone text, p_class_name text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare sid uuid;n integer;total integer;nk integer;sidk uuid;np integer;sidp uuid;raw text;mismatch boolean=false;begin
 if not mtm_hw_private.valid_text(p_full_name,160) or not mtm_hw_private.valid_text(p_phone,160) or not mtm_hw_private.valid_text(p_class_name,160) or mtm_hw_private.btvn_phone2(p_phone) !~ '^0[0-9]{9}$' then return '{"ok":false}'::jsonb;end if;
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
 into total,n,sid,nk,sidk,np,sidp from candidates;
 -- 15/10 anh Thành: 2K9 chọn 8+ hay 9+ đều được miễn cùng khoá; em học 2 lớp (vd. 9+ và HSA) chọn nhầm lớp cùng khoá vẫn vào lớp duy nhất khớp khoá.
 if n=1 then mismatch=false;elsif n=0 and np=1 then sid=sidp;mismatch=true;elsif n=0 and nk=1 then sid=sidk;mismatch=true;elsif n=0 and total=1 then mismatch=true;else return '{"ok":false}'::jsonb;end if;
 raw=mtm_hw_private.random_token();insert into mtm_hw_private.btvn_identity_sessions values(mtm_hw_private.token_digest('btvn-identity',raw),sid,clock_timestamp()+interval '4 hours',null);
 return jsonb_build_object('ok',true,'session',raw,'classMismatch',mismatch);
end$function$
;

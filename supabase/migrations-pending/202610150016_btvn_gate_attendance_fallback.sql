-- 15/10/2026 anh Thành: "vấn đề liên quan đến web, kỹ thuật thì ... giải quyết tự động luôn ... không cần phải qua con người xác nhận nữa";
-- "quét thật kỹ tất cả các phần đăng nhập ... để hỗ trợ tất cả học sinh đều phải vào làm được".
-- Thực tế 15/10: 13 em có trong sổ điểm danh nhưng thiếu trong Sheet DS học sinh nên không vào được web.
-- Sửa:
--  1. Bảng attendance_roster: danh sách lấy từ sổ điểm danh (họ tên, SĐT, nhãn lớp web), đồng bộ bằng RPC (service role).
--  2. mtm_btvn_forgot: không khớp DS học sinh thì tra sổ điểm danh; khớp SĐT + tên thì TỰ thêm hồ sơ và cho vào luôn.
--  3. support_events: ghi mỗi lần tự thêm hoặc đăng nhập thất bại, để Claude/Javis tự rà và báo nhóm giáo vụ. Giữ 30 ngày.

create table if not exists mtm_hw_private.attendance_roster(
  id bigserial primary key,
  label text not null,
  full_name text not null,
  phone text not null,
  source text not null default '',
  synced_at timestamptz not null default now()
);
create index if not exists attendance_roster_phone on mtm_hw_private.attendance_roster(mtm_hw_private.btvn_phone2(phone));

create table if not exists mtm_hw_private.support_events(
  id bigserial primary key,
  created_at timestamptz not null default now(),
  kind text not null check (kind in ('tu_dong_them','dang_nhap_that_bai')),
  class_name text,
  full_name text,
  phone text,
  student_id uuid
);
create index if not exists support_events_time on mtm_hw_private.support_events(created_at);

-- Thay toàn bộ danh sách sổ điểm danh (payload: {"rows":[{"label","fullName","phone","source"}]}).
create or replace function public.mtm_btvn_sync_attendance_roster(p_payload jsonb, p_apply boolean default false)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare n integer; bad integer;
begin
  select count(*), count(*) filter (where not exists (select 1 from mtm_hw_private.classes c where c.label = r->>'label' and c.active)
    or mtm_hw_private.btvn_phone2(r->>'phone') !~ '^0[0-9]{9}$' or length(mtm_hw_private.btvn_fold(r->>'fullName')) < 2)
  into n, bad from jsonb_array_elements(coalesce(p_payload->'rows','[]'::jsonb)) r;
  if not p_apply then return jsonb_build_object('ok',true,'rows',n,'invalid',bad,'applied',false); end if;
  delete from mtm_hw_private.attendance_roster;
  insert into mtm_hw_private.attendance_roster(label, full_name, phone, source)
  select r->>'label', btrim(r->>'fullName'), mtm_hw_private.btvn_phone2(r->>'phone'), coalesce(r->>'source','')
  from jsonb_array_elements(p_payload->'rows') r
  where exists (select 1 from mtm_hw_private.classes c where c.label = r->>'label' and c.active)
    and mtm_hw_private.btvn_phone2(r->>'phone') ~ '^0[0-9]{9}$' and length(mtm_hw_private.btvn_fold(r->>'fullName')) >= 2;
  delete from mtm_hw_private.support_events where created_at < now() - interval '30 days';
  return jsonb_build_object('ok',true,'rows',n,'invalid',bad,'applied',true);
end $$;
revoke all on function public.mtm_btvn_sync_attendance_roster(jsonb, boolean) from public, anon, authenticated;
grant execute on function public.mtm_btvn_sync_attendance_roster(jsonb, boolean) to service_role;

-- Báo cáo hỗ trợ cho Claude/Javis (service role).
create or replace function public.mtm_btvn_support_report(p_since timestamptz)
returns jsonb language sql security definer set search_path to '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('at',e.created_at,'kind',e.kind,'className',e.class_name,'fullName',e.full_name,'phone',e.phone,'studentId',e.student_id) order by e.created_at),'[]'::jsonb)
  from mtm_hw_private.support_events e where e.created_at >= p_since
$$;
revoke all on function public.mtm_btvn_support_report(timestamptz) from public, anon, authenticated;
grant execute on function public.mtm_btvn_support_report(timestamptz) to service_role;

-- Tự thêm từ sổ điểm danh. Trả id hồ sơ mới hoặc null (không có hoặc nhiều người khác nhau cùng khớp).
create or replace function mtm_hw_private.btvn_auto_add_from_attendance(p_full_name text, p_phone text, p_class_name text)
returns uuid language plpgsql security definer set search_path to '' as $$
declare people integer; lbl text; nm text; ph text; cid uuid; own uuid; sid uuid;
begin
  with m as (
    select r.* from mtm_hw_private.attendance_roster r
    where mtm_hw_private.btvn_phone2(r.phone) = mtm_hw_private.btvn_phone2(p_phone)
      and (mtm_hw_private.btvn_fold(r.full_name) = mtm_hw_private.btvn_fold(p_full_name)
        or mtm_hw_private.btvn_fold(r.full_name) like '% '||mtm_hw_private.btvn_fold(p_full_name))
  )
  select count(distinct mtm_hw_private.btvn_fold(full_name)),
    coalesce((array_agg(label) filter (where mtm_hw_private.btvn_name(label) = mtm_hw_private.btvn_name(p_class_name)))[1],
             (array_agg(label) filter (where substring(lower(label) from '^2k[0-9]+') = substring(lower(p_class_name) from '^2k[0-9]+')))[1],
             (array_agg(label order by id))[1]),
    (array_agg(full_name order by id))[1], (array_agg(phone order by id))[1]
  into people, lbl, nm, ph from m;
  if people is distinct from 1 then return null; end if;
  -- đã có hồ sơ cùng SĐT (có thể đang tắt vì nghỉ): không tự tạo trùng
  if exists (select 1 from mtm_hw_private.students s where mtm_hw_private.btvn_phone2(ph) in (mtm_hw_private.btvn_phone2(s.student_phone), mtm_hw_private.btvn_phone2(s.parent_phone))
             and mtm_hw_private.btvn_fold(s.full_name) = mtm_hw_private.btvn_fold(nm)) then return null; end if;
  select c.id into cid from mtm_hw_private.classes c where c.label = lbl and c.active;
  select s.owner_id into own from mtm_hw_private.students s where s.owner_id is not null limit 1;
  if cid is null or own is null then return null; end if;
  insert into mtm_hw_private.students(owner_id, class_id, full_name, school, school_class, public_alias, active, student_phone, cohort, source_identity)
  values (own, cid, normalize(btrim(regexp_replace(nm, '\s*[\(\[].*$', '')), NFC), 'Chưa cập nhật', 'Chưa cập nhật',
          'MTM-'||upper(substr(md5(random()::text||ph), 1, 12)), true, ph, split_part(lbl, ' ', 1),
          'diem-danh-tu-dong:'||md5(lbl||ph||clock_timestamp()::text))
  returning id into sid;
  insert into mtm_hw_private.memberships(student_id, class_id) values (sid, cid);
  insert into mtm_hw_private.support_events(kind, class_name, full_name, phone, student_id) values ('tu_dong_them', lbl, nm, ph, sid);
  return sid;
end $$;
revoke all on function mtm_hw_private.btvn_auto_add_from_attendance(text, text, text) from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.mtm_btvn_forgot(p_full_name text, p_phone text, p_class_name text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare sid uuid;n integer;total integer;nk integer;sidk uuid;np integer;sidp uuid;raw text;mismatch boolean=false;begin
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
 into total,n,sid,nk,sidk,np,sidp from candidates;
 -- 16: không có trong DS học sinh thì tra sổ điểm danh, khớp thì tự thêm hồ sơ.
 if total=0 then sid=mtm_hw_private.btvn_auto_add_from_attendance(p_full_name,p_phone,p_class_name); if sid is not null then total=1;n=1; end if; end if;
 -- 15/10 anh Thành: 2K9 chọn 8+ hay 9+ đều được miễn cùng khoá; em học 2 lớp (vd. 9+ và HSA) chọn nhầm lớp cùng khoá vẫn vào lớp duy nhất khớp khoá.
 if n=1 then mismatch=false;elsif n=0 and np=1 then sid=sidp;mismatch=true;elsif n=0 and nk=1 then sid=sidk;mismatch=true;elsif n=0 and total=1 then mismatch=true;else insert into mtm_hw_private.support_events(kind,class_name,full_name,phone) values('dang_nhap_that_bai',left(p_class_name,160),left(p_full_name,160),left(p_phone,40)); return '{"ok":false}'::jsonb;end if;
 raw=mtm_hw_private.random_token();insert into mtm_hw_private.btvn_identity_sessions values(mtm_hw_private.token_digest('btvn-identity',raw),sid,clock_timestamp()+interval '4 hours',null);
 return jsonb_build_object('ok',true,'session',raw,'classMismatch',mismatch);
end$function$
;

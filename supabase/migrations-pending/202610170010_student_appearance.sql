-- PENDING — CHƯA CHẠY trên bất kỳ database nào. Chỉ áp dụng sau khi MTM duyệt
-- phạm vi hồ sơ (ảnh/trường học sinh tự nhập; chỉ chính học
-- sinh xem lại ảnh của mình; không có danh sách/xem ảnh người khác).
--
-- Phụ thuộc 202610150005: mtm_hw_private.btvn_student(p_session text) trả uuid học
-- sinh và raise 42501 khi phiên thiếu/sai/hết hạn. VERIFY chữ ký này và bảng đích
-- của FK (mtm_hw_private.students(id)) trước khi chuyển sang supabase/migrations.
--
-- Ảnh JPEG 192x192 nội tuyến (≤180000 ký tự data URL), không cần bucket/filesystem.
-- Server (server/btvn/avatar-http.ts) kiểm magic + SOF; DB chặn thêm định dạng/kích thước.

begin;

create table if not exists mtm_hw_private.student_appearance (
  student_id uuid primary key references mtm_hw_private.students(id) on delete cascade,
  -- Khoá hồ sơ mờ, độc lập với uuid học sinh; ổn định suốt đời dòng.
  profile_key uuid not null unique default pg_catalog.gen_random_uuid(),
  revision integer not null default 0 check (revision >= 0),
  school text not null default '' check (char_length(school)<=160 and school !~ '[[:cntrl:]]'),
  avatar text not null default 'orbit' check (avatar in ('orbit','spark','prism','wave')),
  photo text not null default '' check (
    photo = '' or (
      char_length(photo) <= 180000
      and photo ~ '^data:image/jpeg;base64,/9j/[A-Za-z0-9+/]+={0,2}$'
    )
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table mtm_hw_private.student_appearance enable row level security;
-- Không policy: chỉ RPC security definer bên dưới đọc/ghi.
revoke all on table mtm_hw_private.student_appearance from public, anon, authenticated, service_role;

create or replace function mtm_hw_private.appearance_json(r mtm_hw_private.student_appearance)
returns jsonb language sql immutable set search_path = '' as $$
  select pg_catalog.jsonb_build_object(
    'profileKey', r.profile_key::text,
    'revision', r.revision,
    'school', r.school,
    'appearance', pg_catalog.jsonb_build_object('avatar', r.avatar, 'photo', r.photo)
  );
$$;
revoke all on function mtm_hw_private.appearance_json(mtm_hw_private.student_appearance) from public, anon, authenticated, service_role;

create or replace function public.mtm_btvn_appearance_read(p_session text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_student uuid := mtm_hw_private.btvn_student(p_session);
  v_row mtm_hw_private.student_appearance;
begin
  if v_student is null then raise exception 'session' using errcode = '42501'; end if;
  insert into mtm_hw_private.student_appearance (student_id) values (v_student)
    on conflict (student_id) do nothing;
  select * into strict v_row from mtm_hw_private.student_appearance where student_id = v_student;
  return mtm_hw_private.appearance_json(v_row);
end $$;

create or replace function public.mtm_btvn_appearance_save(p_session text, p_revision integer, p_avatar text, p_photo text, p_school text, p_profile_key uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_student uuid := mtm_hw_private.btvn_student(p_session);
  v_row mtm_hw_private.student_appearance;
begin
  if v_student is null then raise exception 'session' using errcode = '42501'; end if;
  if p_revision is null or p_revision < 0 or p_avatar is null or p_photo is null or p_school is null or p_profile_key is null then
    raise exception 'input' using errcode = '22023';
  end if;
  insert into mtm_hw_private.student_appearance (student_id) values (v_student)
    on conflict (student_id) do nothing;
  -- CAS: khoá dòng, chỉ ghi khi revision client đang giữ còn mới nhất.
  select * into strict v_row from mtm_hw_private.student_appearance where student_id = v_student for update;
  if v_row.profile_key <> p_profile_key or v_row.revision <> p_revision then raise exception 'revision' using errcode = '40001'; end if;
  -- Ràng buộc check của bảng báo 23514 khi avatar/ảnh sai; server map về 400.
  update mtm_hw_private.student_appearance
    set revision = revision + 1, avatar = p_avatar, photo = p_photo, school = p_school, updated_at = now()
    where student_id = v_student
    returning * into v_row;
  return mtm_hw_private.appearance_json(v_row);
end $$;

revoke all on function public.mtm_btvn_appearance_read(text) from public, anon, authenticated;
revoke all on function public.mtm_btvn_appearance_save(text, integer, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.mtm_btvn_appearance_read(text) to service_role;
grant execute on function public.mtm_btvn_appearance_save(text, integer, text, text, text, uuid) to service_role;

commit;

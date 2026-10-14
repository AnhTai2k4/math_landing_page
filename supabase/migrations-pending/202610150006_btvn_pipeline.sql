-- ĐỢT 7: CHƯA ÁP CLOUD. Chạy sau 005; operator cấu hình scope, không tạo secret.
begin;
do $$begin if not exists(select 1 from pg_roles where rolname='mtm_btvn_publisher') then
 create role mtm_btvn_publisher nologin noinherit;
end if;end$$;
grant mtm_btvn_publisher to authenticator;
alter table mtm_hw_private.btvn_lessons
 add column publish_status text not null default 'cho_duyet' check(publish_status in ('cho_duyet','da_dang','loi')),
 add column source_version text,
 add column assets jsonb not null default '[]',
 add column verification jsonb,
 add column error_code text,
 add column error_reason text,
 add column updated_at timestamptz not null default clock_timestamp();
update mtm_hw_private.btvn_lessons set publish_status='da_dang' where active;
alter table mtm_hw_private.btvn_lessons add constraint btvn_publication_gate check(active=(publish_status='da_dang'));
create table mtm_hw_private.btvn_publish_scope(singleton boolean primary key default true check(singleton),owner_id uuid not null references auth.users(id),class_ids uuid[] not null check(cardinality(class_ids)>0));
alter table mtm_hw_private.btvn_publish_scope enable row level security;
revoke all on mtm_hw_private.btvn_publish_scope from public,anon,authenticated,service_role,mtm_btvn_publisher;
-- Chỉ RPC này: không SELECT bảng HS, không sửa bài làm, không ghi bảng khác.
create function public.mtm_btvn_pipeline(p_action text,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare scope mtm_hw_private.btvn_publish_scope; old mtm_hw_private.btvn_lessons;
 v_code text=p_payload->>'lesson_key'; version text=p_payload->>'source_version';
 material jsonb=p_payload->'material'; exam jsonb=p_payload->'exam'; ids uuid[]; labels text[]; n integer;
begin
 select * into scope from mtm_hw_private.btvn_publish_scope where singleton;
 if not found then raise exception 'Publisher scope missing' using errcode='42501';end if;
 if p_action is null or p_action not in ('lookup','publish','error') or v_code is null or v_code !~ '^[a-z0-9-]{1,160}$' or octet_length(p_payload::text)>1048576 then raise exception 'Payload invalid';end if;
 -- Serialise cả lookup/retry cùng lesson; publication là immutable.
 perform pg_advisory_xact_lock(hashtextextended('btvn-publish:'||v_code,0));
 select * into old from mtm_hw_private.btvn_lessons where btvn_lessons.code=v_code;
 if found and old.owner_id<>scope.owner_id then raise exception 'Outside scope' using errcode='42501';end if;
 if p_action='lookup' then return jsonb_build_object('status',old.publish_status,'source_version',old.source_version);end if;
 if old.publish_status='da_dang' then return '{"status":"already_published"}'::jsonb;end if;
 if version is null or version !~ '^[0-9a-f]{64}$' or jsonb_typeof(material) is distinct from 'object' or material->>'lessonCode' is distinct from v_code or jsonb_typeof(material->'classNames') is distinct from 'array' or jsonb_array_length(material->'classNames')=0 then raise exception 'Material invalid';end if;
 select array_agg(value) into labels from jsonb_array_elements_text(material->'classNames');
 select array_agg(id),count(*) into ids,n from mtm_hw_private.classes where label=any(labels) and active and owner_id=scope.owner_id and id=any(scope.class_ids);
 if n<>cardinality(labels) then raise exception 'Class outside scope or ambiguous' using errcode='42501';end if;
 if p_action='publish' then
  if jsonb_typeof(exam) is distinct from 'object' or exam->>'durationMinutes' is distinct from '120' or jsonb_typeof(exam->'questions') is distinct from 'array' or jsonb_array_length(exam->'questions')=0 or jsonb_typeof(p_payload->'assets') is distinct from 'array' or jsonb_array_length(p_payload->'assets')=0 or p_payload->'verification'->>'validator' is distinct from 'true' or p_payload->'verification'->>'independent' is distinct from 'true' then raise exception 'Verification required';end if;
  if exists(select 1 from jsonb_array_elements(p_payload->'assets') a where a->>'storage_path' is null or a->>'storage_path' not like 'btvn/'||v_code||'/'||version||'/%' or a->>'sha256' is null or a->>'sha256' !~ '^[0-9a-f]{64}$' or a ? 'data_base64') then raise exception 'Asset manifest invalid';end if;
 end if;
 insert into mtm_hw_private.btvn_lessons(code,owner_id,class_ids,material,exam,active,publish_status,source_version,assets,verification,error_code,error_reason)
 values(v_code,scope.owner_id,ids,material,coalesce(exam,'{}'),p_action='publish',case when p_action='publish' then 'da_dang' else 'loi' end,version,case when p_action='publish' then p_payload->'assets' else '[]' end,p_payload->'verification',case when p_action='error' then left(coalesce(p_payload->>'error_code','PIPELINE_FAILED'),80) else null end,case when p_action='error' then left(coalesce(p_payload->>'reason','Không đạt bộ kiểm'),1000) else null end)
 on conflict(code) do update set class_ids=excluded.class_ids,material=excluded.material,exam=excluded.exam,active=excluded.active,publish_status=excluded.publish_status,source_version=excluded.source_version,assets=excluded.assets,verification=excluded.verification,error_code=excluded.error_code,error_reason=excluded.error_reason,updated_at=clock_timestamp();
 return jsonb_build_object('status',case when p_action='publish' then 'da_dang' else 'loi' end);
end$$;
revoke all on function public.mtm_btvn_pipeline(text,jsonb) from public,anon,authenticated,service_role;
grant usage on schema public to mtm_btvn_publisher;
grant execute on function public.mtm_btvn_pipeline(text,jsonb) to mtm_btvn_publisher;
-- Read metadata chỉ sau kiểm session và đúng lớp; signer chạy trên server.
create function public.mtm_btvn_assets(p_session text,p_lesson text) returns jsonb language plpgsql security definer set search_path='' as $$
declare sid uuid=mtm_hw_private.btvn_student(p_session); result jsonb;begin
 select l.assets into result from mtm_hw_private.btvn_lessons l join mtm_hw_private.students s on s.id=sid where l.code=p_lesson and l.active and s.class_id=any(l.class_ids);
 if result is null then raise exception 'Lesson unavailable' using errcode='42501';end if;
 return result;
end$$;
revoke all on function public.mtm_btvn_assets(text,text) from public,anon,authenticated,mtm_btvn_publisher;
grant execute on function public.mtm_btvn_assets(text,text) to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('mtm-btvn','mtm-btvn',false,15728640,array['application/pdf','image/png']) on conflict(id) do nothing;
grant usage on schema storage to mtm_btvn_publisher;
grant select,insert on storage.objects to mtm_btvn_publisher;
-- Retry upload được đọc metadata cũ, không UPDATE/DELETE hoặc đọc bucket khác.
create policy btvn_pipeline_select on storage.objects for select to mtm_btvn_publisher using(bucket_id='mtm-btvn');
create policy btvn_pipeline_insert on storage.objects for insert to mtm_btvn_publisher with check(bucket_id='mtm-btvn' and name ~ '^btvn/[a-z0-9-]{1,160}/[0-9a-f]{64}/[a-zA-Z0-9_/-]+\.(png|pdf)$' and name !~ '(^|/)\.\.(/|$)' and (public.mtm_btvn_pipeline('lookup',jsonb_build_object('lesson_key',split_part(name,'/',2)))->>'status') is distinct from 'da_dang');
commit;

-- CHƯA ÁP DỤNG. Claude review + backup trước chạy. Không thay resolver/mã cũ.
-- Sau 202610100003/4. Toàn bộ dữ liệu riêng tư; RPC chỉ service_role/admin.
begin;
alter table mtm_hw_private.students add column student_phone text,
 add column parent_phone text, add column cohort text, add column source_identity text;
create unique index mtm_btvn_source_identity on mtm_hw_private.students(source_identity) where source_identity is not null;
create table mtm_hw_private.btvn_identity_sessions(digest bytea primary key,student_id uuid not null references mtm_hw_private.students(id),expires_at timestamptz not null,revoked_at timestamptz);
create table mtm_hw_private.btvn_limits(network_key text primary key check(network_key ~ '^[0-9a-f]{64}$'),hits integer not null,until_at timestamptz not null);
create table mtm_hw_private.btvn_lessons(code text primary key,owner_id uuid not null references auth.users(id),class_ids uuid[] not null,material jsonb not null,exam jsonb not null,active boolean not null default false);
create table mtm_hw_private.btvn_work(student_id uuid references mtm_hw_private.students(id),lesson_code text references mtm_hw_private.btvn_lessons(code),revision integer not null default 0,drafts jsonb not null default '[]',receipts jsonb not null default '[]',next_actual_class_at timestamptz,due_source_identity text,primary key(student_id,lesson_code),check(jsonb_typeof(drafts)='array' and jsonb_array_length(drafts)<=5),check(jsonb_typeof(receipts)='array'));
create table mtm_hw_private.btvn_score_files(id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id),lesson_code text references mtm_hw_private.btvn_lessons(code),private_path text not null,sha256 text not null check(sha256 ~ '^[0-9a-f]{64}$'),created_at timestamptz not null default clock_timestamp());
do $$declare t text;begin foreach t in array array['btvn_identity_sessions','btvn_limits','btvn_lessons','btvn_work','btvn_score_files'] loop execute format('alter table mtm_hw_private.%I enable row level security',t);execute format('revoke all on mtm_hw_private.%I from public,anon,authenticated,service_role',t);end loop;end$$;

create function mtm_hw_private.btvn_student(p_session text) returns uuid language plpgsql security definer set search_path='' as $$
declare sid uuid;begin
 if p_session is null or p_session !~ '^[0-9a-f]{64}$' then raise exception 'Session required' using errcode='42501';end if;
 select x.student_id into sid from mtm_hw_private.btvn_identity_sessions x join mtm_hw_private.students s on s.id=x.student_id join mtm_hw_private.classes c on c.id=s.class_id where x.digest=mtm_hw_private.token_digest('btvn-identity',p_session) and x.revoked_at is null and x.expires_at>clock_timestamp() and s.active and c.active;
 if sid is not null then return sid;end if;
 return mtm_hw_private.session_student(p_session);
end$$;
-- Chung cho resolve/forgot; tăng và trả lỗi, không raise để counter được commit.
-- API công khai chỉ trả tên lớp cấu hình đang mở; không truy vấn học sinh.
create function public.mtm_btvn_classes() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(label order by label),'[]'::jsonb) from (select distinct label from mtm_hw_private.classes where active) c
$$;
revoke all on function public.mtm_btvn_classes() from public,anon,authenticated;
grant execute on function public.mtm_btvn_classes() to service_role;

create function public.mtm_btvn_gateway_rate(p_network_key text) returns jsonb language plpgsql security definer set search_path='' as $$
declare n integer;begin
 if p_network_key is null or p_network_key !~ '^[0-9a-f]{64}$' then return '{"ok":false}'::jsonb;end if;
 insert into mtm_hw_private.btvn_limits values(p_network_key,1,clock_timestamp()+interval '15 minutes') on conflict(network_key) do update set hits=case when mtm_hw_private.btvn_limits.until_at<=clock_timestamp() then 1 else mtm_hw_private.btvn_limits.hits+1 end,until_at=case when mtm_hw_private.btvn_limits.until_at<=clock_timestamp() then clock_timestamp()+interval '15 minutes' else mtm_hw_private.btvn_limits.until_at end returning hits into n;
 return jsonb_build_object('ok',n<=5);
end$$;
create function mtm_hw_private.btvn_name(v text) returns text language sql immutable set search_path='' as $$select lower(regexp_replace(btrim(normalize(v,NFC)),'\s+',' ','g'))$$;
create function mtm_hw_private.btvn_phone(v text) returns text language sql immutable set search_path='' as $$select regexp_replace(regexp_replace(coalesce(v,''),'[^0-9]','','g'),'^84','0')$$;
create function public.mtm_btvn_forgot(p_full_name text,p_phone text,p_class_name text) returns jsonb language plpgsql security definer set search_path='' as $$
declare sid uuid;n integer;raw text;begin
 if not mtm_hw_private.valid_text(p_full_name,160) or not mtm_hw_private.valid_text(p_phone,160) or not mtm_hw_private.valid_text(p_class_name,160) or mtm_hw_private.btvn_phone(p_phone) !~ '^0[0-9]{9}$' then return '{"ok":false}'::jsonb;end if;
 select count(*),(array_agg(s.id))[1] into n,sid from mtm_hw_private.students s join mtm_hw_private.classes c on c.id=s.class_id where s.active and c.active and mtm_hw_private.btvn_name(s.full_name)=mtm_hw_private.btvn_name(p_full_name) and mtm_hw_private.btvn_name(c.label)=mtm_hw_private.btvn_name(p_class_name) and mtm_hw_private.btvn_phone(p_phone) in (mtm_hw_private.btvn_phone(s.student_phone),mtm_hw_private.btvn_phone(s.parent_phone));
 if n<>1 then return '{"ok":false}'::jsonb;end if;
 raw=mtm_hw_private.random_token();insert into mtm_hw_private.btvn_identity_sessions values(mtm_hw_private.token_digest('btvn-identity',raw),sid,clock_timestamp()+interval '4 hours',null);
 return jsonb_build_object('ok',true,'session',raw);
end$$;
-- Giữ mã hiện có kể cả khi hết hạn/thu hồi: operator quyết định cấp lại riêng.
-- Khóa dòng UUID trước kiểm mã và cấp, chống hai lượt import cấp trùng.
create function public.mtm_btvn_issue_missing_code(p_student_id uuid,p_days integer default 90) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid=mtm_hw_private.admin_id();raw text;begin
 if p_days is null or p_days not between 1 and 365 then raise exception 'Days invalid';end if;
 perform 1 from mtm_hw_private.students where id=p_student_id and owner_id=u and active for update;
 if not found then raise exception 'Student unavailable' using errcode='42501';end if;
 if exists(select 1 from mtm_hw_private.codes where student_id=p_student_id) then return '{"ok":true,"preserved":true}'::jsonb;end if;
 raw=left(encode(mtm_hw_private.token_digest('btvn-code-issue',mtm_hw_private.random_token()),'hex'),32);insert into mtm_hw_private.codes(student_id,digest,issued_by,expires_at) values(p_student_id,mtm_hw_private.token_digest('code',raw),u,clock_timestamp()+make_interval(days=>p_days));
 return jsonb_build_object('ok',true,'code','HS-'||upper(raw),'preserved',false);
end$$;
create function public.mtm_btvn_logout(p_session text) returns jsonb language plpgsql security definer set search_path='' as $$begin
 update mtm_hw_private.btvn_identity_sessions set revoked_at=clock_timestamp() where digest=mtm_hw_private.token_digest('btvn-identity',p_session);
 update mtm_hw_private.sessions set revoked_at=clock_timestamp() where digest=mtm_hw_private.token_digest('session',p_session);
 return '{"ok":true}'::jsonb;end$$;
create function public.mtm_btvn_read(p_session text,p_lesson text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare sid uuid=mtm_hw_private.btvn_student(p_session);s mtm_hw_private.students;l mtm_hw_private.btvn_lessons;w mtm_hw_private.btvn_work;cards jsonb;clabel text;begin
 select * into s from mtm_hw_private.students where id=sid;
 select label into clabel from mtm_hw_private.classes where id=s.class_id;
 select * into l from mtm_hw_private.btvn_lessons where active and s.class_id=any(class_ids) and (p_lesson is null or code=p_lesson) order by material->>'date' desc,code limit 1;
 if not found then raise exception 'Lesson unavailable' using errcode='42501';end if;
 insert into mtm_hw_private.btvn_work(student_id,lesson_code) values(sid,l.code) on conflict do nothing;
 select * into w from mtm_hw_private.btvn_work where student_id=sid and lesson_code=l.code;
 select coalesce(jsonb_agg(x.card order by x.lesson_day desc),'[]') into cards from (
 select coalesce(q.material->'classDates'->>clabel,q.material->>'date') lesson_day,q.material||jsonb_build_object('date',coalesce(q.material->'classDates'->>clabel,q.material->>'date'),'available',true,'dueAt',extract(epoch from b.next_actual_class_at)*1000,'bestScore',(select max((receipt.value->>'score')::numeric) from jsonb_array_elements(coalesce(b.receipts,'[]')) as receipt(value)),'late',best.receipt->'late','submittedAt',best.receipt->'submittedAt') card
 from mtm_hw_private.btvn_lessons q left join mtm_hw_private.btvn_work b on b.student_id=sid and b.lesson_code=q.code
 left join lateral (select receipt.value as receipt from jsonb_array_elements(coalesce(b.receipts,'[]')) as receipt(value) order by (receipt.value->>'score')::numeric desc,(receipt.value->>'submittedAt')::numeric desc limit 1)best on true where q.active and s.class_id=any(q.class_ids))x;
 return jsonb_build_object('revision',w.revision,'exam',l.exam,'material',l.material||jsonb_build_object('date',coalesce(l.material->'classDates'->>clabel,l.material->>'date')),'lessons',cards,'work',jsonb_build_object('student',jsonb_build_object('studentCode','','fullName',s.full_name,'phone','','className',clabel)||case when w.next_actual_class_at is null then '{}'::jsonb else jsonb_build_object('nextActualClassAt',extract(epoch from w.next_actual_class_at)*1000) end,'drafts',w.drafts,'receipts',w.receipts));
end$$;
-- Chỉ máy chủ tin cậy: điểm/thời gian do service tính, không nhận RPC tùy ý từ browser.
create function public.mtm_btvn_commit(p_session text,p_lesson text,p_revision integer,p_drafts jsonb,p_receipts jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare sid uuid=mtm_hw_private.btvn_student(p_session);n integer;begin
 if jsonb_typeof(p_drafts)<>'array' or jsonb_array_length(p_drafts)>5 or jsonb_typeof(p_receipts)<>'array' or octet_length(p_drafts::text)+octet_length(p_receipts::text)>524288 then raise exception 'Payload invalid';end if;
 if not exists(select 1 from mtm_hw_private.btvn_lessons l join mtm_hw_private.students s on s.id=sid where l.code=p_lesson and l.active and s.class_id=any(l.class_ids)) then raise exception 'Lesson unavailable' using errcode='42501';end if;
 update mtm_hw_private.btvn_work set drafts=p_drafts,receipts=p_receipts,revision=revision+1 where student_id=sid and lesson_code=p_lesson and revision=p_revision;
 get diagnostics n=row_count;return jsonb_build_object('ok',n=1);
end$$;
create function public.mtm_btvn_set_due(p_student_id uuid,p_lesson text,p_starts_at timestamptz,p_source_identity text) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid=mtm_hw_private.admin_id();begin
 if p_starts_at is null or p_source_identity is null or btrim(p_source_identity)='' or not exists(select 1 from mtm_hw_private.students s join mtm_hw_private.btvn_lessons l on l.code=p_lesson where s.id=p_student_id and s.owner_id=u and l.owner_id=u and s.class_id=any(l.class_ids)) then raise exception 'Verified source required' using errcode='42501';end if;
 insert into mtm_hw_private.btvn_work(student_id,lesson_code,next_actual_class_at,due_source_identity) values(p_student_id,p_lesson,p_starts_at,p_source_identity) on conflict(student_id,lesson_code) do update set next_actual_class_at=p_starts_at,due_source_identity=p_source_identity,revision=mtm_hw_private.btvn_work.revision+1;
 update mtm_hw_private.btvn_work set receipts=(select coalesce(jsonb_agg(r||jsonb_build_object('late',(r->>'submittedAt')::numeric>=extract(epoch from p_starts_at)*1000)),'[]') from jsonb_array_elements(receipts)r) where student_id=p_student_id and lesson_code=p_lesson;
 return '{"ok":true}'::jsonb;
end$$;
create function public.mtm_btvn_admin_scores(p_lesson text) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid=mtm_hw_private.admin_id();out_rows jsonb;begin
 if not exists(select 1 from mtm_hw_private.btvn_lessons where code=p_lesson and owner_id=u) then raise exception 'Lesson unavailable' using errcode='42501';end if;
 select coalesce(jsonb_agg(jsonb_build_object('student',jsonb_build_object('studentCode',s.id,'fullName',s.full_name,'phone','','className',c.label)||case when w.next_actual_class_at is null then '{}'::jsonb else jsonb_build_object('nextActualClassAt',extract(epoch from w.next_actual_class_at)*1000) end,'drafts',w.drafts,'receipts',w.receipts)),'[]') into out_rows from mtm_hw_private.btvn_work w join mtm_hw_private.students s on s.id=w.student_id join mtm_hw_private.classes c on c.id=s.class_id where w.lesson_code=p_lesson and s.owner_id=u;
 return out_rows;
end$$;
revoke all on function mtm_hw_private.btvn_student(text),mtm_hw_private.btvn_name(text),mtm_hw_private.btvn_phone(text) from public,anon,authenticated,service_role;
revoke all on function public.mtm_btvn_gateway_rate(text),public.mtm_btvn_forgot(text,text,text),public.mtm_btvn_logout(text),public.mtm_btvn_read(text,text),public.mtm_btvn_commit(text,text,integer,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.mtm_btvn_gateway_rate(text),public.mtm_btvn_forgot(text,text,text),public.mtm_btvn_logout(text),public.mtm_btvn_read(text,text),public.mtm_btvn_commit(text,text,integer,jsonb,jsonb) to service_role;
revoke all on function public.mtm_btvn_issue_missing_code(uuid,integer),public.mtm_btvn_set_due(uuid,text,timestamptz,text) from public,anon,service_role;
grant execute on function public.mtm_btvn_issue_missing_code(uuid,integer),public.mtm_btvn_set_due(uuid,text,timestamptz,text) to authenticated;
revoke all on function public.mtm_btvn_admin_scores(text) from public,anon,service_role;
grant execute on function public.mtm_btvn_admin_scores(text) to authenticated;
commit;

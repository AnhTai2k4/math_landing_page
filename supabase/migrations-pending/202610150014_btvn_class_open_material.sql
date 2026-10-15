-- Đợt 18, CHƯA ÁP DỤNG. Gốc read/commit/pipeline: wrapper 013; leaderboard: hotfix 013_1.
begin;
create function mtm_hw_private.btvn_opens_at(p_material jsonb,p_label text) returns timestamptz
language sql stable set search_path='' as $$
 select coalesce((p_material->'classOpensAt'->>p_label)::timestamptz,
   ((coalesce(p_material->'classDates'->>p_label,p_material->>'date')::date+time '21:30') at time zone 'Asia/Ho_Chi_Minh'))
$$;
-- Chỉ giữ trường thông tin thẻ đã cho phép, không để URL/ảnh đề lọt qua material tùy ý.
create function mtm_hw_private.btvn_locked_card(p_card jsonb) returns jsonb
language sql immutable set search_path='' as $$
 select coalesce(jsonb_object_agg(key,value),'{}')||jsonb_build_object('available',false)
 from jsonb_each(p_card) where key=any(array['lessonCode','title','homeworkTitle','date','classNames','classDates','classOpensAt','videoId','videoUrl','homeworkNote','opensAt','kind','closesAt','expectedDueAt','dueAt'])
$$;
alter function public.mtm_btvn_read(text,text) rename to mtm_btvn_read_before_class_open;
create function public.mtm_btvn_read(p_session text,p_lesson text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare sid uuid=mtm_hw_private.btvn_student(p_session);label text;result jsonb;cards jsonb;opens timestamptz;now_at timestamptz=clock_timestamp();
begin
 select c.label into label from mtm_hw_private.students s join mtm_hw_private.classes c on c.id=s.class_id where s.id=sid;
 result=public.mtm_btvn_read_before_class_open(p_session,p_lesson);
 select coalesce(jsonb_agg(case when q.kind='btvn' then
  case when now_at<mtm_hw_private.btvn_opens_at(q.material,label) then mtm_hw_private.btvn_locked_card(card||jsonb_build_object('opensAt',extract(epoch from mtm_hw_private.btvn_opens_at(q.material,label))*1000))
  else card||jsonb_build_object('opensAt',extract(epoch from mtm_hw_private.btvn_opens_at(q.material,label))*1000) end
  else card end order by ord),'[]') into cards
 from jsonb_array_elements(result->'lessons') with ordinality a(card,ord) left join mtm_hw_private.btvn_lessons q on q.code=card->>'lessonCode';
 result=jsonb_set(result,'{lessons}',cards);
 -- Cùng lựa chọn bài với hàm gốc; không dựa vào lessonCode bên trong JSON có thể thiếu ở dữ liệu cũ.
 select case when l.kind='btvn' then mtm_hw_private.btvn_opens_at(l.material,label) end into opens
 from mtm_hw_private.btvn_lessons l join mtm_hw_private.students s on s.id=sid
 where l.active and s.class_id=any(l.class_ids) and (p_lesson is null or l.code=p_lesson)
 order by l.material->>'date' desc,l.code limit 1;
 if opens is not null then
  result=jsonb_set(result,'{material}',result->'material'||jsonb_build_object('opensAt',extract(epoch from opens)*1000));
  if now_at<opens then
   result=(result-'exam')||jsonb_build_object('material',mtm_hw_private.btvn_locked_card(result->'material'));
   result=jsonb_set(result,'{work,drafts}','[]');result=jsonb_set(result,'{work,receipts}','[]');
  end if;
 end if;
 return result;
end$$;
alter function public.mtm_btvn_commit(text,text,integer,jsonb,jsonb) rename to mtm_btvn_commit_before_class_open;
create function public.mtm_btvn_commit(p_session text,p_lesson text,p_revision integer,p_drafts jsonb,p_receipts jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare sid uuid=mtm_hw_private.btvn_student(p_session);
begin
 if exists(select 1 from mtm_hw_private.btvn_lessons l join mtm_hw_private.students s on s.id=sid join mtm_hw_private.classes c on c.id=s.class_id
  where l.code=p_lesson and l.kind='btvn' and clock_timestamp()<mtm_hw_private.btvn_opens_at(l.material,c.label)) then
  raise exception 'Homework opens after class' using errcode='42501';
 end if;
 return public.mtm_btvn_commit_before_class_open(p_session,p_lesson,p_revision,p_drafts,p_receipts);
end$$;
create or replace function public.mtm_btvn_assets(p_session text,p_lesson text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare sid uuid=mtm_hw_private.btvn_student(p_session);result jsonb;
begin
 select l.assets into result from mtm_hw_private.btvn_lessons l join mtm_hw_private.students s on s.id=sid join mtm_hw_private.classes c on c.id=s.class_id
 where l.code=p_lesson and l.active and s.class_id=any(l.class_ids) and (l.kind<>'btvn' or clock_timestamp()>=mtm_hw_private.btvn_opens_at(l.material,c.label));
 if result is null then raise exception 'Lesson unavailable' using errcode='42501';end if;
 return result;
end$$;
create table mtm_hw_private.btvn_material_history(
 id bigint generated always as identity primary key,lesson_code text not null references mtm_hw_private.btvn_lessons(code),
 changed_at timestamptz not null default clock_timestamp(),before_material jsonb not null,after_material jsonb not null);
alter table mtm_hw_private.btvn_material_history enable row level security;
revoke all on mtm_hw_private.btvn_material_history from public,anon,authenticated,service_role,mtm_btvn_publisher;
alter function public.mtm_btvn_pipeline(text,jsonb) rename to mtm_btvn_pipeline_before_class_open;
create function public.mtm_btvn_pipeline(p_action text,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare scope mtm_hw_private.btvn_publish_scope;l mtm_hw_private.btvn_lessons;patch jsonb=p_payload->'material';k text;v jsonb;result jsonb;
begin
 if p_action is distinct from 'update_material' then return public.mtm_btvn_pipeline_before_class_open(p_action,p_payload);end if;
 if p_payload is null or octet_length(p_payload::text)>1048576 or coalesce(p_payload->>'lesson_key','')!~'^[a-z0-9-]{1,160}$'
  or jsonb_typeof(patch) is distinct from 'object' or patch='{}' or exists(select 1 from jsonb_object_keys(p_payload) x where x not in ('lesson_key','material')) then raise exception 'Invalid material update';end if;
 select * into scope from mtm_hw_private.btvn_publish_scope where singleton;
 if not found then raise exception 'Publisher scope missing' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('btvn-publish:'||(p_payload->>'lesson_key'),0));
 select * into l from mtm_hw_private.btvn_lessons where code=p_payload->>'lesson_key' for update;
 if not found or not l.active or l.publish_status<>'da_dang' then raise exception 'Published lesson required';end if;
 if l.owner_id<>scope.owner_id or not l.class_ids<@scope.class_ids or exists(select 1 from unnest(l.class_ids) x(class_id) left join mtm_hw_private.classes c on c.id=x.class_id where c.id is null or not c.active or c.owner_id<>scope.owner_id) then raise exception 'Outside scope' using errcode='42501';end if;
 for k,v in select * from jsonb_each(patch) loop
  if k not in ('videoId','videoUrl','materialUrl','handoutUrl','homeworkNote','title','classOpensAt') then raise exception 'Field not allowed';end if;
  if k='classOpensAt' then
   if jsonb_typeof(v) is distinct from 'object' or v='{}' then raise exception 'Invalid opening map';end if;
   if exists(select 1 from jsonb_each(v) a where not exists(select 1 from mtm_hw_private.classes c where c.id=any(l.class_ids) and c.label=a.key)
    or jsonb_typeof(a.value) is distinct from 'string' or (a.value#>>'{}')!~'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$') then raise exception 'Invalid class opening timestamp';end if;
   perform (value#>>'{}')::timestamptz from jsonb_each(v);
  else
   if v='null'::jsonb and k in ('videoId','videoUrl','materialUrl','handoutUrl') then continue;end if;
   if jsonb_typeof(v) is distinct from 'string' then raise exception 'Invalid material text';end if;
   if (k='videoId' and (v#>>'{}')!~'^[A-Za-z0-9_-]{11}$')
    or (k in ('videoUrl','materialUrl','handoutUrl') and (length(v#>>'{}')>4096 or (v#>>'{}')!~'^https://[^\s/@?#]+([/?#][^\s]*)?$'))
    or (k='title' and (length(v#>>'{}')>300 or btrim(v#>>'{}')=''))
    or (k='homeworkNote' and length(v#>>'{}')>2000) then raise exception 'Invalid material value';end if;
  end if;
 end loop;
 -- Bổ sung riêng từng lớp phải giữ giờ của các lớp còn lại.
 if patch ? 'classOpensAt' then patch=jsonb_set(patch,'{classOpensAt}',coalesce(l.material->'classOpensAt','{}')||(patch->'classOpensAt'));end if;
 result=l.material||patch;
 if result is distinct from l.material then
  insert into mtm_hw_private.btvn_material_history(lesson_code,before_material,after_material) values(l.code,l.material,result);
  update mtm_hw_private.btvn_lessons set material=result,updated_at=clock_timestamp() where code=l.code;
 end if;
 return jsonb_build_object('status','updated','changed',result is distinct from l.material,'material',result);
end$$;
revoke all on function mtm_hw_private.btvn_opens_at(jsonb,text),mtm_hw_private.btvn_locked_card(jsonb),public.mtm_btvn_read_before_class_open(text,text),public.mtm_btvn_commit_before_class_open(text,text,integer,jsonb,jsonb),public.mtm_btvn_pipeline_before_class_open(text,jsonb) from public,anon,authenticated,service_role,mtm_btvn_publisher;
revoke all on function public.mtm_btvn_read(text,text),public.mtm_btvn_commit(text,text,integer,jsonb,jsonb),public.mtm_btvn_pipeline(text,jsonb) from public,anon,authenticated,service_role,mtm_btvn_publisher;
grant execute on function public.mtm_btvn_read(text,text),public.mtm_btvn_commit(text,text,integer,jsonb,jsonb) to service_role;
grant execute on function public.mtm_btvn_pipeline(text,jsonb) to mtm_btvn_publisher;
drop policy btvn_pipeline_insert on storage.objects;
create policy btvn_pipeline_insert on storage.objects for insert to mtm_btvn_publisher with check(bucket_id='mtm-btvn' and name ~ '^btvn/[a-z0-9-]{1,160}/[0-9a-f]{64}/[a-zA-Z0-9_/-]+\.(png|pdf)$' and name !~ '(^|/)\.\.(/|$)' and (public.mtm_btvn_pipeline('lookup',jsonb_build_object('lesson_key',split_part(name,'/',2)))->>'status') is distinct from 'da_dang');
-- Xếp hạng giữ hotfix 013_1, loại bài chưa mở theo lớp khỏi mẫu số.
create or replace function public.mtm_btvn_leaderboard(p_cohort text,p_kind text,p_period text default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare d date;lo date;hi date;out_rows jsonb;
begin
 if p_cohort is null or p_cohort not in ('2K9','2K10','2K11','2K12','2K13','2K14') or p_kind is null or p_kind not in ('btvn-tuan','btvn-thang','kiem-tra-thang') then raise exception 'Invalid rank request';end if;
 if p_period is null then d=(current_timestamp at time zone 'Asia/Ho_Chi_Minh')::date;
 elsif p_kind='btvn-tuan' and p_period~'^\d{4}-\d{2}-\d{2}$' then d=p_period::date;
 elsif p_kind<>'btvn-tuan' and p_period~'^\d{4}-\d{2}$' then d=(p_period||'-01')::date;
 else raise exception 'Invalid rank period';end if;
 lo=case when p_kind='btvn-tuan' then date_trunc('week',d::timestamp)::date else date_trunc('month',d::timestamp)::date end;
 hi=case when p_kind='btvn-tuan' then lo+7 else (lo+interval '1 month')::date end;
 if p_period is not null and p_kind='btvn-tuan' and d<>lo then raise exception 'Week must start Monday';end if;
 with eligible as (
  select s.id,s.full_name,c.label,s.owner_id,s.class_id from mtm_hw_private.students s join mtm_hw_private.classes c on c.id=s.class_id
  join mtm_hw_private.btvn_roster_scope scope on scope.singleton and scope.owner_id=s.owner_id
  where s.active and c.active and coalesce(s.source_identity,'') not like 'qa:%' and upper(substring(c.label from '^[^ ]+'))=p_cohort
 ), assigned as (
  select s.*,l.code,l.kind,coalesce(l.material->'classDates'->>s.label,l.material->>'date')::date lesson_day
  from eligible s join mtm_hw_private.btvn_lessons l on l.owner_id=s.owner_id and l.active and s.class_id=any(l.class_ids)
  where l.kind<>'btvn' or current_timestamp>=mtm_hw_private.btvn_opens_at(l.material,s.label)
 ), scored as (
  select a.*,best.score,best.at from assigned a
  left join mtm_hw_private.btvn_work w on w.student_id=a.id and w.lesson_code=a.code
  left join lateral (select (r->>'score')::numeric score,(r->>'submittedAt')::numeric at from jsonb_array_elements(coalesce(w.receipts,'[]')) r
    where (r->>'submittedAt')::numeric>=extract(epoch from '2026-10-15 00:00:00+07'::timestamptz)*1000
    and not exists(select 1 from mtm_hw_private.btvn_rank_exclusions e where e.student_id=a.id and e.lesson_code=a.code)
    order by (r->>'score')::numeric desc,(r->>'submittedAt')::numeric asc limit 1) best on true
  where a.lesson_day>=greatest(lo,'2026-10-15'::date) and a.lesson_day<hi
 ), homework as (
  select id,full_name,label,avg(coalesce(score,0)) score,count(score)::integer submitted,count(*)::integer total,max(at) at
  from scored where kind='btvn' group by id,full_name,label having count(score)>0
 ), web as (
  -- Một bài kiểm tra cuối tháng mỗi lớp; nếu operator đăng nhiều bài, lấy bài có ngày học cuối cùng.
  select distinct on(id) id,score,at from scored where kind='kiem-tra-thang' and score is not null order by id,lesson_day desc,code
 ), monthly as (
  select s.id,s.full_name,s.label,coalesce(w.score,p.score) score,1 submitted,1 total,w.at from eligible s
  left join web w on w.id=s.id left join mtm_hw_private.btvn_monthly_scores p on p.student_id=s.id and p.month=lo
  where hi>'2026-10-15'::date and coalesce(w.score,p.score) is not null
 ), ranked as (
  select row_number() over(order by score desc,submitted desc,at asc nulls last,id) rank,full_name,label,score,submitted,total
  from (select * from homework where p_kind<>'kiem-tra-thang' union all select * from monthly where p_kind='kiem-tra-thang') x
 ) select coalesce(jsonb_agg(jsonb_build_object('rank',rank,'fullName',btrim(regexp_replace(full_name,'\s*[\(\[].*$','')),'className',label,'score',round(score,2),'submitted',submitted,'total',total) order by rank),'[]') into out_rows from ranked where rank<=10;
 return out_rows;
end$$;


commit;

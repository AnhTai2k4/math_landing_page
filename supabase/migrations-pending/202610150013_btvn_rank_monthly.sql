-- Đợt 15, CHƯA ÁP DỤNG. Sau 012 và các hotfix 011_1/011_2.
-- Gốc: read = 011, commit = 005, pipeline = 006. Giữ nguyên chúng dưới tên *_before_rank.
begin;
alter table mtm_hw_private.btvn_lessons add column kind text not null default 'btvn' check(kind in ('btvn','kiem-tra-thang'));
alter table mtm_hw_private.btvn_lessons add column opens_at timestamptz, add column closes_at timestamptz;
alter table mtm_hw_private.btvn_lessons add constraint monthly_window check(kind='btvn' or (opens_at is not null and closes_at is not null and closes_at>opens_at));
create table mtm_hw_private.btvn_rank_exclusions(student_id uuid references mtm_hw_private.students(id),lesson_code text references mtm_hw_private.btvn_lessons(code),reason text not null check(length(btrim(reason))>0),primary key(student_id,lesson_code));
create table mtm_hw_private.btvn_monthly_scores(student_id uuid references mtm_hw_private.students(id),month date not null check(extract(day from month)=1 and month>='2026-10-01'),score numeric not null check(score between 0 and 10),primary key(student_id,month));
alter table mtm_hw_private.btvn_rank_exclusions enable row level security;
alter table mtm_hw_private.btvn_monthly_scores enable row level security;
revoke all on mtm_hw_private.btvn_rank_exclusions,mtm_hw_private.btvn_monthly_scores from public,anon,authenticated,service_role,mtm_btvn_publisher;

-- p_period: ngày thứ Hai YYYY-MM-DD cho tuần, YYYY-MM cho tháng. NULL = kỳ hiện tại giờ VN.
create function public.mtm_btvn_leaderboard(p_cohort text,p_kind text,p_period text default null) returns jsonb
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
  from scored where kind='btvn' group by id,full_name,label
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
 ) select coalesce(jsonb_agg(jsonb_build_object('rank',rank,'fullName',full_name,'className',label,'score',round(score,2),'submitted',submitted,'total',total) order by rank),'[]') into out_rows from ranked where rank<=10;
 return out_rows;
end$$;

-- Payload: {rows:[{className,fullName,phone,month:"mm/yyyy",score}]}. Chỉ số tổng hợp, không PII.
create function public.mtm_btvn_sync_monthly(p_payload jsonb,p_apply boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
declare owner uuid;r jsonb;ids uuid[];sid uuid;n integer;m date;v numeric;matched integer=0;unmatched integer=0;warnings integer=0;seen text[]='{}';summary jsonb;
begin
 if p_apply is null or jsonb_typeof(p_payload->'rows') is distinct from 'array' or octet_length(p_payload::text)>10485760 then raise exception 'Invalid monthly payload';end if;
 select owner_id into owner from mtm_hw_private.btvn_roster_scope where singleton;
 if owner is null then raise exception 'Roster scope required' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('btvn-monthly:'||owner::text,0));
 begin
 for r in select value from jsonb_array_elements(p_payload->'rows') loop
  if coalesce(r->>'month','')!~'^(0[1-9]|1[0-2])/20[0-9]{2}$' or jsonb_typeof(r->'score') is distinct from 'number' or coalesce(r->>'phone','')!~'^0[0-9]{9}$' or not exists(select 1 from mtm_hw_private.classes where owner_id=owner and active and label=r->>'className') then raise exception 'Invalid monthly row';end if;
  m=to_date('01/'||(r->>'month'),'DD/MM/YYYY');v=(r->>'score')::numeric;
  if m<'2026-10-01' or v not between 0 and 10 then raise exception 'Invalid monthly score or cutoff';end if;
  select array_agg(s.id) into ids from mtm_hw_private.students s join mtm_hw_private.classes c on c.id=s.class_id where s.owner_id=owner and s.active and c.active and coalesce(s.source_identity,'') not like 'qa:%'
   and substring(lower(c.label) from '^2k[0-9]+')=substring(lower(r->>'className') from '^2k[0-9]+')
   and r->>'phone' in (mtm_hw_private.btvn_phone(s.student_phone),mtm_hw_private.btvn_phone(s.parent_phone));
  n=coalesce(cardinality(ids),0);sid=null;
  if n=1 then sid=ids[1];elsif n>1 then
   -- Giống hotfix sync_due 011_2: ưu tiên hồ sơ đúng lớp, rồi mới dùng tên phân xử.
   select count(*),(array_agg(s.id))[1] into n,sid from mtm_hw_private.students s join mtm_hw_private.classes c on c.id=s.class_id where s.id=any(ids) and c.label=r->>'className';
   if n<>1 then
    select count(*),(array_agg(id))[1] into n,sid from mtm_hw_private.students where id=any(ids) and mtm_hw_private.btvn_name(full_name)=mtm_hw_private.btvn_name(regexp_replace(r->>'fullName','\s*\(.*$',''));
    if n<>1 then sid=null;end if;
   end if;
  end if;
  if sid is null then unmatched=unmatched+1;continue;end if;
  if sid::text||':'||m::text=any(seen) then raise exception 'Duplicate student month';end if;
  seen=array_append(seen,sid::text||':'||m::text);
  insert into mtm_hw_private.btvn_monthly_scores values(sid,m,v) on conflict(student_id,month) do update set score=excluded.score;
  matched=matched+1;
  if exists(select 1 from mtm_hw_private.btvn_work w join mtm_hw_private.btvn_lessons l on l.code=w.lesson_code join mtm_hw_private.students s on s.id=sid join mtm_hw_private.classes c on c.id=s.class_id
   where w.student_id=sid and l.owner_id=owner and l.active and l.kind='kiem-tra-thang' and s.class_id=any(l.class_ids)
   and coalesce(l.material->'classDates'->>c.label,l.material->>'date')::date>=greatest(m,'2026-10-15'::date)
   and coalesce(l.material->'classDates'->>c.label,l.material->>'date')::date<(m+interval '1 month')::date
   and not exists(select 1 from mtm_hw_private.btvn_rank_exclusions e where e.student_id=sid and e.lesson_code=l.code)
   and exists(select 1 from jsonb_array_elements(w.receipts) x where (x->>'submittedAt')::numeric>=extract(epoch from '2026-10-15 00:00+07'::timestamptz)*1000)) then warnings=warnings+1;end if;
 end loop;
 summary=jsonb_build_object('applied',p_apply,'matched',matched,'unmatched',unmatched,'webOverrides',warnings);
 if not p_apply then raise exception 'MONTHLY_DRY_RUN' using errcode='P0015';end if;
 exception when sqlstate 'P0015' then null;end;
 return summary;
end$$;

-- Bao hàm gốc giữ hành vi cũ; không mở quyền gọi bản gốc.
alter function public.mtm_btvn_pipeline(text,jsonb) rename to mtm_btvn_pipeline_before_rank;
create function public.mtm_btvn_pipeline(p_action text,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare k text=coalesce(p_payload->>'kind','btvn');o timestamptz;c timestamptz;result jsonb;
begin
 if k not in ('btvn','kiem-tra-thang') then raise exception 'Invalid lesson kind';end if;
 if p_action='publish' and k='kiem-tra-thang' then
  o=(p_payload->>'opensAt')::timestamptz;c=(p_payload->>'closesAt')::timestamptz;
  if o is null or c is null or c<=o or (o at time zone 'Asia/Ho_Chi_Minh')::date<'2026-10-15' then raise exception 'Monthly window required';end if;
 end if;
 result=public.mtm_btvn_pipeline_before_rank(p_action,p_payload);
 if result->>'status'='da_dang' and p_action='publish' then
  update mtm_hw_private.btvn_lessons set kind=k,opens_at=o,closes_at=c where code=p_payload->>'lesson_key';
 end if;
 return result;
end$$;
alter function public.mtm_btvn_read(text,text) rename to mtm_btvn_read_before_rank;
create function public.mtm_btvn_read(p_session text,p_lesson text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;l mtm_hw_private.btvn_lessons;cards jsonb;
begin
 result=public.mtm_btvn_read_before_rank(p_session,p_lesson);
 select * into l from mtm_hw_private.btvn_lessons where code=result->'material'->>'lessonCode';
 if l.kind='kiem-tra-thang' then result=jsonb_set(result,'{material}',result->'material'||jsonb_build_object('kind',l.kind,'opensAt',extract(epoch from l.opens_at)*1000,'closesAt',extract(epoch from l.closes_at)*1000));end if;
 select coalesce(jsonb_agg(card||case when q.kind='kiem-tra-thang' then jsonb_build_object('kind',q.kind,'opensAt',extract(epoch from q.opens_at)*1000,'closesAt',extract(epoch from q.closes_at)*1000) else '{}'::jsonb end order by ord),'[]') into cards from jsonb_array_elements(result->'lessons') with ordinality a(card,ord) left join mtm_hw_private.btvn_lessons q on q.code=card->>'lessonCode';
 result=jsonb_set(result,'{lessons}',cards);
 return result;
end$$;
alter function public.mtm_btvn_commit(text,text,integer,jsonb,jsonb) rename to mtm_btvn_commit_before_rank;
create function public.mtm_btvn_commit(p_session text,p_lesson text,p_revision integer,p_drafts jsonb,p_receipts jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare sid uuid=mtm_hw_private.btvn_student(p_session);l mtm_hw_private.btvn_lessons;w mtm_hw_private.btvn_work;
begin
 select * into l from mtm_hw_private.btvn_lessons where code=p_lesson;
 if l.kind='kiem-tra-thang' then
  select * into w from mtm_hw_private.btvn_work where student_id=sid and lesson_code=p_lesson for update;
  if jsonb_array_length(p_drafts)>1 or jsonb_array_length(p_receipts)>1 or clock_timestamp()<l.opens_at
   or (jsonb_array_length(w.drafts)=0 and clock_timestamp()>=l.closes_at)
   or (jsonb_array_length(w.receipts)>0 and (p_drafts<>w.drafts or p_receipts<>w.receipts)) then raise exception 'Monthly attempt unavailable' using errcode='42501';end if;
 end if;
 return public.mtm_btvn_commit_before_rank(p_session,p_lesson,p_revision,p_drafts,p_receipts);
end$$;
revoke all on function public.mtm_btvn_pipeline_before_rank(text,jsonb),public.mtm_btvn_read_before_rank(text,text),public.mtm_btvn_commit_before_rank(text,text,integer,jsonb,jsonb) from public,anon,authenticated,service_role,mtm_btvn_publisher;
revoke all on function public.mtm_btvn_leaderboard(text,text,text),public.mtm_btvn_sync_monthly(jsonb,boolean),public.mtm_btvn_read(text,text),public.mtm_btvn_commit(text,text,integer,jsonb,jsonb),public.mtm_btvn_pipeline(text,jsonb) from public,anon,authenticated,mtm_btvn_publisher;
grant execute on function public.mtm_btvn_leaderboard(text,text,text),public.mtm_btvn_sync_monthly(jsonb,boolean),public.mtm_btvn_read(text,text),public.mtm_btvn_commit(text,text,integer,jsonb,jsonb) to service_role;
grant execute on function public.mtm_btvn_pipeline(text,jsonb) to mtm_btvn_publisher;
-- Policy lưu OID của hàm trước khi rename, phải trỏ lại wrapper mới.
drop policy btvn_pipeline_insert on storage.objects;
create policy btvn_pipeline_insert on storage.objects for insert to mtm_btvn_publisher with check(bucket_id='mtm-btvn' and name ~ '^btvn/[a-z0-9-]{1,160}/[0-9a-f]{64}/[a-zA-Z0-9_/-]+\.(png|pdf)$' and name !~ '(^|/)\.\.(/|$)' and (public.mtm_btvn_pipeline('lookup',jsonb_build_object('lesson_key',split_part(name,'/',2)))->>'status') is distinct from 'da_dang');
commit;

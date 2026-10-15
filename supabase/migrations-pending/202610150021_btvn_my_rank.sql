-- Dot 24. CHUA AP DUNG. Chi session cua chinh em duoc lay hang ngoai top 10.
begin;
create or replace function mtm_hw_private.btvn_rank_rows(p_cohort text,p_kind text,p_period text,p_class text,p_student uuid) returns jsonb
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
  where s.active and c.active and coalesce(s.source_identity,'') not like 'qa:%' and upper(substring(c.label from '^[^ ]+'))=p_cohort and (p_class is null or c.label=p_class)
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
  select row_number() over(order by score desc,submitted desc,at asc nulls last,id) rank,id,full_name,label,score,submitted,total
  from (select * from homework where p_kind<>'kiem-tra-thang' union all select * from monthly where p_kind='kiem-tra-thang') x
 ) select coalesce(jsonb_agg(jsonb_build_object('rank',rank,'fullName',btrim(regexp_replace(full_name,'\s*[\(\[].*$','')),'className',label,'score',round(score,2),'submitted',submitted,'total',total) order by rank),'[]') into out_rows from ranked where (p_student is null and rank<=10) or id=p_student;
 return out_rows;
end$$;
create or replace function public.mtm_btvn_leaderboard(p_cohort text,p_kind text,p_period text default null) returns jsonb
language sql stable security definer set search_path='' as $$select mtm_hw_private.btvn_rank_rows(p_cohort,p_kind,p_period,null,null)$$;
create function public.mtm_btvn_leaderboard_class(p_cohort text,p_kind text,p_class text default null) returns jsonb
language sql stable security definer set search_path='' as $$select mtm_hw_private.btvn_rank_rows(p_cohort,p_kind,null,p_class,null)$$;
create function public.mtm_btvn_my_rank(p_session text,p_cohort text,p_kind text,p_class text default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare sid uuid=mtm_hw_private.btvn_student(p_session); rows jsonb;
begin
 rows=mtm_hw_private.btvn_rank_rows(p_cohort,p_kind,null,p_class,sid);
 return rows->0;
end$$;
revoke all on function mtm_hw_private.btvn_rank_rows(text,text,text,text,uuid) from public,anon,authenticated,service_role,mtm_btvn_publisher;
revoke all on function public.mtm_btvn_leaderboard_class(text,text,text),public.mtm_btvn_my_rank(text,text,text,text) from public,anon,authenticated,mtm_btvn_publisher;
grant execute on function public.mtm_btvn_leaderboard_class(text,text,text),public.mtm_btvn_my_rank(text,text,text,text) to service_role;
commit;

-- ĐÃ ÁP lên Supabase 17/10 21:35 (Claude).
-- 027 (17/10 21:30, anh Thành báo nộp BTVN xong không lên bảng xếp hạng): BTVN đã nộp tính vào tuần/tháng của lần nộp có điểm cao nhất; chưa nộp thì theo HẠN NỘP (giờ VN); không theo ngày học. Kiểm tra tháng giữ theo ngày học.
begin;
CREATE OR REPLACE FUNCTION mtm_hw_private.btvn_rank_rows(p_cohort text, p_kind text, p_period text, p_class text, p_student uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  select s.*,l.code,l.kind,l.closes_at,coalesce(l.material->'classDates'->>s.label,l.material->>'date')::date lesson_day
  from eligible s join mtm_hw_private.btvn_lessons l on l.owner_id=s.owner_id and l.active and s.class_id=any(l.class_ids)
  where l.kind<>'btvn' or current_timestamp>=mtm_hw_private.btvn_opens_at(l.material,s.label)
 ), scored as (
  select a.*,best.score,best.at,coalesce(w.next_actual_class_at,w.expected_due_at,mtm_hw_private.btvn_planned_due(a.label,a.lesson_day)) due_at,
   exists(select 1 from mtm_hw_private.btvn_official_receipts(a.id,a.code) r where r.submitted_at>=extract(epoch from '2026-10-15 00:00:00+07'::timestamptz)*1000
    and not exists(select 1 from mtm_hw_private.btvn_rank_exclusions e where e.student_id=a.id and e.lesson_code=a.code)) has_receipt
  from assigned a left join mtm_hw_private.btvn_work w on w.student_id=a.id and w.lesson_code=a.code
  left join lateral (select r.score,r.submitted_at at from mtm_hw_private.btvn_official_receipts(a.id,a.code) r
   where r.score is not null and r.submitted_at>=extract(epoch from '2026-10-15 00:00:00+07'::timestamptz)*1000
    and not exists(select 1 from mtm_hw_private.btvn_rank_exclusions e where e.student_id=a.id and e.lesson_code=a.code)
   order by r.score desc,r.submitted_at asc limit 1) best on true
  where (case when a.kind='btvn' then coalesce((to_timestamp(best.at/1000) at time zone 'Asia/Ho_Chi_Minh')::date,(coalesce(w.next_actual_class_at,w.expected_due_at,mtm_hw_private.btvn_planned_due(a.label,a.lesson_day)) at time zone 'Asia/Ho_Chi_Minh')::date,a.lesson_day) else a.lesson_day end)>=greatest(lo,'2026-10-15'::date) and (case when a.kind='btvn' then coalesce((to_timestamp(best.at/1000) at time zone 'Asia/Ho_Chi_Minh')::date,(coalesce(w.next_actual_class_at,w.expected_due_at,mtm_hw_private.btvn_planned_due(a.label,a.lesson_day)) at time zone 'Asia/Ho_Chi_Minh')::date,a.lesson_day) else a.lesson_day end)<hi
 ), homework as (
  select id,full_name,label,avg(coalesce(score,0)) score,count(score)::integer submitted,count(*)::integer total,max(at) at
  from scored where kind='btvn' and (score is not null or (not has_receipt and (due_at is null or due_at<=current_timestamp)))
  group by id,full_name,label having count(score)>0
 ), web as (
  select distinct on(id) id,score,at from scored where kind='kiem-tra-thang' and closes_at<=current_timestamp and score is not null order by id,lesson_day desc,code
 ), monthly as (
  select s.id,s.full_name,s.label,coalesce(w.score,p.score) score,1 submitted,1 total,w.at from eligible s
  left join web w on w.id=s.id left join mtm_hw_private.btvn_monthly_scores p on p.student_id=s.id and p.month=lo
  where hi>'2026-10-15'::date and coalesce(w.score,p.score) is not null
 ), ranked as (
  select row_number() over(order by score desc,submitted desc,at asc nulls last,id) rank,id,full_name,label,score,submitted,total
  from (select * from homework where p_kind<>'kiem-tra-thang' union all select * from monthly where p_kind='kiem-tra-thang') x
 ) select coalesce(jsonb_agg(jsonb_build_object(
  'rank',r.rank,'fullName',btrim(regexp_replace(r.full_name,'\s*[\(\[].*$','')),'className',r.label,
  'school',coalesce(mtm_hw_private.public_school(a.school),mtm_hw_private.public_school(s.school)),
  'avatar',coalesce(a.avatar,'orbit'),
  'photo',case when not coalesce(a.photo_hidden,false) and a.photo<>'' and mtm_hw_private.valid_public_photo(a.photo) then a.photo else null end,
  'score',round(r.score,2),'submitted',r.submitted,'total',r.total) order by r.rank),'[]') into out_rows
 from ranked r join mtm_hw_private.students s on s.id=r.id left join mtm_hw_private.student_appearance a on a.student_id=r.id
 where (p_student is null and r.rank<=10) or r.id=p_student;
 return out_rows;
end$function$;
revoke all on function mtm_hw_private.btvn_rank_rows(text,text,text,text,uuid) from public,anon,authenticated,service_role,mtm_btvn_publisher;
commit;

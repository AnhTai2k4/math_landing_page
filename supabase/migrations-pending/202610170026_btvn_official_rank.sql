-- CHƯA ÁP DỤNG DB. Chạy sau 024, student_appearance và 025.
-- Điểm máy của bài có tự luận/nộp vở là tạm tính. Chỉ tổng đã chấm đủ
-- do đúng owner xác nhận mới vào hạng; không sửa biên nhận gốc.
begin;

create function mtm_hw_private.btvn_requires_manual_grade(p_exam jsonb,p_material jsonb)
returns boolean language sql immutable set search_path='' as $$
 select exists(select 1 from jsonb_array_elements(case when jsonb_typeof(p_exam->'questions')='array' then p_exam->'questions' else '[]' end) q where q->>'kind' in('self','essay'))
  or lower(normalize(coalesce(p_material->>'homeworkNote',''),NFC)) ~ '(nộp\s+vở|nop\s+vo|tự\s+luận|tu\s+luan)'
$$;
create function mtm_hw_private.btvn_grading_context(p_exam jsonb,p_material jsonb)
returns bytea language sql immutable set search_path='' as $$
 select sha256(convert_to(jsonb_build_object('exam',p_exam,'homeworkNote',coalesce(p_material->>'homeworkNote',''))::text,'UTF8'))
$$;
revoke all on function mtm_hw_private.btvn_requires_manual_grade(jsonb,jsonb),mtm_hw_private.btvn_grading_context(jsonb,jsonb) from public,anon,authenticated,service_role,mtm_btvn_publisher;

create table mtm_hw_private.btvn_manual_grades(
 student_id uuid not null,lesson_code text not null,attempt_id text not null check(length(btrim(attempt_id)) between 1 and 160),
 score numeric not null check(score between 0 and 10),
 receipt_hash bytea not null check(octet_length(receipt_hash)=32),context_hash bytea not null check(octet_length(context_hash)=32),
 graded_by uuid not null references auth.users(id),graded_at timestamptz not null default clock_timestamp(),revision integer not null default 1 check(revision>0),
 primary key(student_id,lesson_code,attempt_id),
 foreign key(student_id,lesson_code) references mtm_hw_private.btvn_work(student_id,lesson_code)
);
alter table mtm_hw_private.btvn_manual_grades enable row level security;
revoke all on table mtm_hw_private.btvn_manual_grades from public,anon,authenticated,service_role,mtm_btvn_publisher;

-- Chốt tổng 0..10 của đúng lượt sau khi đã chấm đủ mọi phần, không cộng
-- tổng máy đã chuẩn hóa với điểm tự luận. p_complete buộc người chấm xác nhận.
create function public.mtm_btvn_grade_attempt(p_student uuid,p_lesson text,p_attempt text,p_score numeric,p_complete boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare own uuid=mtm_hw_private.admin_id();exam jsonb;material jsonb;r jsonb;n integer;v_revision integer;
begin
 if p_complete is distinct from true or p_score is null or p_score not between 0 and 10
  or p_attempt is null or length(btrim(p_attempt)) not between 1 and 160 then raise exception 'Complete grade required' using errcode='22023';end if;
 select l.exam,l.material into exam,material from mtm_hw_private.btvn_lessons l
 join mtm_hw_private.students s on s.id=p_student and s.owner_id=own and s.class_id=any(l.class_ids)
 where l.code=p_lesson and l.owner_id=own;
 if not found then raise exception 'Student or lesson unavailable' using errcode='42501';end if;
 perform 1 from mtm_hw_private.btvn_work where student_id=p_student and lesson_code=p_lesson for update;
 if not found then raise exception 'Submitted attempt required' using errcode='22023';end if;
 select count(*),(jsonb_agg(x))->0 into n,r from mtm_hw_private.btvn_work w cross join lateral jsonb_array_elements(w.receipts) x
 where w.student_id=p_student and w.lesson_code=p_lesson and x->>'attemptId'=p_attempt;
 if n<>1 or jsonb_typeof(r->'submittedAt') is distinct from 'number' or (r->>'submittedAt')::numeric<0 then
  raise exception 'Unique submitted attempt required' using errcode='22023';end if;
 insert into mtm_hw_private.btvn_manual_grades(student_id,lesson_code,attempt_id,score,receipt_hash,context_hash,graded_by)
 values(p_student,p_lesson,p_attempt,p_score,sha256(convert_to((r-'late')::text,'UTF8')),mtm_hw_private.btvn_grading_context(exam,material),own)
 on conflict(student_id,lesson_code,attempt_id) do update set score=excluded.score,receipt_hash=excluded.receipt_hash,
  context_hash=excluded.context_hash,graded_by=excluded.graded_by,graded_at=clock_timestamp(),revision=mtm_hw_private.btvn_manual_grades.revision+1
 returning revision into v_revision;
 return jsonb_build_object('ok',true,'attemptId',p_attempt,'score',p_score,'revision',v_revision);
end$$;
revoke all on function public.mtm_btvn_grade_attempt(uuid,text,text,numeric,boolean) from public,anon,authenticated,service_role,mtm_btvn_publisher;
grant execute on function public.mtm_btvn_grade_attempt(uuid,text,text,numeric,boolean) to authenticated;

-- Không tin displayTotal hoặc receipt.score của snapshot MTM đang pending.
-- Với snapshot chính thức, đối chiếu tổng phân số, các hàng đã chấm và tổng 10.
create function mtm_hw_private.btvn_receipt_official_score(p_receipt jsonb,p_exam jsonb,p_material jsonb,p_manual_score numeric default null)
returns numeric language plpgsql immutable set search_path='' as $$
declare v numeric;m jsonb=p_receipt->'mtm';q jsonb;s jsonb;earned numeric=0;maximum numeric=0;n numeric;d numeric;row_max numeric;row_value numeric;ds_n integer;ds_d integer;section_sum numeric;section_max numeric;
begin
 if jsonb_typeof(p_receipt) is distinct from 'object' then return null;end if;
 if p_manual_score is not null then return case when p_manual_score between 0 and 10 then p_manual_score end;end if;
 if mtm_hw_private.btvn_requires_manual_grade(p_exam,p_material) then return null;end if;
 if jsonb_typeof(p_receipt->'score') is distinct from 'number' then return null;end if;
 v=(p_receipt->>'score')::numeric;if v not between 0 and 10 then return null;end if;
 if p_receipt ? 'mtm' or p_receipt->>'rubricVersion'='MTM-EQUAL-QUESTION-10-20261016-v1' or p_exam->>'rubricVersion'='MTM-EQUAL-QUESTION-10-20261016-v1' then
  if p_receipt->>'rubricVersion' is distinct from 'MTM-EQUAL-QUESTION-10-20261016-v1'
   or m->'versions'->>'rubricVersion' is distinct from 'MTM-EQUAL-QUESTION-10-20261016-v1'
   or nullif(p_receipt->>'attemptId','') is null or m->>'attemptId' is distinct from p_receipt->>'attemptId'
   or jsonb_typeof(m->'pending') is distinct from 'array' or m->'pending'<>'[]'::jsonb
   or jsonb_typeof(m->'rows') is distinct from 'array' or jsonb_array_length(m->'rows')=0
   or m->>'officialDisplayTotal' is distinct from m->>'displayTotal'
   or coalesce(m->>'officialDisplayTotal','') !~ '^([0-9]\.[0-9]{2}|10\.00)$'
   or (m->>'officialDisplayTotal')::numeric<>v then return null;end if;
  if exists(select 1 from unnest(array['examId','examVersion','answerKeyVersion','rubricVersion']) k where nullif(btrim(m->'versions'->>k),'') is null)
   or coalesce(m->'officialTotal'->>'numerator','') !~ '^(0|[1-9][0-9]{0,95})$'
   or coalesce(m->'officialTotal'->>'denominator','') !~ '^[1-9][0-9]{0,95}$'
   or coalesce(m->'rawTotal'->>'numerator','') !~ '^(0|[1-9][0-9]{0,95})$'
   or coalesce(m->'rawTotal'->>'denominator','') !~ '^[1-9][0-9]{0,95}$' then return null;end if;
  n=(m->'officialTotal'->>'numerator')::numeric;d=(m->'officialTotal'->>'denominator')::numeric;
  if n>10*d or n*(m->'rawTotal'->>'denominator')::numeric<>(m->'rawTotal'->>'numerator')::numeric*d or round(n/d,2)<>v then return null;end if;
  if (select count(distinct x->>'id') from jsonb_array_elements(m->'rows') x)<>jsonb_array_length(m->'rows') then return null;end if;
  for q in select value from jsonb_array_elements(m->'rows') loop
   if nullif(btrim(q->>'id'),'') is null or q->>'status' is distinct from 'graded' or coalesce(q->>'type','') not in('TN','DS','TLN')
    or q->'issues' is distinct from '[]'::jsonb
    or coalesce(q->'earned'->>'numerator','') !~ '^(0|[1-9][0-9]{0,95})$'
    or coalesce(q->'earned'->>'denominator','') !~ '^[1-9][0-9]{0,95}$'
    or coalesce(q->'maxScore'->>'numerator','') !~ '^[1-9][0-9]{0,95}$'
    or coalesce(q->'maxScore'->>'denominator','') !~ '^[1-9][0-9]{0,95}$' then return null;end if;
   row_value=(q->'earned'->>'numerator')::numeric/(q->'earned'->>'denominator')::numeric;
   row_max=(q->'maxScore'->>'numerator')::numeric/(q->'maxScore'->>'denominator')::numeric;
   if row_value>row_max or (q->'maxScore'->>'numerator')::numeric*jsonb_array_length(m->'rows')<>10*(q->'maxScore'->>'denominator')::numeric then return null;end if;
   if q->>'type'='DS' then
    if jsonb_typeof(q->'correctCount') is distinct from 'number' or coalesce(q->>'correctCount','') !~ '^[0-4]$' then return null;end if;
    ds_n=case (q->>'correctCount')::integer when 0 then 0 else 1 end;
    ds_d=case (q->>'correctCount')::integer when 0 then 1 when 1 then 10 when 2 then 4 when 3 then 2 else 1 end;
    if (q->'earned'->>'numerator')::numeric*(q->'maxScore'->>'denominator')::numeric*ds_d<>
     (q->'maxScore'->>'numerator')::numeric*ds_n*(q->'earned'->>'denominator')::numeric then return null;end if;
   elsif q->'correctCount' is distinct from 'null'::jsonb or (row_value<>0 and
    (q->'earned'->>'numerator')::numeric*(q->'maxScore'->>'denominator')::numeric<>
    (q->'maxScore'->>'numerator')::numeric*(q->'earned'->>'denominator')::numeric) then return null;end if;
   earned=earned+row_value;maximum=maximum+row_max;
  end loop;
  if abs(earned-n/d)>0.000000000001 or abs(maximum-10)>0.000000000001 then return null;end if;
  if jsonb_typeof(m->'sections') is distinct from 'array' or jsonb_array_length(m->'sections')<>(select count(distinct x->>'type') from jsonb_array_elements(m->'rows') x)
   or jsonb_array_length(m->'sections')<>(select count(distinct x->>'type') from jsonb_array_elements(m->'sections') x) then return null;end if;
  for s in select value from jsonb_array_elements(m->'sections') loop
   if coalesce(s->>'type','') not in('TN','DS','TLN')
    or coalesce(s->'rawTotal'->>'numerator','') !~ '^(0|[1-9][0-9]{0,95})$'
    or coalesce(s->'rawTotal'->>'denominator','') !~ '^[1-9][0-9]{0,95}$'
    or coalesce(s->'maxScore'->>'numerator','') !~ '^[1-9][0-9]{0,95}$'
    or coalesce(s->'maxScore'->>'denominator','') !~ '^[1-9][0-9]{0,95}$' then return null;end if;
   select sum((x->'earned'->>'numerator')::numeric/(x->'earned'->>'denominator')::numeric),
    sum((x->'maxScore'->>'numerator')::numeric/(x->'maxScore'->>'denominator')::numeric) into section_sum,section_max
    from jsonb_array_elements(m->'rows') x where x->>'type'=s->>'type';
   if section_sum is null or abs(section_sum-(s->'rawTotal'->>'numerator')::numeric/(s->'rawTotal'->>'denominator')::numeric)>0.000000000001
    or abs(section_max-(s->'maxScore'->>'numerator')::numeric/(s->'maxScore'->>'denominator')::numeric)>0.000000000001 then return null;end if;
  end loop;
 end if;
 return v;
exception when invalid_text_representation or division_by_zero or numeric_value_out_of_range then return null;
end$$;
revoke all on function mtm_hw_private.btvn_receipt_official_score(jsonb,jsonb,jsonb,numeric) from public,anon,authenticated,service_role,mtm_btvn_publisher;

create function mtm_hw_private.btvn_official_receipts(p_student uuid,p_lesson text)
returns table(receipt jsonb,score numeric,submitted_at numeric) language sql stable security definer set search_path='' as $$
 select r,mtm_hw_private.btvn_receipt_official_score(r,l.exam,l.material,g.score),
  case when jsonb_typeof(r->'submittedAt')='number' then (r->>'submittedAt')::numeric end
 from mtm_hw_private.btvn_work w join mtm_hw_private.btvn_lessons l on l.code=w.lesson_code
 cross join lateral jsonb_array_elements(w.receipts) r
 left join mtm_hw_private.btvn_manual_grades g on g.student_id=w.student_id and g.lesson_code=w.lesson_code and g.attempt_id=r->>'attemptId'
  and g.receipt_hash=sha256(convert_to((r-'late')::text,'UTF8')) and g.context_hash=mtm_hw_private.btvn_grading_context(l.exam,l.material)
  and (select count(*) from jsonb_array_elements(w.receipts) x where x->>'attemptId'=r->>'attemptId')=1
 where w.student_id=p_student and w.lesson_code=p_lesson
$$;
revoke all on function mtm_hw_private.btvn_official_receipts(uuid,text) from public,anon,authenticated,service_role,mtm_btvn_publisher;

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
  where a.lesson_day>=greatest(lo,'2026-10-15'::date) and a.lesson_day<hi
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
end$$;
revoke all on function mtm_hw_private.btvn_rank_rows(text,text,text,text,uuid) from public,anon,authenticated,service_role,mtm_btvn_publisher;

-- Metadata của RESPONSE tách khỏi work.receipts bất biến. Không trả điểm tháng
-- trước giờ đóng hoặc dữ liệu bài chưa mở mà wrapper cũ đã che.
alter function public.mtm_btvn_read(text,text) rename to mtm_btvn_read_before_official_rank;
create function public.mtm_btvn_read(p_session text,p_lesson text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare sid uuid=mtm_hw_private.btvn_student(p_session);result jsonb;cards jsonb;selected text;grades jsonb='{}';
begin
 result=public.mtm_btvn_read_before_official_rank(p_session,p_lesson);
 selected=result->'material'->>'lessonCode';
 if jsonb_typeof(result->'exam')='object' and not exists(select 1 from mtm_hw_private.btvn_lessons l where l.code=selected and l.kind='kiem-tra-thang' and clock_timestamp()<l.closes_at) then
  select coalesce(jsonb_object_agg(r.receipt->>'attemptId',r.score),'{}') into grades
  from mtm_hw_private.btvn_official_receipts(sid,selected) r join mtm_hw_private.btvn_manual_grades g
   on g.student_id=sid and g.lesson_code=selected and g.attempt_id=r.receipt->>'attemptId'
   and g.receipt_hash=sha256(convert_to((r.receipt-'late')::text,'UTF8'))
   and g.context_hash=(select mtm_hw_private.btvn_grading_context(l.exam,l.material) from mtm_hw_private.btvn_lessons l where l.code=selected)
  where r.score is not null;
 end if;
 select coalesce(jsonb_agg(case when card->>'available'='false' or (l.kind='kiem-tra-thang' and clock_timestamp()<l.closes_at) then
   card||jsonb_build_object('bestScore',null,'late',null,'pendingGrading',false)
  else card||jsonb_build_object('bestScore',progress.best,'pendingGrading',progress.submissions>0 and progress.best is null)
  end order by ord),'[]') into cards
 from jsonb_array_elements(coalesce(result->'lessons','[]')) with ordinality x(card,ord)
 left join mtm_hw_private.btvn_lessons l on l.code=card->>'lessonCode'
 left join lateral (select max(r.score) best,count(*) submissions from mtm_hw_private.btvn_official_receipts(sid,l.code) r where r.submitted_at is not null) progress on true;
 result=result||jsonb_build_object('officialGrades',grades,'lessons',cards);
 if jsonb_typeof(result->'material')='object' then
  result=jsonb_set(result,'{material}',result->'material'||jsonb_build_object('pendingGrading',
   exists(select 1 from mtm_hw_private.btvn_official_receipts(sid,selected) r where r.submitted_at is not null and r.score is null)));
 end if;
 return result;
end$$;
revoke all on function public.mtm_btvn_read_before_official_rank(text,text) from public,anon,authenticated,service_role,mtm_btvn_publisher;
revoke all on function public.mtm_btvn_read(text,text) from public,anon,authenticated,service_role,mtm_btvn_publisher;
grant execute on function public.mtm_btvn_read(text,text) to service_role;
commit;

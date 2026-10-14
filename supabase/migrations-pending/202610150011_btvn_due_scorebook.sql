-- Đợt 13, chỉ thử PGlite. Claude review và áp dụng riêng sau 010.
begin;
alter table mtm_hw_private.btvn_work add column expected_due_at timestamptz;
create function public.mtm_btvn_sync_due(p_payload jsonb,p_apply boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare owner uuid;v jsonb;a jsonb;ids uuid[];sid uuid;n integer;matched jsonb='[]';unmatched integer=0;
 r record;expected timestamptz;actual timestamptz;src text;old_receipts jsonb;new_receipts jsonb;changed integer=0;ne integer=0;na integer=0;summary jsonb;
begin
 if p_apply is null or jsonb_typeof(p_payload->'sessions') is distinct from 'array' or octet_length(p_payload::text)>10485760 then raise exception 'Invalid attendance payload';end if;
 select owner_id into owner from mtm_hw_private.btvn_roster_scope where singleton;
 if owner is null then raise exception 'Roster scope required' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('btvn-due:'||owner::text,0));
 for v in select value from jsonb_array_elements(p_payload->'sessions') loop
  if coalesce(v->>'startsAt','') !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\+07:00$' or nullif(v->>'sourceIdentity','') is null or jsonb_typeof(v->'attendees') is distinct from 'array' or not exists(select 1 from mtm_hw_private.classes where owner_id=owner and active and label=v->>'label') then raise exception 'Invalid attendance session';end if;
  for a in select value from jsonb_array_elements(v->'attendees') loop
   if coalesce(a->>'phone','') !~ '^0[0-9]{9}$' or coalesce(a->>'status','?') not in ('','C','M','L','K','ON','P','PH P') then raise exception 'Invalid attendee';end if;
   select array_agg(s.id) into ids from mtm_hw_private.students s join mtm_hw_private.classes c on c.id=s.class_id
   where s.owner_id=owner and s.active and c.active and substring(lower(c.label) from '^2k[0-9]+')=substring(lower(v->>'label') from '^2k[0-9]+')
   and a->>'phone' in (mtm_hw_private.btvn_phone(s.student_phone),mtm_hw_private.btvn_phone(s.parent_phone));
   n=coalesce(cardinality(ids),0);sid=null;
   if n=1 then sid=ids[1];elsif n>1 then
    select count(*),(array_agg(id))[1] into n,sid from mtm_hw_private.students where id=any(ids) and mtm_hw_private.btvn_name(full_name)=mtm_hw_private.btvn_name(a->>'name');
    if n<>1 then sid=null;end if;
   end if;
   if sid is null then unmatched=unmatched+1;else matched=matched||jsonb_build_array(v-'attendees'||jsonb_build_object('studentId',sid,'status',a->>'status'));end if;
  end loop;
 end loop;
 begin
  for r in select s.id,c.label,l.code,coalesce(l.material->'classDates'->>c.label,l.material->>'date') lesson_day
   from mtm_hw_private.students s join mtm_hw_private.classes c on c.id=s.class_id
   join mtm_hw_private.btvn_lessons l on s.class_id=any(l.class_ids) and l.owner_id=s.owner_id
   where s.owner_id=owner and s.active and c.active and l.active loop
   select min((x->>'startsAt')::timestamptz) filter(where x->>'status' in ('C','M','ON') or (x->>'status'='' and (x->>'startsAt')::timestamptz>clock_timestamp())),
    min((x->>'startsAt')::timestamptz) filter(where x->>'status' in ('C','M','ON')) into expected,actual
   from jsonb_array_elements(matched)x where x->>'studentId'=r.id::text
   and (x->>'startsAt')::timestamptz> ((r.lesson_day::date+1)::timestamp at time zone 'Asia/Ho_Chi_Minh')-interval '1 microsecond'
   and (x->>'label'=r.label or (r.label~' (8|9)\+$' and x->>'label'~' (8|9)\+$' and substring(lower(x->>'label') from '^2k[0-9]+')=substring(lower(r.label) from '^2k[0-9]+')));
   -- Snapshot không có em trong phạm vi này: giữ hạn đã đối soát trước đó.
   if not exists(select 1 from jsonb_array_elements(matched)x where x->>'studentId'=r.id::text and (x->>'label'=r.label or (r.label~' (8|9)\+$' and x->>'label'~' (8|9)\+$'))) then continue;end if;
   select x->>'sourceIdentity' into src from jsonb_array_elements(matched)x where x->>'studentId'=r.id::text and (x->>'startsAt')::timestamptz=actual and x->>'status' in ('C','M','ON') order by x->>'sourceIdentity' limit 1;
   insert into mtm_hw_private.btvn_work(student_id,lesson_code) values(r.id,r.code) on conflict do nothing;
   select receipts into old_receipts from mtm_hw_private.btvn_work where student_id=r.id and lesson_code=r.code for update;
   select coalesce(jsonb_agg(x||jsonb_build_object('late',case when actual is null then null else (x->>'submittedAt')::numeric>=extract(epoch from actual)*1000 end) order by ord),'[]') into new_receipts from jsonb_array_elements(old_receipts) with ordinality z(x,ord);
   select changed+count(*)::integer into changed from jsonb_array_elements(old_receipts) with ordinality z(x,ord) where x->'late' is distinct from new_receipts->(ord::integer-1)->'late';
   update mtm_hw_private.btvn_work set expected_due_at=expected,next_actual_class_at=actual,due_source_identity=src,receipts=new_receipts,revision=revision+1
    where student_id=r.id and lesson_code=r.code and (expected_due_at,next_actual_class_at,due_source_identity,receipts) is distinct from (expected,actual,src,new_receipts);
   if expected is not null then ne=ne+1;end if;if actual is not null then na=na+1;end if;
  end loop;
  summary=jsonb_build_object('sessions',jsonb_array_length(p_payload->'sessions'),'matchedStudents',(select count(distinct x->>'studentId') from jsonb_array_elements(matched)x),'unmatched',unmatched,'expectedDues',ne,'actualDues',na,'receiptsChanged',changed,'applied',p_apply);
  if not p_apply then raise exception 'Dry rollback' using errcode='PZ001';end if;
 exception when sqlstate 'PZ001' then if p_apply then raise;end if;end;
 return summary;
end$$;

-- Đọc operator có PII, không đưa vào API trình duyệt hay nhật ký chung.
create function public.mtm_btvn_scorebook(p_from date default '2026-10-15',p_apply boolean default false)
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('studentId',s.id,'fullName',s.full_name,'className',c.label,'lessonCode',l.code,'title',l.exam->>'title','date',coalesce(l.material->'classDates'->>c.label,l.material->>'date'),'dueAt',extract(epoch from w.next_actual_class_at)*1000,'expectedDueAt',extract(epoch from w.expected_due_at)*1000,'receipts',(select coalesce(jsonb_agg(receipt),'[]') from jsonb_array_elements(coalesce(w.receipts,'[]')) receipt where (receipt->>'submittedAt')::numeric>=extract(epoch from '2026-10-15T00:00:00+07:00'::timestamptz)*1000)) order by c.label,s.full_name,l.code),'[]')
 from mtm_hw_private.students s join mtm_hw_private.classes c on c.id=s.class_id
 join mtm_hw_private.btvn_roster_scope scope on scope.singleton and scope.owner_id=s.owner_id
 join mtm_hw_private.btvn_lessons l on s.class_id=any(l.class_ids) and l.owner_id=s.owner_id
 left join mtm_hw_private.btvn_work w on w.student_id=s.id and w.lesson_code=l.code
 where s.active and c.active and l.active and coalesce(s.source_identity,'') not like 'qa:%'
 and coalesce(l.material->'classDates'->>c.label,l.material->>'date')::date>=greatest(coalesce(p_from,'2026-10-15'::date),'2026-10-15'::date)
$$;
revoke all on function public.mtm_btvn_sync_due(jsonb,boolean),public.mtm_btvn_scorebook(date,boolean) from public,anon,authenticated,mtm_btvn_publisher;
grant execute on function public.mtm_btvn_sync_due(jsonb,boolean),public.mtm_btvn_scorebook(date,boolean) to service_role;
commit;

-- Giữ mtm_btvn_read từ 010, thêm expectedDueAt vào thẻ buổi.
begin;
create or replace function public.mtm_btvn_read(p_session text,p_lesson text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare sid uuid=mtm_hw_private.btvn_student(p_session);s mtm_hw_private.students;l mtm_hw_private.btvn_lessons;w mtm_hw_private.btvn_work;cards jsonb;clabel text;begin
 select * into s from mtm_hw_private.students where id=sid;
 select label into clabel from mtm_hw_private.classes where id=s.class_id;
 select * into l from mtm_hw_private.btvn_lessons where active and s.class_id=any(class_ids) and (p_lesson is null or code=p_lesson) order by material->>'date' desc,code limit 1;
 if not found then
  -- Chỉ lớp của phiên chưa có buổi mở mới nhận snapshot rỗng.
  if p_lesson is not null and (exists(select 1 from mtm_hw_private.btvn_lessons where active and s.class_id=any(class_ids)) or exists(select 1 from mtm_hw_private.btvn_lessons where code=p_lesson)) then raise exception 'Lesson unavailable' using errcode='42501';end if;
  return jsonb_build_object('revision',0,'lessons','[]'::jsonb,'work',jsonb_build_object('student',jsonb_build_object('studentCode','','fullName',s.full_name,'phone','','className',clabel),'drafts','[]'::jsonb,'receipts','[]'::jsonb));
 end if;
 insert into mtm_hw_private.btvn_work(student_id,lesson_code) values(sid,l.code) on conflict do nothing;
 select * into w from mtm_hw_private.btvn_work where student_id=sid and lesson_code=l.code;
 select coalesce(jsonb_agg(x.card order by x.lesson_day desc),'[]') into cards from (
 select coalesce(q.material->'classDates'->>clabel,q.material->>'date') lesson_day,q.material||jsonb_build_object('date',coalesce(q.material->'classDates'->>clabel,q.material->>'date'),'homeworkTitle',q.exam->>'title','available',true,'expectedDueAt',extract(epoch from b.expected_due_at)*1000,'dueAt',extract(epoch from b.next_actual_class_at)*1000,'bestScore',(select max((receipt.value->>'score')::numeric) from jsonb_array_elements(coalesce(b.receipts,'[]')) as receipt(value)),'late',best.receipt->'late','submittedAt',best.receipt->'submittedAt') card
 from mtm_hw_private.btvn_lessons q left join mtm_hw_private.btvn_work b on b.student_id=sid and b.lesson_code=q.code
 left join lateral (select receipt.value as receipt from jsonb_array_elements(coalesce(b.receipts,'[]')) as receipt(value) order by (receipt.value->>'score')::numeric desc,(receipt.value->>'submittedAt')::numeric desc limit 1)best on true where q.active and s.class_id=any(q.class_ids))x;
 return jsonb_build_object('revision',w.revision,'exam',l.exam,'material',l.material||jsonb_build_object('date',coalesce(l.material->'classDates'->>clabel,l.material->>'date')),'lessons',cards,'work',jsonb_build_object('student',jsonb_build_object('studentCode','','fullName',s.full_name,'phone','','className',clabel)||case when w.next_actual_class_at is null then '{}'::jsonb else jsonb_build_object('nextActualClassAt',extract(epoch from w.next_actual_class_at)*1000) end,'drafts',w.drafts,'receipts',w.receipts));
end$$;

commit;

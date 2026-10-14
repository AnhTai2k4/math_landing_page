-- Đợt 11: bổ sung tên đề thật vào thẻ buổi; giữ nguyên quyền và phạm vi đọc.
-- Migration chờ Claude áp, chưa chạy trên Supabase.
begin;
create or replace function public.mtm_btvn_read(p_session text,p_lesson text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare sid uuid=mtm_hw_private.btvn_student(p_session);s mtm_hw_private.students;l mtm_hw_private.btvn_lessons;w mtm_hw_private.btvn_work;cards jsonb;clabel text;begin
 select * into s from mtm_hw_private.students where id=sid;
 select label into clabel from mtm_hw_private.classes where id=s.class_id;
 select * into l from mtm_hw_private.btvn_lessons where active and s.class_id=any(class_ids) and (p_lesson is null or code=p_lesson) order by material->>'date' desc,code limit 1;
 if not found then raise exception 'Lesson unavailable' using errcode='42501';end if;
 insert into mtm_hw_private.btvn_work(student_id,lesson_code) values(sid,l.code) on conflict do nothing;
 select * into w from mtm_hw_private.btvn_work where student_id=sid and lesson_code=l.code;
 select coalesce(jsonb_agg(x.card order by x.lesson_day desc),'[]') into cards from (
 select coalesce(q.material->'classDates'->>clabel,q.material->>'date') lesson_day,q.material||jsonb_build_object('date',coalesce(q.material->'classDates'->>clabel,q.material->>'date'),'homeworkTitle',q.exam->>'title','available',true,'dueAt',extract(epoch from b.next_actual_class_at)*1000,'bestScore',(select max((receipt.value->>'score')::numeric) from jsonb_array_elements(coalesce(b.receipts,'[]')) as receipt(value)),'late',best.receipt->'late','submittedAt',best.receipt->'submittedAt') card
 from mtm_hw_private.btvn_lessons q left join mtm_hw_private.btvn_work b on b.student_id=sid and b.lesson_code=q.code
 left join lateral (select receipt.value as receipt from jsonb_array_elements(coalesce(b.receipts,'[]')) as receipt(value) order by (receipt.value->>'score')::numeric desc,(receipt.value->>'submittedAt')::numeric desc limit 1)best on true where q.active and s.class_id=any(q.class_ids))x;
 return jsonb_build_object('revision',w.revision,'exam',l.exam,'material',l.material||jsonb_build_object('date',coalesce(l.material->'classDates'->>clabel,l.material->>'date')),'lessons',cards,'work',jsonb_build_object('student',jsonb_build_object('studentCode','','fullName',s.full_name,'phone','','className',clabel)||case when w.next_actual_class_at is null then '{}'::jsonb else jsonb_build_object('nextActualClassAt',extract(epoch from w.next_actual_class_at)*1000) end,'drafts',w.drafts,'receipts',w.receipts));
end$$;

commit;

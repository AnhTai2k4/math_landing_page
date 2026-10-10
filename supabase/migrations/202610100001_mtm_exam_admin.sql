-- Apply once to a dedicated Supabase project. Existing MTM source is untouched.
begin;
create table public.mtm_exam_admins(user_id uuid primary key references auth.users(id),created_at timestamptz not null default now());
create table public.mtm_exam_drafts(id uuid primary key,owner_id uuid not null references auth.users(id),revision integer not null default 1 check(revision>0),payload jsonb not null check(octet_length(payload::text)<=524288),updated_at timestamptz not null default now());
create table public.mtm_exam_versions(id text primary key,draft_id uuid not null references public.mtm_exam_drafts(id),owner_id uuid not null references auth.users(id),exam jsonb not null,question_path text not null,solution_path text,published_at timestamptz not null default now());
create table public.mtm_exam_publications(draft_id uuid primary key references public.mtm_exam_drafts(id),version_id text not null references public.mtm_exam_versions(id),visible boolean not null default true);
alter table public.mtm_exam_admins enable row level security;
alter table public.mtm_exam_drafts enable row level security;
alter table public.mtm_exam_versions enable row level security;
alter table public.mtm_exam_publications enable row level security;
revoke all on public.mtm_exam_admins,public.mtm_exam_drafts,public.mtm_exam_versions,public.mtm_exam_publications from public,anon,authenticated;
grant select on public.mtm_exam_admins,public.mtm_exam_drafts to authenticated;
grant select on public.mtm_exam_versions,public.mtm_exam_publications to anon,authenticated;
create policy mtm_admin_self on public.mtm_exam_admins for select to authenticated using(user_id=(select auth.uid()));
create function public.mtm_is_exam_admin() returns boolean language sql stable security invoker set search_path='' as $$ select exists(select 1 from public.mtm_exam_admins where user_id=auth.uid()); $$;
revoke all on function public.mtm_is_exam_admin() from public,anon,authenticated;
grant execute on function public.mtm_is_exam_admin() to authenticated;
create policy mtm_draft_read on public.mtm_exam_drafts for select to authenticated using(owner_id=(select auth.uid()) and public.mtm_is_exam_admin());
-- Published snapshots stay readable for previous attempt review, including hidden/replaced editions.
create policy mtm_version_read on public.mtm_exam_versions for select to anon,authenticated using(true);
create policy mtm_publication_read on public.mtm_exam_publications for select to anon,authenticated using(true);
create function public.mtm_save_exam_draft(p_id uuid,p_revision integer,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.mtm_exam_drafts;
begin
 if not exists(select 1 from public.mtm_exam_admins where user_id=auth.uid()) then raise exception 'Administrator required' using errcode='42501'; end if;
 if p_payload is null or jsonb_typeof(p_payload)<>'object' or p_payload->>'id' is distinct from p_id::text or octet_length(p_payload::text)>524288 then raise exception 'Invalid draft'; end if;
 if p_revision is null then insert into public.mtm_exam_drafts(id,owner_id,payload) values(p_id,auth.uid(),p_payload) returning * into r;
 else update public.mtm_exam_drafts set payload=p_payload,revision=revision+1,updated_at=now() where id=p_id and owner_id=auth.uid() and revision=p_revision returning * into r;
 if not found then raise exception 'Draft changed' using errcode='40001'; end if; end if;
 return jsonb_build_object('id',r.id,'revision',r.revision,'payload',r.payload,'updated_at',r.updated_at);
end $$;
create function public.mtm_publish_exam(p_id uuid,p_revision integer,p_exam jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare d public.mtm_exam_drafts; v public.mtm_exam_versions; h text; q jsonb; a jsonb; i integer; n integer; path text; asset jsonb; key_text text;
begin
 if not exists(select 1 from public.mtm_exam_admins where user_id=auth.uid()) then raise exception 'Administrator required' using errcode='42501'; end if;
 select * into d from public.mtm_exam_drafts where id=p_id and owner_id=auth.uid() for update;
 if not found or p_revision is null or d.revision is distinct from p_revision then raise exception 'Draft changed' using errcode='40001'; end if;
 if p_exam is null or octet_length(p_exam::text)>1048576 or jsonb_typeof(p_exam) is distinct from 'object' then raise exception 'Invalid exam'; end if;
 if coalesce(d.payload->>'questionsOnly','')<>'true' or coalesce(d.payload->>'keyReviewed','')<>'true' or coalesce(d.payload->>'rightsConfirmed','')<>'true' or coalesce(d.payload->>'solutionsComplete','')<>'true' then raise exception 'Source attestations missing'; end if;
 if coalesce(d.payload->>'title','')='' or length(d.payload->>'title')>300 or length(coalesce(d.payload->>'publisher','')) not between 1 and 1000 or length(coalesce(d.payload->>'version','')) not between 1 and 1000 then raise exception 'Metadata missing'; end if;
 if coalesce(d.payload->>'grade','') not in ('10','11','12') or coalesce(d.payload->>'period','') not in ('GK1','CK1','GK2','CK2') or coalesce(d.payload->>'durationMinutes','')!~'^[0-9]{1,4}$' or (d.payload->>'durationMinutes')::int not between 1 and 1440 then raise exception 'Profile invalid'; end if;
 if coalesce(d.payload->>'sourceUrl','')!~'^https://[^/@[:space:]]+([/].*)?$' or length(d.payload->>'sourceUrl')>4096 then raise exception 'Source URL invalid'; end if;
 if jsonb_typeof(d.payload->'mc') is distinct from 'array' or jsonb_typeof(d.payload->'tf') is distinct from 'array' or jsonb_typeof(d.payload->'short') is distinct from 'array' or jsonb_typeof(d.payload->'solutions') is distinct from 'array' or jsonb_typeof(p_exam->'questions') is distinct from 'array' then raise exception 'Key arrays required'; end if;
 if jsonb_array_length(d.payload->'mc')<>12 or jsonb_array_length(d.payload->'tf')<>4 or jsonb_array_length(d.payload->'short')<>6 or jsonb_array_length(d.payload->'solutions')<>22 or jsonb_array_length(p_exam->'questions')<>22 then raise exception 'Incomplete key'; end if;
 if exists(select 1 from jsonb_array_elements(d.payload->'mc') as xs(x) where jsonb_typeof(x) is distinct from 'string') or exists(select 1 from jsonb_array_elements(d.payload->'short') as xs(x) where jsonb_typeof(x) is distinct from 'string') or exists(select 1 from jsonb_array_elements(d.payload->'solutions') as xs(x) where jsonb_typeof(x) is distinct from 'string') then raise exception 'Key and solution strings required'; end if;
 for i in 0..1 loop
 asset=case when i=0 then d.payload->'questionPdf' else d.payload->'solutionPdf' end;
 if asset is null or asset='null'::jsonb then if i=0 then raise exception 'Question PDF missing'; end if; continue; end if;
 path=asset->>'path';
 if jsonb_typeof(asset) is distinct from 'object' or coalesce(asset->>'sha256','')!~'^[0-9a-f]{64}$' or coalesce(asset->>'bytes','')!~'^[0-9]{1,8}$' or coalesce(asset->>'totalPages','')!~'^[0-9]{1,3}$' or path is distinct from auth.uid()::text||'/'||p_id::text||'/'||(asset->>'sha256')||(case when i=0 then '-questions.pdf' else '-solutions.pdf' end) or (asset->>'bytes')::int not between 8 and 15728640 or (asset->>'totalPages')::int not between 1 and 200 then raise exception 'PDF metadata invalid'; end if;
 if not exists(select 1 from storage.objects where bucket_id='mtm-exams' and name=path and metadata->>'mimetype'='application/pdf' and (metadata->>'size')::bigint=(asset->>'bytes')::bigint) then raise exception 'PDF object missing or mismatched'; end if;
 end loop;
 if p_exam->>'title' is distinct from btrim(d.payload->>'title') or p_exam->'grade' is distinct from d.payload->'grade' or p_exam->'period' is distinct from d.payload->'period' or p_exam->'durationMinutes' is distinct from d.payload->'durationMinutes' or p_exam->>'sourceUrl' is distinct from d.payload->>'sourceUrl' or p_exam->>'sourceHash' is distinct from d.payload->'questionPdf'->>'sha256' or p_exam->>'rubricVersion' is distinct from 'MTM-12MC-4TF-6SHORT-v1' or p_exam->>'questionCount' is distinct from '22' then raise exception 'Exam and draft mismatch'; end if;
 if p_exam->'sourcePdf'->>'sha256' is distinct from d.payload->'questionPdf'->>'sha256' or p_exam->'sourcePdf'->'bytes' is distinct from d.payload->'questionPdf'->'bytes' or p_exam->'sourcePdf'->'totalPages' is distinct from d.payload->'questionPdf'->'totalPages' then raise exception 'PDF mismatch'; end if;
 if p_exam->'sourcePdf'->'verified' is distinct from 'true'::jsonb or coalesce(p_exam->'sourcePdf'->>'url','')!~'^https://[^/@[:space:]]+([/].*)?$' or length(p_exam->'sourcePdf'->>'url')>4096 or length(coalesce(p_exam->>'sourceRef','')) not between 1 and 1000 or length(coalesce(p_exam->'sourceMaterial'->>'locator','')) not between 1 and 1000 then raise exception 'Source fields invalid'; end if;
 if p_exam->'sourceMaterial'->>'title' is distinct from btrim(d.payload->>'title') or p_exam->'sourceMaterial'->>'publisher' is distinct from btrim(d.payload->>'publisher') or p_exam->'sourceMaterial'->>'version' is distinct from btrim(d.payload->>'version') then raise exception 'Source material mismatch'; end if;
 n=(d.payload->'questionPdf'->>'totalPages')::int;
 if p_exam->'sourcePdf'->'questionPages' is distinct from (select jsonb_agg(s) from generate_series(1,n) s) then raise exception 'Questions-only PDF must contain all question pages'; end if;
 for i in 0..21 loop
 q=p_exam->'questions'->i;
 if jsonb_typeof(q) is distinct from 'object' or q->>'id' is distinct from 'q'||(i+1)::text or length(coalesce(q->>'sourceRef','')) not between 1 and 500 or length(coalesce(q->>'solution','')) not between 1 and 20000 then raise exception 'Question fields missing'; end if;
 key_text=btrim(d.payload->'solutions'->>i);
 if length(key_text)>20000 or (coalesce(d.payload->'solutionPdf','null'::jsonb)='null'::jsonb and length(key_text)<20) then raise exception 'Detailed solution missing'; end if;
 if q->>'solution' is distinct from (case when key_text='' then 'Xem lời giải đầy đủ trong PDF đáp án sau khi nộp bài.' else key_text end) then raise exception 'Solution mismatch'; end if;
 if i<12 then
 if q->>'kind' is distinct from 'mc' or q->>'maxMillipoints' is distinct from '250' or q->>'answer' is distinct from d.payload->'mc'->>i or coalesce(q->>'answer','') not in ('A','B','C','D') or q->'choices' is distinct from '["A","B","C","D"]'::jsonb then raise exception 'MC key invalid'; end if;
 elsif i<16 then
 a=d.payload->'tf'->(i-12);
 if jsonb_typeof(a) is distinct from 'array' then raise exception 'TF array required'; end if;
 if q->>'kind' is distinct from 'tf' or q->>'maxMillipoints' is distinct from '1000' or q->'pointsByCorrectCount' is distinct from '[0,100,250,500,1000]'::jsonb or jsonb_array_length(a)<>4 or q->'answer' is distinct from (select jsonb_agg(value='"D"'::jsonb order by ordinality) from jsonb_array_elements(a) with ordinality) or exists(select 1 from jsonb_array_elements(a) as items(item) where jsonb_typeof(item) is distinct from 'string' or item not in ('"D"'::jsonb,'"S"'::jsonb)) then raise exception 'TF key invalid'; end if;
 else
 key_text=btrim(d.payload->'short'->>(i-16));
 if q->>'kind' is distinct from 'short' or q->>'maxMillipoints' is distinct from '500' or q->>'mode' is distinct from 'numeric' or length(coalesce(key_text,'')) not between 1 and 100 or coalesce(key_text,'')!~'^[+-]?[0-9]+([.,][0-9]+)?$' or q->'acceptedAnswers' is distinct from jsonb_build_array(key_text) then raise exception 'Short key invalid'; end if;
 end if;
 end loop;
 -- Hash from database snapshot; caller cannot replace a published edition by reusing a hash.
 h=encode(sha256(convert_to(d.payload::text,'UTF8')),'hex');
 p_exam=p_exam||jsonb_build_object('id','mtm-custom-'||p_id::text||'-'||h,'versionHash',h,'answerKeyVerified',true,'rubricVerified',true,'publicationVerified',true,'questionDisplayVerified',true);
 insert into public.mtm_exam_versions(id,draft_id,owner_id,exam,question_path,solution_path) values(p_exam->>'id',p_id,auth.uid(),p_exam,d.payload->'questionPdf'->>'path',d.payload->'solutionPdf'->>'path') on conflict(id) do nothing;
 select * into v from public.mtm_exam_versions where id=p_exam->>'id';
 insert into public.mtm_exam_publications(draft_id,version_id,visible) values(p_id,v.id,true) on conflict(draft_id) do update set version_id=excluded.version_id,visible=true;
 return jsonb_build_object('id',v.id,'draft_id',v.draft_id,'exam',v.exam,'question_path',v.question_path,'solution_path',v.solution_path,'published_at',v.published_at,'visible',true);
end $$;
create function public.mtm_exam_visibility(p_id uuid,p_visible boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if p_visible is null or not exists(select 1 from public.mtm_exam_admins where user_id=auth.uid()) then raise exception 'Administrator required' using errcode='42501'; end if;
 update public.mtm_exam_publications set visible=p_visible where draft_id=p_id and exists(select 1 from public.mtm_exam_drafts where id=p_id and owner_id=auth.uid());
 if not found then raise exception 'Published exam not found'; end if;
end $$;
create function public.mtm_list_exams() returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',v.id,'draft_id',v.draft_id,'exam',v.exam,'question_path',v.question_path,'solution_path',v.solution_path,'published_at',v.published_at,'visible',coalesce(p.visible and p.version_id=v.id,false)) order by v.published_at desc),'[]'::jsonb) from public.mtm_exam_versions v left join public.mtm_exam_publications p on p.draft_id=v.draft_id;
$$;
revoke all on function public.mtm_save_exam_draft(uuid,integer,jsonb),public.mtm_publish_exam(uuid,integer,jsonb),public.mtm_exam_visibility(uuid,boolean),public.mtm_list_exams() from public,anon,authenticated;
grant execute on function public.mtm_save_exam_draft(uuid,integer,jsonb),public.mtm_publish_exam(uuid,integer,jsonb),public.mtm_exam_visibility(uuid,boolean) to authenticated;
grant execute on function public.mtm_list_exams() to anon,authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('mtm-exams','mtm-exams',false,15728640,array['application/pdf']);
-- Private staging objects: no update/delete policies; published PDFs are immutable.
create policy mtm_pdf_insert on storage.objects for insert to authenticated with check(bucket_id='mtm-exams' and public.mtm_is_exam_admin() and name~('^'||auth.uid()::text||'/[0-9a-f-]{36}/[0-9a-f]{64}-(questions|solutions)[.]pdf$'));
create policy mtm_pdf_admin_read on storage.objects for select to authenticated using(bucket_id='mtm-exams' and public.mtm_is_exam_admin() and split_part(name,'/',1)=auth.uid()::text);
create policy mtm_pdf_published_read on storage.objects for select to anon,authenticated using(bucket_id='mtm-exams' and exists(select 1 from public.mtm_exam_versions v where v.question_path=name or v.solution_path=name));
commit;

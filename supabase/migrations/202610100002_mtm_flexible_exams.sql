-- Add a separate validated profile. Existing legacy publisher/snapshots stay unchanged.
begin;
create function public.mtm_valid_exam_text(p_text text,p_max integer) returns boolean language sql immutable set search_path='' as $$
 -- JavaScript limits count UTF-16 units; supplementary characters occupy two.
 select coalesce(length(p_text)+length(regexp_replace(p_text,U&'[^\+010000-\+10FFFF]','','g')) between 1 and p_max and p_text!~'^[[:space:]   -   　﻿]*$',false);
$$;
revoke all on function public.mtm_valid_exam_text(text,integer) from public,anon,authenticated;
create function public.mtm_valid_exam_url(p_url text) returns boolean language sql immutable set search_path='' as $$
 select coalesce(public.mtm_valid_exam_text(p_url,4096) and p_url!~'[[:space:]   -   　﻿]' and p_url~'^https://[A-Za-z0-9]([A-Za-z0-9._-]*[A-Za-z0-9])?(:[0-9]{1,5})?([/?#][^[:space:]]*)?$' and substring(p_url from '^https://([^/:?#]+)')!~*'(^|\.)0x[0-9a-f]*$' and
 -- Numeric terminal host labels are interpreted as IPv4 by browser URL parsers.
 case when substring(p_url from '^https://([^/:?#]+)')~'(^|\.)[0-9]+$' then substring(p_url from '^https://([^/:?#]+)')~'^[0-9]{1,3}(\.[0-9]{1,3}){3}$' and not exists(select 1 from unnest(string_to_array(substring(p_url from '^https://([^/:?#]+)'),'.')) part where case when part~'^(0|[1-9][0-9]{0,2})$' then part::int not between 0 and 255 else true end) else true end and
 case when substring(p_url from '^https://[^/:?#]+:([0-9]+)') is null then true when length(substring(p_url from '^https://[^/:?#]+:([0-9]+)'))<=5 then substring(p_url from '^https://[^/:?#]+:([0-9]+)')::int between 0 and 65535 else false end,false);
$$;
revoke all on function public.mtm_valid_exam_url(text) from public,anon,authenticated;
create function public.mtm_publish_flexible_exam(p_id uuid,p_revision integer,p_exam jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare d public.mtm_exam_drafts; v public.mtm_exam_versions; section jsonb; q jsonb; asset jsonb; a jsonb; h text; path text; kind text; key_text text; label text; policy text; schedule jsonb; total integer=0; count_q integer=0; idx integer=0; mc_idx integer=0; tf_idx integer=0; short_idx integer=0; n integer; j integer; k integer; pts integer; expected_pts integer;
begin
 if not exists(select 1 from public.mtm_exam_admins where user_id=auth.uid()) then raise exception 'Administrator required' using errcode='42501'; end if;
 select * into d from public.mtm_exam_drafts where id=p_id and owner_id=auth.uid() for update;
 if not found or p_revision is null or d.revision is distinct from p_revision then raise exception 'Draft changed' using errcode='40001'; end if;
 if p_exam is null or jsonb_typeof(p_exam) is distinct from 'object' or octet_length(p_exam::text)>1048576 then raise exception 'Invalid exam'; end if;
 if exists(select 1 from unnest(array['id','title','publisher','version','sourceUrl','period','pointMode','tfScoring','shortMode']) f where jsonb_typeof(d.payload->f) is distinct from 'string') or jsonb_typeof(d.payload->'grade') is distinct from 'number' or jsonb_typeof(d.payload->'durationMinutes') is distinct from 'number' then raise exception 'Metadata types invalid'; end if;
 if exists(select 1 from unnest(array['questionsOnly','keyReviewed','rightsConfirmed','solutionsComplete']) f where d.payload->f is distinct from 'true'::jsonb) then raise exception 'Source attestations missing'; end if;
 if not public.mtm_valid_exam_text(d.payload->>'title',300) or not public.mtm_valid_exam_text(d.payload->>'publisher',1000) or not public.mtm_valid_exam_text(d.payload->>'version',1000) then raise exception 'Metadata missing'; end if;
 if coalesce(d.payload->>'grade','') not in ('10','11','12') or coalesce(d.payload->>'period','') not in ('GK1','CK1','GK2','CK2') or coalesce(d.payload->>'durationMinutes','')!~'^[0-9]{1,4}$' or (d.payload->>'durationMinutes')::int not between 1 and 1440 then raise exception 'Profile invalid'; end if;
 if not public.mtm_valid_exam_url(d.payload->>'sourceUrl') then raise exception 'Source URL invalid'; end if;
 if coalesce(d.payload->>'pointMode','') not in ('auto','manual','preset') or coalesce(d.payload->>'tfScoring','') not in ('thpt','equal','all') or coalesce(d.payload->>'shortMode','') not in ('numeric','rational','exact') then raise exception 'Scoring mode invalid'; end if;
 if jsonb_typeof(d.payload->'layout') is distinct from 'array' or jsonb_array_length(d.payload->'layout') not between 1 and 12 then raise exception 'Sections required'; end if;
 for section in select value from jsonb_array_elements(d.payload->'layout') loop
 if jsonb_typeof(section) is distinct from 'object' or jsonb_typeof(section->'label') is distinct from 'string' or jsonb_typeof(section->'kind') is distinct from 'string' or jsonb_typeof(section->'count') is distinct from 'number' or length(btrim(coalesce(section->>'label',''))) not between 1 and 100 or coalesce(section->>'kind','') not in ('mc','tf','short') or coalesce(section->>'count','')!~'^[0-9]{1,3}$' or (section->>'count')::int not between 1 and 300 then raise exception 'Section invalid'; end if;
 count_q=count_q+(section->>'count')::int;
 end loop;
 if count_q not between 1 and 300 then raise exception 'Question limit'; end if;
 if exists(select 1 from jsonb_array_elements(d.payload->'layout') s where not public.mtm_valid_exam_text(s->>'label',100)) then raise exception 'Section label invalid'; end if;
 if exists(select 1 from unnest(array['title','sourceHash','sourceUrl','sourceRef','rubricVersion']) f where jsonb_typeof(p_exam->f) is distinct from 'string') or jsonb_typeof(p_exam->'questionCount') is distinct from 'number' or jsonb_typeof(p_exam->'sourcePdf'->'sha256') is distinct from 'string' then raise exception 'Exam metadata types invalid'; end if;
 if exists(select 1 from unnest(array['mc','tf','short','solutions']) f where jsonb_typeof(d.payload->f) is distinct from 'array') or jsonb_typeof(p_exam->'questions') is distinct from 'array' then raise exception 'Key arrays required'; end if;
 if jsonb_array_length(d.payload->'solutions')<>count_q or jsonb_array_length(p_exam->'questions')<>count_q or p_exam->'sections' is distinct from d.payload->'layout' or p_exam->>'rubricVersion' is distinct from 'MTM-FLEX-10-v1' or p_exam->>'questionCount' is distinct from count_q::text then raise exception 'Profile mismatch'; end if;
 if d.payload->>'pointMode'<>'auto' then
 if jsonb_typeof(d.payload->'points') is distinct from 'array' or jsonb_array_length(d.payload->'points')<>count_q then raise exception 'Points required'; end if;
 end if;
 for j in 0..1 loop
 asset=case when j=0 then d.payload->'questionPdf' else d.payload->'solutionPdf' end;
 if asset is null or asset='null'::jsonb then if j=0 then raise exception 'Question PDF missing'; end if; continue; end if;
 path=asset->>'path';
 if exists(select 1 from unnest(array['path','sha256','name']) f where jsonb_typeof(asset->f) is distinct from 'string') or jsonb_typeof(asset->'bytes') is distinct from 'number' or jsonb_typeof(asset->'totalPages') is distinct from 'number' then raise exception 'PDF types invalid'; end if;
 if jsonb_typeof(asset) is distinct from 'object' or coalesce(asset->>'sha256','')!~'^[0-9a-f]{64}$' or coalesce(asset->>'bytes','')!~'^[0-9]{1,8}$' or coalesce(asset->>'totalPages','')!~'^[0-9]{1,3}$' or path is distinct from auth.uid()::text||'/'||p_id::text||'/'||(asset->>'sha256')||(case when j=0 then '-questions.pdf' else '-solutions.pdf' end) or (asset->>'bytes')::int not between 8 and 15728640 or (asset->>'totalPages')::int not between 1 and 200 or length(coalesce(asset->>'name','')) not between 1 and 300 then raise exception 'PDF metadata invalid'; end if;
 if not exists(select 1 from storage.objects where bucket_id='mtm-exams' and name=path and metadata->>'mimetype'='application/pdf' and (metadata->>'size')::bigint=(asset->>'bytes')::bigint) then raise exception 'PDF object missing or mismatched'; end if;
 end loop;
 if p_exam->>'title' is distinct from btrim(d.payload->>'title') or p_exam->'grade' is distinct from d.payload->'grade' or p_exam->'period' is distinct from d.payload->'period' or p_exam->'durationMinutes' is distinct from d.payload->'durationMinutes' or p_exam->>'sourceUrl' is distinct from d.payload->>'sourceUrl' or p_exam->>'sourceHash' is distinct from d.payload->'questionPdf'->>'sha256' or p_exam->>'sourceRef' is distinct from d.payload->>'version' then raise exception 'Metadata mismatch'; end if;
 if exists(select 1 from unnest(array['title','publisher','version','locator']) f where jsonb_typeof(p_exam->'sourceMaterial'->f) is distinct from 'string') or jsonb_typeof(p_exam->'sourceRef') is distinct from 'string' or jsonb_typeof(p_exam->'answerVerificationNote') is distinct from 'string' then raise exception 'Source types invalid'; end if;
 if p_exam->'sourceMaterial'->>'title' is distinct from btrim(d.payload->>'title') or p_exam->'sourceMaterial'->>'publisher' is distinct from btrim(d.payload->>'publisher') or p_exam->'sourceMaterial'->>'version' is distinct from btrim(d.payload->>'version') or not public.mtm_valid_exam_text(p_exam->'sourceMaterial'->>'locator',1000) or not public.mtm_valid_exam_text(p_exam->>'answerVerificationNote',2000) then raise exception 'Source material invalid'; end if;
 if p_exam->'sourcePdf'->>'sha256' is distinct from d.payload->'questionPdf'->>'sha256' or p_exam->'sourcePdf'->'bytes' is distinct from d.payload->'questionPdf'->'bytes' or p_exam->'sourcePdf'->'totalPages' is distinct from d.payload->'questionPdf'->'totalPages' or p_exam->'sourcePdf'->'verified' is distinct from 'true'::jsonb or coalesce(p_exam->'sourcePdf'->>'url','')!~'^https://[^/@[:space:]]+([/].*)?$' or length(p_exam->'sourcePdf'->>'url')>4096 then raise exception 'PDF mismatch'; end if;
 if jsonb_typeof(p_exam->'sourcePdf'->'url') is distinct from 'string' or not public.mtm_valid_exam_url(p_exam->'sourcePdf'->>'url') then raise exception 'PDF URL invalid'; end if;
 n=(d.payload->'questionPdf'->>'totalPages')::int;
 if p_exam->'sourcePdf'->'questionPages' is distinct from (select jsonb_agg(s) from generate_series(1,n) s) then raise exception 'Questions-only PDF must contain all pages'; end if;
 for section in select value from jsonb_array_elements(d.payload->'layout') loop
 kind=section->>'kind';label=section->>'label';
 for j in 1..(section->>'count')::int loop
 q=p_exam->'questions'->idx;
 if exists(select 1 from unnest(array['id','kind','sourceRef','solution']) f where jsonb_typeof(q->f) is distinct from 'string') or jsonb_typeof(q->'maxMillipoints') is distinct from 'number' then raise exception 'Question types invalid'; end if;
 if jsonb_typeof(q) is distinct from 'object' or q->>'id' is distinct from 'q'||(idx+1)::text or q->>'kind' is distinct from kind or q->>'sourceRef' is distinct from label||' · Câu '||j::text then raise exception 'Question ordering mismatch'; end if;
 if coalesce(q->>'maxMillipoints','')!~'^[0-9]{1,5}$' or (q->>'maxMillipoints')::int not between 1 and 10000 then raise exception 'Points invalid'; end if;
 pts=(q->>'maxMillipoints')::int;total=total+pts;
 if d.payload->>'pointMode'='auto' then expected_pts=10000/count_q+(case when idx<(10000%count_q) then 1 else 0 end);
 else if jsonb_typeof(d.payload->'points'->idx) is distinct from 'number' or coalesce(d.payload->'points'->>idx,'')!~'^[0-9]{1,5}$' then raise exception 'Manual point invalid'; end if;expected_pts=(d.payload->'points'->>idx)::int;end if;
 if pts<>expected_pts then raise exception 'Point schedule mismatch'; end if;
 if jsonb_typeof(d.payload->'solutions'->idx) is distinct from 'string' then raise exception 'Solution string required'; end if;
 key_text=btrim(d.payload->'solutions'->>idx);
 if length(key_text)>20000 or (key_text<>'' and not public.mtm_valid_exam_text(key_text,20000)) or (coalesce(d.payload->'solutionPdf','null'::jsonb)='null'::jsonb and length(key_text)<20) or q->>'solution' is distinct from (case when key_text='' then 'Xem lời giải đầy đủ trong PDF đáp án sau khi nộp bài.' else key_text end) then raise exception 'Solution invalid'; end if;
 if kind='mc' then
 if jsonb_typeof(d.payload->'mc'->mc_idx) is distinct from 'string' or q->>'answer' is distinct from d.payload->'mc'->>mc_idx or coalesce(q->>'answer','') not in ('A','B','C','D') or q->'choices' is distinct from '["A","B","C","D"]'::jsonb then raise exception 'MC key invalid'; end if;mc_idx=mc_idx+1;
 elsif kind='tf' then
 a=d.payload->'tf'->tf_idx;
 if jsonb_typeof(a) is distinct from 'array' or jsonb_array_length(a)<>4 or exists(select 1 from jsonb_array_elements(a) as xs(x) where jsonb_typeof(x) is distinct from 'string' or x not in ('"D"'::jsonb,'"S"'::jsonb)) then raise exception 'TF key invalid'; end if;
 policy=d.payload->>'tfScoring';schedule=case when policy='all' then jsonb_build_array(0,0,0,0,pts) when policy='thpt' then jsonb_build_array(0,round(pts*.1)::int,round(pts*.25)::int,round(pts*.5)::int,pts) else jsonb_build_array(0,round(pts/4.0)::int,round(pts/2.0)::int,round(pts*3/4.0)::int,pts) end;
 if q->'answer' is distinct from (select jsonb_agg(value='"D"'::jsonb order by ordinality) from jsonb_array_elements(a) with ordinality) or q->'pointsByCorrectCount' is distinct from schedule then raise exception 'TF schedule mismatch'; end if;tf_idx=tf_idx+1;
 else
 if jsonb_typeof(d.payload->'short'->short_idx) is distinct from 'string' then raise exception 'Short string required'; end if;key_text=btrim(d.payload->'short'->>short_idx);
 if not public.mtm_valid_exam_text(key_text,100) or q->>'mode' is distinct from d.payload->>'shortMode' or q->'acceptedAnswers' is distinct from jsonb_build_array(key_text) then raise exception 'Short key invalid'; end if;
 if d.payload->>'shortMode'='numeric' and key_text!~'^[+-]?[0-9]+([.,][0-9]+)?$' then raise exception 'Decimal key invalid'; end if;
 if d.payload->>'shortMode'='rational' then
 if key_text!~'^[+-]?[0-9]+([.,][0-9]+)?$' and key_text!~'^[+-]?[0-9]+/[+-]?[0-9]+$' then raise exception 'Rational key invalid'; end if;
 if position('/' in key_text)>0 and split_part(key_text,'/',2)::numeric=0 then raise exception 'Zero denominator'; end if;end if;short_idx=short_idx+1;
 end if;idx=idx+1;
 end loop;end loop;
 if total<>10000 or jsonb_array_length(d.payload->'mc')<>mc_idx or jsonb_array_length(d.payload->'tf')<>tf_idx or jsonb_array_length(d.payload->'short')<>short_idx then raise exception 'Total/key counts mismatch'; end if;
 h=encode(sha256(convert_to(d.payload::text,'UTF8')),'hex');
 -- Only admitted fields are retained; arbitrary client prompt/HTML/statement overrides are excluded.
 p_exam=jsonb_build_object('id','mtm-custom-'||p_id::text||'-'||h,'versionHash',h,'answerKeyVerified',true,'rubricVerified',true,'publicationVerified',true,'questionDisplayVerified',true,'sourceHash',p_exam->'sourceHash','sourceRef',p_exam->'sourceRef','questionCount',count_q,'grade',p_exam->'grade','period',p_exam->'period','title',p_exam->'title','durationMinutes',p_exam->'durationMinutes','rubricVersion','MTM-FLEX-10-v1','sections',p_exam->'sections','sourceUrl',p_exam->'sourceUrl','sourceMaterial',p_exam->'sourceMaterial','answerVerificationNote',p_exam->'answerVerificationNote','sourcePdf',p_exam->'sourcePdf','questions',(select jsonb_agg(q.value - array['prompt','text','statements'] order by q.ordinality) from jsonb_array_elements(p_exam->'questions') with ordinality q));
 insert into public.mtm_exam_versions(id,draft_id,owner_id,exam,question_path,solution_path) values(p_exam->>'id',p_id,auth.uid(),p_exam,d.payload->'questionPdf'->>'path',d.payload->'solutionPdf'->>'path') on conflict(id) do nothing;
 select * into v from public.mtm_exam_versions where id=p_exam->>'id';
 insert into public.mtm_exam_publications(draft_id,version_id,visible) values(p_id,v.id,true) on conflict(draft_id) do update set version_id=excluded.version_id,visible=true;
 return jsonb_build_object('id',v.id,'draft_id',v.draft_id,'exam',v.exam,'question_path',v.question_path,'solution_path',v.solution_path,'published_at',v.published_at,'visible',true);
end $$;
revoke all on function public.mtm_publish_flexible_exam(uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function public.mtm_publish_flexible_exam(uuid,integer,jsonb) to authenticated;
commit;

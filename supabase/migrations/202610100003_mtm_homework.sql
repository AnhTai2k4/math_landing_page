-- STANDALONE ARTIFACT, NOT APPLIED TO CLOUD. Root owner must review before merging.
-- Prerequisites: existing auth.uid(), mtm_exam_admins, storage.buckets/objects.
-- No anonymous Supabase Auth, deployed credentials, external extension or original API changes.
-- Student RPCs are server-gateway-only; service_role is an existing DB role, never a browser key.
begin;
create schema mtm_hw_private;
revoke all on schema mtm_hw_private from public,anon,authenticated,service_role;
create table mtm_hw_private.config(singleton boolean primary key default true check(singleton), secret bytea not null check(octet_length(secret)=32));
insert into mtm_hw_private.config values(true,sha256(convert_to(gen_random_uuid()::text||gen_random_uuid()::text||gen_random_uuid()::text||gen_random_uuid()::text,'UTF8')));
create table mtm_hw_private.classes(id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id),label text not null check(length(btrim(label)) between 1 and 100),grade smallint not null check(grade between 10 and 12),active boolean not null default true,created_at timestamptz not null default clock_timestamp());
create table mtm_hw_private.students(id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id),class_id uuid not null references mtm_hw_private.classes(id),full_name text not null check(length(btrim(full_name)) between 1 and 200),school text not null check(length(btrim(school)) between 1 and 200),school_class text not null check(length(btrim(school_class)) between 1 and 100),public_alias text not null unique check(public_alias ~ '^MTM-[0-9A-F]{12}$'),active boolean not null default true,created_at timestamptz not null default clock_timestamp());
create table mtm_hw_private.memberships(id uuid primary key default gen_random_uuid(),student_id uuid not null references mtm_hw_private.students(id),class_id uuid not null references mtm_hw_private.classes(id),joined_at timestamptz not null default clock_timestamp(),left_at timestamptz,check(left_at is null or left_at>=joined_at));
create unique index mtm_hw_active_membership on mtm_hw_private.memberships(student_id) where left_at is null;
create table mtm_hw_private.codes(id uuid primary key default gen_random_uuid(),student_id uuid not null references mtm_hw_private.students(id),digest bytea not null unique check(octet_length(digest)=32),issued_by uuid not null references auth.users(id),issued_at timestamptz not null default clock_timestamp(),expires_at timestamptz not null,revoked_at timestamptz);
create table mtm_hw_private.challenges(id uuid primary key default gen_random_uuid(),student_id uuid not null references mtm_hw_private.students(id),code_id uuid not null references mtm_hw_private.codes(id),digest bytea not null unique check(octet_length(digest)=32),expires_at timestamptz not null,consumed_at timestamptz);
create table mtm_hw_private.sessions(id uuid primary key default gen_random_uuid(),student_id uuid not null references mtm_hw_private.students(id),code_id uuid not null references mtm_hw_private.codes(id),digest bytea not null unique check(octet_length(digest)=32),confirmed_at timestamptz not null default clock_timestamp(),expires_at timestamptz not null,revoked_at timestamptz);
create table mtm_hw_private.rate_limits(bucket timestamptz not null,scope text not null,hits integer not null check(hits>0),primary key(bucket,scope));
create table mtm_hw_private.drafts(id uuid primary key,owner_id uuid not null references auth.users(id),revision integer not null default 1 check(revision>0),payload jsonb not null check(jsonb_typeof(payload)='object' and octet_length(payload::text)<=524288),updated_at timestamptz not null default clock_timestamp());
create table mtm_hw_private.assignments(id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id),draft_id uuid not null references mtm_hw_private.drafts(id),class_id uuid not null references mtm_hw_private.classes(id),exam jsonb not null,version_hash text not null check(version_hash ~ '^[0-9a-f]{64}$'),opens_at timestamptz not null,due_at timestamptz not null,month_key text not null check(month_key ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),weight integer not null check(weight between 1 and 100),rank_eligible boolean not null,visible boolean not null default true,created_at timestamptz not null default clock_timestamp(),check(due_at>opens_at));
create table mtm_hw_private.attempts(id uuid primary key default gen_random_uuid(),student_id uuid not null references mtm_hw_private.students(id),assignment_id uuid not null references mtm_hw_private.assignments(id),attempt_number integer not null check(attempt_number>0),started_at timestamptz not null,deadline timestamptz not null,revision integer not null default 1 check(revision>0),answers jsonb not null default '{}'::jsonb,submitted_at timestamptz,submission_key uuid,score jsonb,elapsed_ms bigint,qualifying boolean not null default false,late boolean not null default false,unique(student_id,assignment_id,attempt_number),check(deadline>started_at));
create unique index mtm_hw_one_open_attempt on mtm_hw_private.attempts(student_id,assignment_id) where submitted_at is null;
create index mtm_hw_attempt_history on mtm_hw_private.attempts(student_id,submitted_at desc);
create index mtm_hw_assignment_month on mtm_hw_private.assignments(class_id,month_key);
-- Immutable submitted attempts/assignment snapshots are only mutated by scoped functions.
do $$ declare t record; begin for t in select tablename from pg_tables where schemaname='mtm_hw_private' loop execute format('alter table mtm_hw_private.%I enable row level security',t.tablename);execute format('revoke all on mtm_hw_private.%I from public,anon,authenticated,service_role',t.tablename);end loop;end $$;

-- RFC 2104 HMAC-SHA256 using PostgreSQL-native sha256(bytea), without pgcrypto.
create function mtm_hw_private.hmac_sha256(k bytea,data bytea) returns bytea language plpgsql immutable strict set search_path='' as $$
declare key bytea=k; ipad bytea=decode(repeat('00',64),'hex');opad bytea=decode(repeat('00',64),'hex');i integer;b integer;
begin if octet_length(key)>64 then key=sha256(key);end if;for i in 0..63 loop b=case when i<octet_length(key) then get_byte(key,i) else 0 end;ipad=set_byte(ipad,i,b#54);opad=set_byte(opad,i,b#92);end loop;return sha256(opad||sha256(ipad||data));end $$;
create function mtm_hw_private.token_digest(kind text,token text) returns bytea language sql stable strict security definer set search_path='' as $$select mtm_hw_private.hmac_sha256(secret,convert_to(kind||':'||token,'UTF8')) from mtm_hw_private.config where singleton$$;
create function mtm_hw_private.random_token() returns text language sql volatile set search_path='' as $$select replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','')$$;
create function mtm_hw_private.js_trim(p_text text) returns text language sql immutable strict set search_path='' as $$
 select btrim(p_text,U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF');$$;
-- Keep the reviewed flexible admission's UTF-16/whitespace/URL gate private.
create function mtm_hw_private.valid_text(p_text text,p_max integer) returns boolean language sql immutable set search_path='' as $$
 select coalesce(length(p_text)+length(regexp_replace(p_text,U&'[^\+010000-\+10FFFF]','','g')) between 1 and p_max and mtm_hw_private.js_trim(p_text)<>'' and p_text!~'^[[:space:]   -   　﻿]*$',false);$$;
create function mtm_hw_private.valid_url(p_url text) returns boolean language sql immutable set search_path='' as $$
 select coalesce(mtm_hw_private.valid_text(p_url,4096) and p_url!~'[[:space:]   -   　﻿]' and p_url~'^https://[A-Za-z0-9]([A-Za-z0-9._-]*[A-Za-z0-9])?(:[0-9]{1,5})?([/?#][^[:space:]]*)?$' and substring(p_url from '^https://([^/:?#]+)')!~*'(^|\.)0x[0-9a-f]*$' and
 case when substring(p_url from '^https://([^/:?#]+)')~'(^|\.)[0-9]+$' then substring(p_url from '^https://([^/:?#]+)')~'^[0-9]{1,3}(\.[0-9]{1,3}){3}$' and not exists(select 1 from unnest(string_to_array(substring(p_url from '^https://([^/:?#]+)'),'.')) part where case when part~'^(0|[1-9][0-9]{0,2})$' then part::int not between 0 and 255 else true end) else true end and
 case when substring(p_url from '^https://[^/:?#]+:([0-9]+)') is null then true when length(substring(p_url from '^https://[^/:?#]+:([0-9]+)'))<=5 then substring(p_url from '^https://[^/:?#]+:([0-9]+)')::int between 0 and 65535 else false end,false);$$;
create function mtm_hw_private.admin_id() returns uuid language plpgsql stable security definer set search_path='' as $$declare u uuid=auth.uid();begin if u is null or not exists(select 1 from public.mtm_exam_admins where user_id=u) then raise exception 'Administrator required' using errcode='42501';end if;return u;end $$;
create function mtm_hw_private.profile(sid uuid) returns jsonb language sql stable security definer set search_path='' as $$select jsonb_build_object('fullName',s.full_name,'school',s.school,'schoolClass',s.school_class,'centerClass',c.label,'classId',c.id,'publicAlias',s.public_alias) from mtm_hw_private.students s join mtm_hw_private.classes c on c.id=s.class_id where s.id=sid and s.active and c.active$$;
create function mtm_hw_private.session_student(token text) returns uuid language plpgsql volatile security definer set search_path='' as $$declare sid uuid;begin
 if token is null or token !~ '^[0-9a-f]{64}$' then raise exception 'Student session required' using errcode='42501';end if;
 select x.student_id into sid from mtm_hw_private.sessions x join mtm_hw_private.codes c on c.id=x.code_id join mtm_hw_private.students s on s.id=x.student_id join mtm_hw_private.classes cl on cl.id=s.class_id where x.digest=mtm_hw_private.token_digest('session',token) and x.revoked_at is null and x.expires_at>clock_timestamp() and c.revoked_at is null and c.expires_at>clock_timestamp() and s.active and cl.active;
 if sid is null then raise exception 'Student session required' using errcode='42501';end if;return sid;end $$;
create function mtm_hw_private.rate_ok(scope_key text,limit_n integer) returns boolean language plpgsql volatile security definer set search_path='' as $$declare n integer; bucket_t timestamptz=date_trunc('minute',clock_timestamp());begin
 delete from mtm_hw_private.rate_limits where bucket<bucket_t-interval '2 minutes';
 insert into mtm_hw_private.rate_limits(bucket,scope,hits) values(bucket_t,scope_key,1) on conflict(bucket,scope) do update set hits=mtm_hw_private.rate_limits.hits+1 returning hits into n;return n<=limit_n;end $$;
-- The server gateway derives this HMAC from a trusted network address; no raw IP/code is accepted.
-- Returning a denial rather than throwing retains the increment within an ordinary RPC transaction.
create function public.mtm_hw_gateway_rate(p_network_key text) returns jsonb language plpgsql security definer set search_path='' as $$
declare allowed boolean;now_t timestamptz;retry_s integer;begin
 if p_network_key is null or p_network_key !~ '^[0-9a-f]{64}$' then raise exception 'Network key invalid' using errcode='22023';end if;
 allowed=mtm_hw_private.rate_ok('resolve-network-'||p_network_key,120);now_t=clock_timestamp();retry_s=greatest(1,ceil(extract(epoch from date_trunc('minute',now_t)+interval '1 minute'-now_t))::integer);
 return jsonb_build_object('ok',allowed,'retryAfterSeconds',case when allowed then 0 else retry_s end,'serverNow',now_t);end $$;

create function public.mtm_hw_admin_class(p_label text,p_grade integer) returns uuid language plpgsql security definer set search_path='' as $$declare u uuid=mtm_hw_private.admin_id();cid uuid;begin if not mtm_hw_private.valid_text(p_label,100) then raise exception 'Class label invalid';end if;insert into mtm_hw_private.classes(owner_id,label,grade) values(u,mtm_hw_private.js_trim(p_label),p_grade) returning id into cid;return cid;end $$;
create function public.mtm_hw_admin_student(p_id uuid,p_class_id uuid,p_name text,p_school text,p_school_class text) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid=mtm_hw_private.admin_id();s mtm_hw_private.students;old_class uuid;
begin
 if not exists(select 1 from mtm_hw_private.classes where id=p_class_id and owner_id=u and active) then raise exception 'Class unavailable' using errcode='42501';end if;
 if not mtm_hw_private.valid_text(p_name,200) or not mtm_hw_private.valid_text(p_school,200) or not mtm_hw_private.valid_text(p_school_class,100) then raise exception 'Student text invalid';end if;
 if p_id is null then insert into mtm_hw_private.students(owner_id,class_id,full_name,school,school_class,public_alias) values(u,p_class_id,mtm_hw_private.js_trim(p_name),mtm_hw_private.js_trim(p_school),mtm_hw_private.js_trim(p_school_class),'MTM-'||upper(left(replace(gen_random_uuid()::text,'-',''),12))) returning * into s;
 else select class_id into old_class from mtm_hw_private.students where id=p_id and owner_id=u for update;if not found then raise exception 'Student unavailable' using errcode='42501';end if;update mtm_hw_private.students set class_id=p_class_id,full_name=mtm_hw_private.js_trim(p_name),school=mtm_hw_private.js_trim(p_school),school_class=mtm_hw_private.js_trim(p_school_class) where id=p_id returning * into s;end if;
 if old_class is distinct from p_class_id then update mtm_hw_private.memberships set left_at=clock_timestamp() where student_id=s.id and left_at is null;insert into mtm_hw_private.memberships(student_id,class_id) values(s.id,p_class_id);end if;
 return jsonb_build_object('id',s.id,'profile',mtm_hw_private.profile(s.id));end $$;
create function public.mtm_hw_admin_issue_code(p_student_id uuid,p_days integer default 90) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid=mtm_hw_private.admin_id();raw text=replace(gen_random_uuid()::text,'-','');cid uuid;until_t timestamptz;begin
 if p_days is null or p_days not between 1 and 365 or not exists(select 1 from mtm_hw_private.students where id=p_student_id and owner_id=u and active) then raise exception 'Student/duration unavailable';end if;
 perform 1 from mtm_hw_private.students where id=p_student_id for update;until_t=clock_timestamp()+make_interval(days=>p_days);
 update mtm_hw_private.codes set revoked_at=clock_timestamp() where student_id=p_student_id and revoked_at is null;update mtm_hw_private.sessions set revoked_at=clock_timestamp() where student_id=p_student_id and revoked_at is null;
 insert into mtm_hw_private.codes(student_id,digest,issued_by,expires_at) values(p_student_id,mtm_hw_private.token_digest('code',raw),u,until_t) returning id into cid;
 return jsonb_build_object('codeId',cid,'code',upper(raw),'expiresAt',until_t);end $$;
create function public.mtm_hw_admin_revoke_code(p_code_id uuid) returns void language plpgsql security definer set search_path='' as $$declare u uuid=mtm_hw_private.admin_id();begin
 update mtm_hw_private.codes set revoked_at=clock_timestamp() where id=p_code_id and issued_by=u;if not found then raise exception 'Code unavailable' using errcode='42501';end if;update mtm_hw_private.sessions set revoked_at=clock_timestamp() where code_id=p_code_id and revoked_at is null;end $$;
create function public.mtm_hw_admin_list(p_kind text,p_offset integer default 0,p_limit integer default 100) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid=mtm_hw_private.admin_id();items jsonb;begin
 if p_offset is null or p_offset not between 0 and 100000 or p_limit is null or p_limit not between 1 and 100 then raise exception 'Pagination invalid';end if;
 case p_kind
 when 'classes' then select coalesce(jsonb_agg(x.item),'[]'::jsonb) into items from(select jsonb_build_object('id',id,'label',label,'grade',grade,'active',active) item from mtm_hw_private.classes where owner_id=u order by created_at desc,id limit p_limit offset p_offset)x;
 when 'students' then select coalesce(jsonb_agg(x.item),'[]'::jsonb) into items from(select jsonb_build_object('id',s.id,'classId',s.class_id,'active',s.active,'profile',mtm_hw_private.profile(s.id)) item from mtm_hw_private.students s where s.owner_id=u order by s.created_at desc,s.id limit p_limit offset p_offset)x;
 when 'codes' then select coalesce(jsonb_agg(x.item),'[]'::jsonb) into items from(select jsonb_build_object('id',id,'studentId',student_id,'issuedAt',issued_at,'expiresAt',expires_at,'revokedAt',revoked_at) item from mtm_hw_private.codes where issued_by=u order by issued_at desc,id limit p_limit offset p_offset)x;
 when 'drafts' then select coalesce(jsonb_agg(x.item),'[]'::jsonb) into items from(select jsonb_build_object('id',id,'revision',revision,'payload',payload,'updatedAt',updated_at) item from mtm_hw_private.drafts where owner_id=u order by updated_at desc,id limit p_limit offset p_offset)x;
 when 'assignments' then select coalesce(jsonb_agg(x.item),'[]'::jsonb) into items from(select jsonb_build_object('id',id,'draftId',draft_id,'classId',class_id,'title',exam->>'title','versionHash',version_hash,'opensAt',opens_at,'dueAt',due_at,'month',month_key,'weight',weight,'rankEligible',rank_eligible,'visible',visible) item from mtm_hw_private.assignments where owner_id=u order by created_at desc,id limit p_limit offset p_offset)x;
 when 'history' then select coalesce(jsonb_agg(x.item),'[]'::jsonb) into items from(select jsonb_build_object('attemptId',t.id,'studentId',t.student_id,'assignmentId',t.assignment_id,'attemptNumber',t.attempt_number,'submittedAt',t.submitted_at,'score',t.score,'elapsedMs',t.elapsed_ms,'qualifying',t.qualifying,'late',t.late) item from mtm_hw_private.attempts t join mtm_hw_private.assignments a on a.id=t.assignment_id where a.owner_id=u and t.submitted_at is not null order by t.submitted_at desc,t.id limit p_limit offset p_offset)x;
 else raise exception 'List kind invalid';end case;
 return jsonb_build_object('items',items,'offset',p_offset,'limit',p_limit);end $$;
create function public.mtm_hw_resolve_code(p_code text) returns jsonb language plpgsql security definer set search_path='' as $$
declare raw text;d bytea;c mtm_hw_private.codes;token text;bad jsonb='{"ok":false,"message":"Mã không hợp lệ hoặc chưa dùng được."}'::jsonb;
begin
 if p_code is null or length(p_code)>100 then return bad;end if;raw=lower(regexp_replace(p_code,'[-[:space:]]','','g'));
 if raw !~ '^[0-9a-f]{32}$' then return bad;end if;d=mtm_hw_private.token_digest('code',raw);
 if not mtm_hw_private.rate_ok('resolve-code-'||encode(d,'hex'),10) then return bad;end if;
 select * into c from mtm_hw_private.codes where digest=d and revoked_at is null and expires_at>clock_timestamp();
 if not found or mtm_hw_private.profile(c.student_id) is null then return bad;end if;
 delete from mtm_hw_private.challenges where expires_at<clock_timestamp()-interval '1 day';delete from mtm_hw_private.sessions where expires_at<clock_timestamp()-interval '1 day';token=mtm_hw_private.random_token();
 insert into mtm_hw_private.challenges(student_id,code_id,digest,expires_at) values(c.student_id,c.id,mtm_hw_private.token_digest('challenge',token),clock_timestamp()+interval '5 minutes');
 return jsonb_build_object('ok',true,'challenge',token,'profile',mtm_hw_private.profile(c.student_id));end $$;
create function public.mtm_hw_confirm(p_challenge text,p_confirm boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare x mtm_hw_private.challenges;token text;until_t timestamptz;bad jsonb='{"ok":false,"message":"Xác nhận đã hết hạn hoặc không hợp lệ."}'::jsonb;begin
 if p_confirm is distinct from true or p_challenge is null or p_challenge !~ '^[0-9a-f]{64}$' then return bad;end if;
 select * into x from mtm_hw_private.challenges where digest=mtm_hw_private.token_digest('challenge',p_challenge) for update;
 if not found or x.consumed_at is not null or x.expires_at<=clock_timestamp() or not exists(select 1 from mtm_hw_private.codes c where c.id=x.code_id and c.revoked_at is null and c.expires_at>clock_timestamp()) or mtm_hw_private.profile(x.student_id) is null then return bad;end if;
 update mtm_hw_private.challenges set consumed_at=clock_timestamp() where id=x.id;token=mtm_hw_private.random_token();until_t=clock_timestamp()+interval '8 hours';
 insert into mtm_hw_private.sessions(student_id,code_id,digest,expires_at) values(x.student_id,x.code_id,mtm_hw_private.token_digest('session',token),until_t);
 return jsonb_build_object('ok',true,'session',token,'expiresAt',until_t,'profile',mtm_hw_private.profile(x.student_id));end $$;
create function public.mtm_hw_me(p_session text) returns jsonb language plpgsql security definer set search_path='' as $$declare sid uuid=mtm_hw_private.session_student(p_session);begin return jsonb_build_object('profile',mtm_hw_private.profile(sid));end $$;
create function public.mtm_hw_logout(p_session text) returns void language plpgsql security definer set search_path='' as $$begin
 if p_session is not null and p_session ~ '^[0-9a-f]{64}$' then update mtm_hw_private.sessions set revoked_at=clock_timestamp() where digest=mtm_hw_private.token_digest('session',p_session);end if;end $$;

-- Exact decimal/rational comparison uses integer cross-products, not floating division.
create function mtm_hw_private.numeric_pair(p text,mode text) returns numeric[] language plpgsql immutable set search_path='' as $$
declare s text=mtm_hw_private.js_trim(p);whole text;frac text;begin
 if s is null or not mtm_hw_private.valid_text(p,500) then return null;end if;
 if mode='rational' and s ~ '^[+-]?[0-9]+/[+-]?[0-9]+$' then if split_part(s,'/',2)::numeric=0 then return null;end if;return array[split_part(s,'/',1)::numeric,split_part(s,'/',2)::numeric];end if;
 if mode not in ('numeric','rational') or s !~ '^[+-]?[0-9]+([.,][0-9]+)?$' then return null;end if;s=replace(s,',','.');whole=split_part(s,'.',1);frac=case when position('.' in s)>0 then split_part(s,'.',2) else '' end;
 return array[(whole||frac)::numeric,('1'||repeat('0',length(frac)))::numeric];end $$;
create function mtm_hw_private.short_matches(mode text,p text,k text) returns boolean language plpgsql immutable set search_path='' as $$declare a numeric[];b numeric[];begin
 if not mtm_hw_private.valid_text(p,500) or not mtm_hw_private.valid_text(k,100) then return false;end if;
 if mode='exact' then return mtm_hw_private.js_trim(p)=mtm_hw_private.js_trim(k);end if;a=mtm_hw_private.numeric_pair(p,mode);b=mtm_hw_private.numeric_pair(k,mode);return coalesce(a[1]*b[2]=b[1]*a[2],false);end $$;
create function mtm_hw_private.validate_private_exam(d jsonb,owner uuid,draft_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare section jsonb;asset jsonb;q jsonb;answer jsonb;questions jsonb='[]';kind text;path text;key_text text;solution text;schedule jsonb;pts integer;total integer=0;count_q integer=0;idx integer=0;mc_idx integer=0;tf_idx integer=0;short_idx integer=0;i integer;j integer;part_idx integer=0;
begin
 if d is null or jsonb_typeof(d) is distinct from 'object' or octet_length(d::text)>524288 then raise exception 'Invalid draft';end if;
 if exists(select 1 from unnest(array['id','title','publisher','version','sourceUrl','period','pointMode','tfScoring','shortMode']) f where jsonb_typeof(d->f) is distinct from 'string') or d->>'id' is distinct from draft_id::text or jsonb_typeof(d->'grade') is distinct from 'number' or jsonb_typeof(d->'durationMinutes') is distinct from 'number' then raise exception 'Metadata types invalid';end if;
 if exists(select 1 from unnest(array['questionsOnly','keyReviewed','rightsConfirmed','solutionsComplete']) f where d->f is distinct from 'true'::jsonb) then raise exception 'Source attestations missing';end if;
 if not mtm_hw_private.valid_text(d->>'title',300) or not mtm_hw_private.valid_text(d->>'publisher',1000) or not mtm_hw_private.valid_text(d->>'version',1000) then raise exception 'Metadata missing';end if;
 if coalesce(d->>'grade','') not in ('10','11','12') or coalesce(d->>'period','') not in ('GK1','CK1','GK2','CK2') or coalesce(d->>'durationMinutes','') !~ '^[0-9]{1,4}$' or (d->>'durationMinutes')::int not between 1 and 1440 then raise exception 'Profile invalid';end if;
 if not mtm_hw_private.valid_url(d->>'sourceUrl') then raise exception 'Source URL invalid';end if;
 if coalesce(d->>'pointMode','') not in ('auto','manual','preset') or coalesce(d->>'tfScoring','') not in ('thpt','equal','all') or coalesce(d->>'shortMode','') not in ('numeric','rational','exact') then raise exception 'Scoring mode invalid';end if;
 if jsonb_typeof(d->'layout') is distinct from 'array' or jsonb_array_length(d->'layout') not between 1 and 12 then raise exception 'Sections required';end if;
 for section in select value from jsonb_array_elements(d->'layout') loop
 if jsonb_typeof(section) is distinct from 'object' or jsonb_typeof(section->'label') is distinct from 'string' or jsonb_typeof(section->'kind') is distinct from 'string' or jsonb_typeof(section->'count') is distinct from 'number' or not mtm_hw_private.valid_text(section->>'label',100) or coalesce(section->>'kind','') not in ('mc','tf','short') or coalesce(section->>'count','') !~ '^[0-9]{1,3}$' or (section->>'count')::int not between 1 and 300 then raise exception 'Section invalid';end if;count_q=count_q+(section->>'count')::int;end loop;
 if count_q not between 1 and 300 then raise exception 'Question limit';end if;
 if exists(select 1 from unnest(array['mc','tf','short','solutions']) f where jsonb_typeof(d->f) is distinct from 'array') or jsonb_array_length(d->'solutions')<>count_q then raise exception 'Key arrays/count required';end if;
 if d->>'pointMode'<>'auto' and (jsonb_typeof(d->'points') is distinct from 'array' or jsonb_array_length(d->'points')<>count_q) then raise exception 'Points required';end if;
 for j in 0..1 loop
 asset=case when j=0 then d->'questionPdf' else d->'solutionPdf' end;if asset is null or asset='null'::jsonb then if j=0 then raise exception 'Question PDF missing';end if;continue;end if;path=asset->>'path';
 if exists(select 1 from unnest(array['path','sha256','name']) f where jsonb_typeof(asset->f) is distinct from 'string') or jsonb_typeof(asset->'bytes') is distinct from 'number' or jsonb_typeof(asset->'totalPages') is distinct from 'number' then raise exception 'PDF types invalid';end if;
 if jsonb_typeof(asset) is distinct from 'object' or coalesce(asset->>'sha256','') !~ '^[0-9a-f]{64}$' or coalesce(asset->>'bytes','') !~ '^[0-9]{1,8}$' or coalesce(asset->>'totalPages','') !~ '^[0-9]{1,3}$' or path is distinct from owner::text||'/'||draft_id::text||'/'||(asset->>'sha256')||(case when j=0 then '-questions.pdf' else '-solutions.pdf' end) or (asset->>'bytes')::int not between 8 and 15728640 or (asset->>'totalPages')::int not between 1 and 200 or not mtm_hw_private.valid_text(asset->>'name',300) then raise exception 'PDF metadata invalid';end if;
 if not exists(select 1 from storage.objects where bucket_id='mtm-homework' and name=path and metadata->>'mimetype'='application/pdf' and (metadata->>'size')::bigint=(asset->>'bytes')::bigint) then raise exception 'PDF object missing or mismatched';end if;end loop;
 for section in select value from jsonb_array_elements(d->'layout') loop part_idx=part_idx+1;kind=section->>'kind';
 for j in 1..(section->>'count')::int loop
 if d->>'pointMode'='auto' then pts=10000/count_q+case when idx<10000%count_q then 1 else 0 end;else if jsonb_typeof(d->'points'->idx) is distinct from 'number' or coalesce(d->'points'->>idx,'') !~ '^[0-9]{1,5}$' then raise exception 'Manual point invalid';end if;pts=(d->'points'->>idx)::int;end if;
 if pts not between 1 and 10000 then raise exception 'Points invalid';end if;total=total+pts;
 if jsonb_typeof(d->'solutions'->idx) is distinct from 'string' then raise exception 'Solution string required';end if;solution=mtm_hw_private.js_trim(d->'solutions'->>idx);
 if length(solution)>20000 or (solution<>'' and not mtm_hw_private.valid_text(solution,20000)) or (coalesce(d->'solutionPdf','null'::jsonb)='null'::jsonb and length(solution)<20) then raise exception 'Solution incomplete';end if;
 q=jsonb_build_object('id','q'||(idx+1)::text,'kind',kind,'sourceRef',(section->>'label')||' · Câu '||j::text,'partId','part'||part_idx::text,'partLabel',section->>'label','maxMillipoints',pts,'solution',case when solution='' then 'Xem PDF lời giải đầy đủ sau khi nộp bài.' else solution end);
 if kind='mc' then
 if jsonb_typeof(d->'mc'->mc_idx) is distinct from 'string' or coalesce(d->'mc'->>mc_idx,'') not in ('A','B','C','D') then raise exception 'MC key invalid';end if;q=q||jsonb_build_object('choices',jsonb_build_array('A','B','C','D'),'answer',d->'mc'->mc_idx);mc_idx=mc_idx+1;
 elsif kind='tf' then answer=d->'tf'->tf_idx;
 if jsonb_typeof(answer) is distinct from 'array' or jsonb_array_length(answer)<>4 or exists(select 1 from jsonb_array_elements(answer) as xs(x) where jsonb_typeof(x) is distinct from 'string' or x not in ('"D"'::jsonb,'"S"'::jsonb)) then raise exception 'TF key invalid';end if;
 schedule=case d->>'tfScoring' when 'all' then jsonb_build_array(0,0,0,0,pts) when 'thpt' then jsonb_build_array(0,round(pts*.1)::int,round(pts*.25)::int,round(pts*.5)::int,pts) else jsonb_build_array(0,round(pts/4.0)::int,round(pts/2.0)::int,round(pts*3/4.0)::int,pts) end;
 q=q||jsonb_build_object('answer',(select jsonb_agg(value='"D"'::jsonb order by ordinality) from jsonb_array_elements(answer) with ordinality),'pointsByCorrectCount',schedule);tf_idx=tf_idx+1;
 else
 if jsonb_typeof(d->'short'->short_idx) is distinct from 'string' then raise exception 'Short key string required';end if;key_text=mtm_hw_private.js_trim(d->'short'->>short_idx);
 if not mtm_hw_private.valid_text(d->'short'->>short_idx,100) or (d->>'shortMode'<>'exact' and mtm_hw_private.numeric_pair(key_text,d->>'shortMode') is null) then raise exception 'Short key invalid';end if;q=q||jsonb_build_object('mode',d->>'shortMode','acceptedAnswers',jsonb_build_array(key_text));short_idx=short_idx+1;end if;
 questions=questions||jsonb_build_array(q);idx=idx+1;end loop;end loop;
 if total<>10000 or jsonb_array_length(d->'mc')<>mc_idx or jsonb_array_length(d->'tf')<>tf_idx or jsonb_array_length(d->'short')<>short_idx then raise exception 'Total/key counts mismatch';end if;
 return jsonb_build_object('title',mtm_hw_private.js_trim(d->>'title'),'grade',d->'grade','period',d->'period','durationMinutes',d->'durationMinutes','questionCount',count_q,'sections',d->'layout','rubricVersion','MTM-HW-FLEX-10-v1','questionPdf',d->'questionPdf','solutionPdf',d->'solutionPdf','sourceUrl',d->'sourceUrl','sourceRef',d->'version','questions',questions);end $$;
create function public.mtm_hw_admin_save_draft(p_id uuid,p_revision integer,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$declare u uuid=mtm_hw_private.admin_id();d mtm_hw_private.drafts;begin
 if p_payload is null or p_payload->>'id' is distinct from p_id::text then raise exception 'Draft identifier mismatch';end if;
 if p_revision is null then insert into mtm_hw_private.drafts(id,owner_id,payload) values(p_id,u,p_payload) returning * into d;
 else update mtm_hw_private.drafts set payload=p_payload,revision=revision+1,updated_at=clock_timestamp() where id=p_id and owner_id=u and revision=p_revision returning * into d;if not found then raise exception 'Draft changed' using errcode='40001';end if;end if;
 return jsonb_build_object('id',d.id,'revision',d.revision,'payload',d.payload);end $$;
create function public.mtm_hw_admin_assign(p_draft_id uuid,p_revision integer,p_class_id uuid,p_opens timestamptz,p_due timestamptz,p_weight integer default 1,p_rank_eligible boolean default true) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid=mtm_hw_private.admin_id();d mtm_hw_private.drafts;e jsonb;a mtm_hw_private.assignments;begin
 if p_opens is null or p_due is null or p_due<=p_opens or p_due-p_opens>interval '366 days' or p_weight is null or p_weight not between 1 and 100 or p_rank_eligible is null then raise exception 'Assignment window/weight invalid';end if;
 select * into d from mtm_hw_private.drafts where id=p_draft_id and owner_id=u for update;if not found or d.revision is distinct from p_revision then raise exception 'Draft changed' using errcode='40001';end if;
 e=mtm_hw_private.validate_private_exam(d.payload,u,d.id);
 if not exists(select 1 from mtm_hw_private.classes where id=p_class_id and owner_id=u and active and grade=(e->>'grade')::int) then raise exception 'Class/grade unavailable';end if;
 insert into mtm_hw_private.assignments(owner_id,draft_id,class_id,exam,version_hash,opens_at,due_at,month_key,weight,rank_eligible) values(u,d.id,p_class_id,e,encode(sha256(convert_to(d.payload::text,'UTF8')),'hex'),p_opens,p_due,to_char(p_due at time zone 'Asia/Ho_Chi_Minh','YYYY-MM'),p_weight,p_rank_eligible) returning * into a;
 return jsonb_build_object('id',a.id,'versionHash',a.version_hash,'month',a.month_key);end $$;
create function public.mtm_hw_admin_visibility(p_assignment uuid,p_visible boolean) returns void language plpgsql security definer set search_path='' as $$declare u uuid=mtm_hw_private.admin_id();begin
 if p_visible is null then raise exception 'Visibility required';end if;update mtm_hw_private.assignments set visible=p_visible where id=p_assignment and owner_id=u;if not found then raise exception 'Assignment unavailable' using errcode='42501';end if;end $$;
create function mtm_hw_private.public_exam(e jsonb) returns jsonb language sql immutable set search_path='' as $$
 select e-array['solutionPdf','questions']||jsonb_build_object('questions',(select jsonb_agg(q.value-array['answer','acceptedAnswers','solution'] order by q.ordinality) from jsonb_array_elements(e->'questions') with ordinality q))$$;
create function public.mtm_hw_assignments(p_session text) returns jsonb language plpgsql security definer set search_path='' as $$declare sid uuid=mtm_hw_private.session_student(p_session);begin
 return (select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'title',a.exam->>'title','opensAt',a.opens_at,'dueAt',a.due_at,'durationMinutes',a.exam->'durationMinutes','month',a.month_key,'versionHash',a.version_hash,'questionCount',a.exam->'questionCount') order by a.due_at),'[]'::jsonb) from mtm_hw_private.assignments a join mtm_hw_private.students s on s.class_id=a.class_id where s.id=sid and a.visible);end $$;
create function mtm_hw_private.answers_valid(e jsonb,a jsonb) returns boolean language plpgsql immutable set search_path='' as $$declare q jsonb;v jsonb;k text;begin
 if a is null or jsonb_typeof(a) is distinct from 'object' or octet_length(a::text)>524288 then return false;end if;
 for k in select jsonb_object_keys(a) loop if not exists(select 1 from jsonb_array_elements(e->'questions') z where z->>'id'=k) then return false;end if;end loop;
 for q in select value from jsonb_array_elements(e->'questions') loop v=a->(q->>'id');if v is null or v='null'::jsonb then continue;end if;
 case q->>'kind' when 'mc' then if jsonb_typeof(v) is distinct from 'string' or v not in ('"A"'::jsonb,'"B"'::jsonb,'"C"'::jsonb,'"D"'::jsonb) then return false;end if;
 when 'tf' then if jsonb_typeof(v) is distinct from 'array' or jsonb_array_length(v)<>4 or exists(select 1 from jsonb_array_elements(v) x where jsonb_typeof(x) is distinct from 'boolean' and x<>'null'::jsonb) then return false;end if;
 when 'short' then if jsonb_typeof(v) is distinct from 'string' or length(v#>>'{}')+length(regexp_replace(v#>>'{}',U&'[^\+010000-\+10FFFF]','','g'))>500 then return false;end if;else return false;end case;end loop;return true;end $$;
create function mtm_hw_private.grade(e jsonb,a jsonb) returns jsonb language plpgsql immutable set search_path='' as $$
declare q jsonb;v jsonb;earned integer;total integer=0;maxp integer;correct_n integer;i integer;blank boolean;key text;status text;rows jsonb='[]';parts jsonb;begin
 if not mtm_hw_private.answers_valid(e,a) then raise exception 'Answers invalid';end if;
 for q in select value from jsonb_array_elements(e->'questions') loop v=a->(q->>'id');maxp=(q->>'maxMillipoints')::int;earned=0;correct_n=null;blank=(v is null or v='null'::jsonb or (jsonb_typeof(v)='string' and mtm_hw_private.js_trim(v#>>'{}')=''));
 if q->>'kind'='tf' then correct_n=0;if not blank then for i in 0..3 loop if v->i=q->'answer'->i then correct_n=correct_n+1;end if;end loop;blank=not exists(select 1 from jsonb_array_elements(v) x where x<>'null'::jsonb);end if;earned=(q->'pointsByCorrectCount'->>correct_n)::int;
 elsif not blank and q->>'kind'='mc' then if v=q->'answer' then earned=maxp;end if;
 elsif not blank then for key in select jsonb_array_elements_text(q->'acceptedAnswers') loop if mtm_hw_private.short_matches(q->>'mode',v#>>'{}',key) then earned=maxp;exit;end if;end loop;end if;
 total=total+earned;status=case when blank then 'blank' when earned=maxp then 'correct' when earned>0 then 'partial' else 'wrong' end;
 rows=rows||jsonb_build_array(jsonb_build_object('id',q->>'id','kind',q->>'kind','partId',q->>'partId','partLabel',q->>'partLabel','earnedMillipoints',earned,'maxMillipoints',maxp,'status',status,'correctCount',correct_n));end loop;
 select jsonb_agg(jsonb_build_object('id',part_id,'label',label,'earnedMillipoints',got,'maxMillipoints',cap) order by substring(part_id from 5)::int) into parts from(select x->>'partId' part_id,max(x->>'partLabel') label,sum((x->>'earnedMillipoints')::int) got,sum((x->>'maxMillipoints')::int) cap from jsonb_array_elements(rows)x group by x->>'partId')p;
 return jsonb_build_object('earnedMillipoints',total,'maxMillipoints',10000,'parts',parts,'rows',rows);end $$;
create function public.mtm_hw_start(p_session text,p_assignment uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare sid uuid=mtm_hw_private.session_student(p_session);a mtm_hw_private.assignments;t mtm_hw_private.attempts;now_t timestamptz=clock_timestamp();n integer;begin
 perform 1 from mtm_hw_private.students where id=sid for update;now_t=clock_timestamp();
 select x.* into a from mtm_hw_private.assignments x join mtm_hw_private.students s on s.class_id=x.class_id where x.id=p_assignment and s.id=sid and x.visible and now_t>=x.opens_at and now_t<x.due_at;
 if not found then raise exception 'Assignment unavailable' using errcode='42501';end if;
 select * into t from mtm_hw_private.attempts where student_id=sid and assignment_id=a.id and submitted_at is null;
 if not found then select coalesce(max(attempt_number),0)+1 into n from mtm_hw_private.attempts where student_id=sid and assignment_id=a.id;
 insert into mtm_hw_private.attempts(student_id,assignment_id,attempt_number,started_at,deadline) values(sid,a.id,n,now_t,least(a.due_at,now_t+make_interval(mins=>(a.exam->>'durationMinutes')::int))) returning * into t;end if;
 return jsonb_build_object('attemptId',t.id,'attemptNumber',t.attempt_number,'startedAt',t.started_at,'deadline',t.deadline,'serverNow',clock_timestamp(),'revision',t.revision,'answers',t.answers,'versionHash',a.version_hash,'exam',mtm_hw_private.public_exam(a.exam));end $$;
create function public.mtm_hw_save_answers(p_session text,p_attempt uuid,p_revision integer,p_answers jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare sid uuid=mtm_hw_private.session_student(p_session);t mtm_hw_private.attempts;e jsonb;begin
 select * into t from mtm_hw_private.attempts where id=p_attempt and student_id=sid for update;if not found then raise exception 'Attempt unavailable' using errcode='42501';end if;
 if t.submitted_at is not null or t.deadline<=clock_timestamp() then raise exception 'Attempt closed';end if;if t.revision is distinct from p_revision then raise exception 'Answers changed' using errcode='40001';end if;
 select exam into e from mtm_hw_private.assignments where id=t.assignment_id;if not mtm_hw_private.answers_valid(e,p_answers) then raise exception 'Answers invalid';end if;
 update mtm_hw_private.attempts set answers=p_answers,revision=revision+1 where id=t.id returning * into t;return jsonb_build_object('revision',t.revision,'answers',t.answers,'serverNow',clock_timestamp());end $$;
create function mtm_hw_private.result(t mtm_hw_private.attempts,a mtm_hw_private.assignments) returns jsonb language plpgsql stable set search_path='' as $$begin
 if t.submitted_at is null then raise exception 'Submit before viewing answers' using errcode='42501';end if;
 return jsonb_build_object('attemptId',t.id,'attemptNumber',t.attempt_number,'title',a.exam->>'title','versionHash',a.version_hash,'submittedAt',t.submitted_at,'elapsedMs',t.elapsed_ms,'qualifying',t.qualifying,'late',t.late,'score',t.score,'answers',t.answers,'reviewQuestions',a.exam->'questions','solutionPdf',a.exam->'solutionPdf');end $$;
create function public.mtm_hw_submit(p_session text,p_attempt uuid,p_revision integer,p_answers jsonb,p_submission_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare sid uuid=mtm_hw_private.session_student(p_session);t mtm_hw_private.attempts;a mtm_hw_private.assignments;now_t timestamptz;input_answers jsonb;qualified boolean;begin
 select * into t from mtm_hw_private.attempts where id=p_attempt and student_id=sid for update;if not found then raise exception 'Attempt unavailable' using errcode='42501';end if;
 select * into a from mtm_hw_private.assignments where id=t.assignment_id;
 if t.submitted_at is not null then return mtm_hw_private.result(t,a);end if;
 if p_submission_key is null then raise exception 'Submission identifier required';end if;if t.revision is distinct from p_revision then raise exception 'Answers changed' using errcode='40001';end if;
 now_t=clock_timestamp();input_answers=case when now_t>t.deadline then t.answers else p_answers end;
 if not mtm_hw_private.answers_valid(a.exam,input_answers) then raise exception 'Answers invalid';end if;
 qualified=a.rank_eligible and t.attempt_number=1 and now_t<=t.deadline and exists(select 1 from mtm_hw_private.memberships m where m.student_id=sid and m.class_id=a.class_id and m.joined_at<=a.opens_at and (m.left_at is null or m.left_at>=a.due_at));
 update mtm_hw_private.attempts set answers=input_answers,revision=revision+1,submitted_at=now_t,submission_key=p_submission_key,score=mtm_hw_private.grade(a.exam,input_answers),elapsed_ms=floor(extract(epoch from(least(now_t,t.deadline)-t.started_at))*1000)::bigint,qualifying=qualified,late=now_t>t.deadline where id=t.id returning * into t;
 return mtm_hw_private.result(t,a);end $$;
create function public.mtm_hw_result(p_session text,p_attempt uuid) returns jsonb language plpgsql security definer set search_path='' as $$declare sid uuid=mtm_hw_private.session_student(p_session);t mtm_hw_private.attempts;a mtm_hw_private.assignments;begin
 select * into t from mtm_hw_private.attempts where id=p_attempt and student_id=sid;if not found then raise exception 'Attempt unavailable' using errcode='42501';end if;select * into a from mtm_hw_private.assignments where id=t.assignment_id;return mtm_hw_private.result(t,a);end $$;
create function public.mtm_hw_history(p_session text) returns jsonb language plpgsql security definer set search_path='' as $$declare sid uuid=mtm_hw_private.session_student(p_session);begin
 return(select coalesce(jsonb_agg(z.item order by z.submitted_at desc),'[]'::jsonb) from(select t.submitted_at,jsonb_build_object('attemptId',t.id,'assignmentId',a.id,'title',a.exam->>'title','versionHash',a.version_hash,'attemptNumber',t.attempt_number,'submittedAt',t.submitted_at,'elapsedMs',t.elapsed_ms,'qualifying',t.qualifying,'late',t.late,'score',t.score) item from mtm_hw_private.attempts t join mtm_hw_private.assignments a on a.id=t.assignment_id where t.student_id=sid and t.submitted_at is not null order by t.submitted_at desc limit 100)z);end $$;
create function public.mtm_hw_pdf_access(p_session text,p_attempt uuid,p_kind text default 'questions') returns jsonb language plpgsql security definer set search_path='' as $$
declare sid uuid=mtm_hw_private.session_student(p_session);t mtm_hw_private.attempts;a mtm_hw_private.assignments;asset jsonb;begin
 if p_kind is null or p_kind not in ('questions','solutions') then raise exception 'PDF kind invalid' using errcode='22023';end if;
 select * into t from mtm_hw_private.attempts where id=p_attempt and student_id=sid;if not found then raise exception 'Attempt unavailable' using errcode='42501';end if;
 select * into a from mtm_hw_private.assignments where id=t.assignment_id;
 -- Historical class membership at server start preserves old own review after transfer.
 if not exists(select 1 from mtm_hw_private.memberships m where m.student_id=sid and m.class_id=a.class_id and m.joined_at<=t.started_at and(m.left_at is null or m.left_at>=t.started_at)) then raise exception 'Attempt class unavailable' using errcode='42501';end if;
 if p_kind='solutions' and t.submitted_at is null then raise exception 'Submit before viewing solutions' using errcode='42501';end if;
 asset=case when p_kind='questions' then a.exam->'questionPdf' else a.exam->'solutionPdf' end;
 if asset is null or asset='null'::jsonb then raise exception 'PDF unavailable' using errcode='P0002';end if;
 return jsonb_build_object('kind',p_kind,'attemptId',t.id,'assignmentId',a.id,'versionHash',a.version_hash,'asset',asset,'serverNow',clock_timestamp());end $$;
create function public.mtm_hw_leaderboard(p_class_id uuid,p_month text) returns jsonb language plpgsql security definer set search_path='' as $$begin
 if p_month is null or p_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then raise exception 'Month invalid';end if;
 if not exists(select 1 from mtm_hw_private.classes where id=p_class_id and active) then return '[]'::jsonb;end if;
 -- Each eligibility-set hash is a separate comparison cohort. Missing tasks score zero.
 return(with eligible as(select s.id,s.public_alias,a.id assignment_id,a.weight,coalesce((t.score->>'earnedMillipoints')::numeric/10000,0) fraction,t.id attempt_id,t.elapsed_ms from mtm_hw_private.students s join mtm_hw_private.memberships m on m.student_id=s.id join mtm_hw_private.assignments a on a.class_id=m.class_id and m.joined_at<=a.opens_at and(m.left_at is null or m.left_at>=a.due_at) left join mtm_hw_private.attempts t on t.student_id=s.id and t.assignment_id=a.id and t.qualifying and t.submitted_at is not null where a.class_id=p_class_id and a.month_key=p_month and a.rank_eligible),
 totals as(select id,public_alias,encode(sha256(convert_to(string_agg(assignment_id::text,',' order by assignment_id),'UTF8')),'hex') cohort,sum(weight*fraction)/sum(weight)*100 pct,count(*) assigned_count,count(attempt_id) completed_count,coalesce(sum(elapsed_ms),0) elapsed_ms from eligible group by id,public_alias),
 ranked as(select *,dense_rank()over(partition by cohort order by pct desc) rank_value,(select count(*) from mtm_hw_private.attempts t join mtm_hw_private.assignments a on a.id=t.assignment_id where t.student_id=totals.id and a.class_id=p_class_id and a.month_key=p_month and t.submitted_at is not null) attempt_count from totals)
 select coalesce(jsonb_agg(jsonb_build_object('alias',public_alias,'cohort',cohort,'rank',rank_value,'percentage',round(pct,4),'assignedCount',assigned_count,'completedCount',completed_count,'attemptCount',attempt_count,'elapsedMs',elapsed_ms) order by cohort,rank_value,public_alias),'[]'::jsonb) from ranked);end $$;

-- Private immutable bucket. No anon/student SELECT or automatic signed URL creation.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('mtm-homework','mtm-homework',false,15728640,array['application/pdf']);
create policy mtm_hw_pdf_insert on storage.objects for insert to authenticated with check(bucket_id='mtm-homework' and public.mtm_is_exam_admin() and name~('^'||auth.uid()::text||'/[0-9a-f-]{36}/[0-9a-f]{64}-(questions|solutions)[.]pdf$'));
create policy mtm_hw_pdf_admin_read on storage.objects for select to authenticated using(bucket_id='mtm-homework' and public.mtm_is_exam_admin() and split_part(name,'/',1)=auth.uid()::text);
-- Important: student PDF transport requires separate owner-reviewed gated signing/proxy.
-- Returning a path above does not grant Storage read access or prove a PDF opens.

-- Closed-by-default functions. Only the explicitly listed RPCs become callable.
do $$ declare f record;begin for f in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='mtm_hw_private' or(n.nspname='public' and p.proname like 'mtm_hw_%')loop execute format('revoke all on function %s from public,anon,authenticated,service_role',f.sig);end loop;end $$;
grant execute on function public.mtm_hw_admin_class(text,integer),public.mtm_hw_admin_student(uuid,uuid,text,text,text),public.mtm_hw_admin_issue_code(uuid,integer),public.mtm_hw_admin_revoke_code(uuid),public.mtm_hw_admin_list(text,integer,integer),public.mtm_hw_admin_save_draft(uuid,integer,jsonb),public.mtm_hw_admin_assign(uuid,integer,uuid,timestamptz,timestamptz,integer,boolean),public.mtm_hw_admin_visibility(uuid,boolean) to authenticated;
grant execute on function public.mtm_hw_gateway_rate(text),public.mtm_hw_resolve_code(text),public.mtm_hw_confirm(text,boolean),public.mtm_hw_me(text),public.mtm_hw_logout(text),public.mtm_hw_assignments(text),public.mtm_hw_start(text,uuid),public.mtm_hw_save_answers(text,uuid,integer,jsonb),public.mtm_hw_submit(text,uuid,integer,jsonb,uuid),public.mtm_hw_result(text,uuid),public.mtm_hw_history(text),public.mtm_hw_pdf_access(text,uuid,text) to service_role;
grant execute on function public.mtm_hw_leaderboard(uuid,text) to anon,authenticated,service_role;
commit;

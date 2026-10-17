-- PENDING, CHƯA ÁP DỤNG DB. Hồ sơ công khai được Thành giao ngày 17/10/2026.
-- Chạy sau 202610170010_student_appearance.sql và toàn bộ migration BTVN đến 024.
-- Không đổi cách đăng nhập, cách tính điểm 024 hoặc phạm vi quyền hiện có.
begin;

-- Cùng giới hạn JPEG 192x192, tối đa 40000 ký tự như avatar-http.ts.
-- Kiểm cấu trúc JPEG, SOF, SOS, EOI; không chỉ kiểm MIME do client khai báo.
create or replace function mtm_hw_private.valid_public_photo(p_photo text)
returns boolean language plpgsql immutable set search_path='' as $$
declare data text; bytes bytea; n integer; i integer=2; marker integer; len integer;
  width integer; height integer; components integer; seen_size boolean=false;
begin
 if p_photo='' then return true;end if;
 if p_photo is null or char_length(p_photo)>40000 or p_photo !~ '^data:image/jpeg;base64,/9j/[A-Za-z0-9+/]+={0,2}$' then return false;end if;
 data=substr(p_photo,24);
 if length(data)%4<>0 then return false;end if;
 begin bytes=decode(data,'base64');exception when others then return false;end;
 if replace(encode(bytes,'base64'),E'\n','')<>data then return false;end if;
 n=octet_length(bytes);
 if n<4 or get_byte(bytes,0)<>255 or get_byte(bytes,1)<>216 or get_byte(bytes,n-2)<>255 or get_byte(bytes,n-1)<>217 then return false;end if;
 while i<n loop
  if get_byte(bytes,i)<>255 then return false;end if;
  while i<n and get_byte(bytes,i)=255 loop i=i+1;end loop;
  if i>=n then return false;end if;
  marker=get_byte(bytes,i);i=i+1;
  if marker in(0,216,217) then return false;end if;
  if marker=1 or marker between 208 and 215 then continue;end if;
  if i+2>n then return false;end if;
  len=get_byte(bytes,i)*256+get_byte(bytes,i+1);
  if len<2 or i+len>n then return false;end if;
  if marker between 192 and 207 and marker not in(196,200,204) then
   if seen_size or len<8 then return false;end if;
   height=get_byte(bytes,i+3)*256+get_byte(bytes,i+4);
   width=get_byte(bytes,i+5)*256+get_byte(bytes,i+6);components=get_byte(bytes,i+7);
   if components=0 or len<>8+3*components then return false;end if;
   seen_size=true;
  end if;
  if marker=218 then return seen_size and width=192 and height=192;end if;
  i=i+len;
 end loop;
 return false;
end$$;
revoke all on function mtm_hw_private.valid_public_photo(text) from public,anon,authenticated,service_role,mtm_btvn_publisher;

create or replace function mtm_hw_private.public_school(p_school text)
returns text language sql immutable set search_path='' as $$
 select case when p_school ~ '[[:cntrl:]]' or lower(x.value) in('chưa cập nhật','chua cap nhat') then null
  else nullif(left(x.value,160),'') end
 from(select btrim(regexp_replace(normalize(coalesce(p_school,''),NFC),'\s+',' ','g')) value)x
$$;
revoke all on function mtm_hw_private.public_school(text) from public,anon,authenticated,service_role,mtm_btvn_publisher;

alter table mtm_hw_private.student_appearance add column photo_hidden boolean not null default false;
-- NOT VALID giữ các ảnh legacy để operator có thể xử lý; mọi ghi mới phải đạt.
-- Ảnh legacy không hợp lệ được lọc ngay ở profile/rank, không gửi xuống trình duyệt.
alter table mtm_hw_private.student_appearance add constraint student_appearance_public_photo_check
 check(photo_hidden or mtm_hw_private.valid_public_photo(photo)) not valid;
revoke all on table mtm_hw_private.student_appearance from public,anon,authenticated,service_role,mtm_btvn_publisher;

create or replace function mtm_hw_private.appearance_json(r mtm_hw_private.student_appearance)
returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('profileKey',r.profile_key::text,'revision',r.revision,
  'school',coalesce(mtm_hw_private.public_school(r.school),mtm_hw_private.public_school(s.school),''),
  'photoHidden',r.photo_hidden,
  'appearance',jsonb_build_object('avatar',r.avatar,'photo',case when not r.photo_hidden and mtm_hw_private.valid_public_photo(r.photo) then r.photo else '' end))
 from mtm_hw_private.students s where s.id=r.student_id
$$;
revoke all on function mtm_hw_private.appearance_json(mtm_hw_private.student_appearance) from public,anon,authenticated,service_role,mtm_btvn_publisher;

create or replace function public.mtm_btvn_appearance_save(p_session text,p_revision integer,p_avatar text,p_photo text,p_school text,p_profile_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_student uuid=mtm_hw_private.btvn_student(p_session);v_row mtm_hw_private.student_appearance;
begin
 if v_student is null then raise exception 'session' using errcode='42501';end if;
 if p_revision is null or p_revision<0 or p_avatar is null or p_photo is null or p_school is null or p_profile_key is null
  or not mtm_hw_private.valid_public_photo(p_photo) or char_length(p_school)>160 or p_school ~ '[[:cntrl:]]' then
  raise exception 'input' using errcode='22023';end if;
 insert into mtm_hw_private.student_appearance(student_id) values(v_student) on conflict(student_id) do nothing;
 select * into strict v_row from mtm_hw_private.student_appearance where student_id=v_student for update;
 if v_row.profile_key<>p_profile_key or v_row.revision<>p_revision then raise exception 'revision' using errcode='40001';end if;
 -- Không nhận/cập nhật photo_hidden từ học sinh. Cờ do giáo vụ giữ qua mọi lần lưu.
 update mtm_hw_private.student_appearance set revision=revision+1,avatar=p_avatar,
  photo=case when photo_hidden and p_photo='' then photo else p_photo end,
  school=coalesce(mtm_hw_private.public_school(p_school),''),updated_at=now()
  where student_id=v_student returning * into v_row;
 return mtm_hw_private.appearance_json(v_row);
end$$;
revoke all on function public.mtm_btvn_appearance_save(text,integer,text,text,text,uuid) from public,anon,authenticated,mtm_btvn_publisher;
grant execute on function public.mtm_btvn_appearance_save(text,integer,text,text,text,uuid) to service_role;

-- Giáo vụ chỉ ẩn/hiện ảnh học sinh thuộc owner của tài khoản quản trị thật.
-- Không cấp service_role/publisher đường tắt để đổi cờ bằng payload học sinh.
create function public.mtm_btvn_photo_moderate(p_student uuid,p_hidden boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare own uuid=mtm_hw_private.admin_id();v_row mtm_hw_private.student_appearance;
begin
 if p_hidden is null then raise exception 'input' using errcode='22023';end if;
 perform 1 from mtm_hw_private.students where id=p_student and owner_id=own for update;
 if not found then raise exception 'Student unavailable' using errcode='42501';end if;
 insert into mtm_hw_private.student_appearance(student_id) values(p_student) on conflict(student_id) do nothing;
 select * into strict v_row from mtm_hw_private.student_appearance where student_id=p_student for update;
 if not p_hidden and not mtm_hw_private.valid_public_photo(v_row.photo) then raise exception 'photo' using errcode='22023';end if;
 update mtm_hw_private.student_appearance set photo_hidden=p_hidden,revision=revision+1,updated_at=now()
  where student_id=p_student returning * into v_row;
 return jsonb_build_object('ok',true,'photoHidden',v_row.photo_hidden,'revision',v_row.revision);
end$$;
revoke all on function public.mtm_btvn_photo_moderate(uuid,boolean) from public,anon,authenticated,service_role,mtm_btvn_publisher;
grant execute on function public.mtm_btvn_photo_moderate(uuid,boolean) to authenticated;

-- Chỉ trạng thái kiểm duyệt của tối đa 100 hồ sơ đúng owner, không trả ảnh/SDT.
create function public.mtm_btvn_photo_status(p_students uuid[])
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare own uuid=mtm_hw_private.admin_id();items jsonb;
begin
 if p_students is null or cardinality(p_students)>100 or array_ndims(p_students)>1
  or array_position(p_students,null) is not null
  or (select count(distinct id) from unnest(p_students) id)<>cardinality(p_students) then
  raise exception 'input' using errcode='22023';end if;
 if exists(select 1 from unnest(p_students) x(id) where not exists(
  select 1 from mtm_hw_private.students s where s.id=x.id and s.owner_id=own)) then
  raise exception 'Student unavailable' using errcode='42501';end if;
 select coalesce(jsonb_agg(jsonb_build_object('studentId',x.id,'photoHidden',coalesce(a.photo_hidden,false)) order by x.ord),'[]') into items
 from unnest(p_students) with ordinality x(id,ord) left join mtm_hw_private.student_appearance a on a.student_id=x.id;
 return jsonb_build_object('items',items);
end$$;
revoke all on function public.mtm_btvn_photo_status(uuid[]) from public,anon,authenticated,service_role,mtm_btvn_publisher;
grant execute on function public.mtm_btvn_photo_status(uuid[]) to authenticated;

-- Giữ nguyên cách tính điểm từ migration 024.
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
  select a.*,best.score,best.at,coalesce(w.next_actual_class_at,w.expected_due_at,mtm_hw_private.btvn_planned_due(a.label,a.lesson_day)) due_at from assigned a
  left join mtm_hw_private.btvn_work w on w.student_id=a.id and w.lesson_code=a.code
  left join lateral (select (r->>'score')::numeric score,(r->>'submittedAt')::numeric at from jsonb_array_elements(coalesce(w.receipts,'[]')) r
    where (r->>'submittedAt')::numeric>=extract(epoch from '2026-10-15 00:00:00+07'::timestamptz)*1000
    and not exists(select 1 from mtm_hw_private.btvn_rank_exclusions e where e.student_id=a.id and e.lesson_code=a.code)
    order by (r->>'score')::numeric desc,(r->>'submittedAt')::numeric asc limit 1) best on true
  where a.lesson_day>=greatest(lo,'2026-10-15'::date) and a.lesson_day<hi
 ), homework as (
  select id,full_name,label,avg(coalesce(score,0)) score,count(score)::integer submitted,count(*)::integer total,max(at) at
  from scored where kind='btvn' and (score is not null or due_at is null or due_at<=current_timestamp) group by id,full_name,label having count(score)>0
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

-- Giữ mã, owner lock, dry-run và quyền từ RPC 010.
create or replace function public.mtm_btvn_sync_roster(p_payload jsonb,p_apply boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare cfg mtm_hw_private.btvn_roster_scope; r jsonb;c jsonb;s mtm_hw_private.students;
 cid uuid;sid uuid;prior uuid;n integer;ident text;issue jsonb;out_rows jsonb='[]';class_rows jsonb='[]';
 added integer=0;changed integer=0;unchanged integer=0;classes_added integer=0;skipped integer=0;codes_added integer=0;
 summary jsonb;ids text[]='{}';student_ids uuid[]='{}';old_sub text;old_claims text;new_school text;
begin
 if p_apply is null or jsonb_typeof(p_payload) is distinct from 'object' or octet_length(p_payload::text)>10485760 then raise exception 'Invalid sync';end if;
 select * into cfg from mtm_hw_private.btvn_roster_scope where singleton;
 if not found or p_payload->>'sheetId' is distinct from cfg.sheet_id or p_payload->>'sheetHash' is distinct from encode(sha256(convert_to(cfg.sheet_id,'UTF8')),'hex') or p_payload->>'legacyReconciled' is distinct from 'true' or not exists(select 1 from public.mtm_exam_admins where user_id=cfg.owner_id) then raise exception 'Reconciled scope required' using errcode='42501';end if;
 if (select count(*) from mtm_hw_private.students where id=any(cfg.protected_student_ids) and owner_id=cfg.owner_id)<>2 then raise exception 'Protected fixtures required';end if;
 if jsonb_typeof(p_payload->'students') is distinct from 'array' or jsonb_array_length(p_payload->'students')=0 or jsonb_array_length(p_payload->'students')>10000 or jsonb_typeof(p_payload->'classes') is distinct from 'array' or jsonb_array_length(p_payload->'classes')=0 then raise exception 'Invalid roster';end if;
 perform pg_advisory_xact_lock(hashtextextended('btvn-roster:'||cfg.owner_id::text,0));
 old_sub=current_setting('request.jwt.claim.sub',true);old_claims=current_setting('request.jwt.claims',true);
 -- Subtransaction cho dry-run: toàn bộ thay đổi được rollback, kể cả mã/membership.
 begin
  for c in select value from jsonb_array_elements(p_payload->'classes') loop
   if not mtm_hw_private.valid_text(c->>'label',100) or c->>'grade' is null or (c->>'grade')::integer not between 6 and 12 then raise exception 'Invalid class';end if;
   if exists(select 1 from jsonb_array_elements(p_payload->'classes')x where x->>'label'=c->>'label' group by x->>'label' having count(*)>1) then raise exception 'Duplicate class';end if;
   select count(*),(array_agg(id))[1] into n,cid from mtm_hw_private.classes where owner_id=cfg.owner_id and label=c->>'label';
   if n>1 then raise exception 'Ambiguous class';end if;
   if n=0 then insert into mtm_hw_private.classes(owner_id,label,grade) values(cfg.owner_id,c->>'label',(c->>'grade')::integer) returning id into cid;classes_added=classes_added+1;
   else
    -- Không sửa lớp chứa fixture cũ (kể cả grade/active).
    if exists(select 1 from mtm_hw_private.students where id=any(cfg.protected_student_ids) and class_id=cid) then raise exception 'Protected fixture class';end if;
    update mtm_hw_private.classes set grade=(c->>'grade')::integer,active=true where id=cid;
   end if;
   class_rows=class_rows||jsonb_build_array(jsonb_build_object('label',c->>'label','id',cid));
  end loop;
  for r in select value from jsonb_array_elements(p_payload->'students') loop
   ident=r->>'sourceIdentity';
   if ident is null or r->>'proposedCode' is null or r->>'proposedCode' !~ '^HS-[0-9A-F]{32}$' or ident is distinct from 'btvn:'||(p_payload->>'sheetHash')||':'||encode(sha256(convert_to(r->>'proposedCode','UTF8')),'hex') or ident=any(ids) or not mtm_hw_private.valid_text(r->>'fullName',200) or (nullif(r->>'parentName','') is not null and not mtm_hw_private.valid_text(r->>'parentName',200)) or not mtm_hw_private.valid_text(r->>'cohort',40) or coalesce(r->>'phone','') !~ '^(0[0-9]{9})?$' or coalesce(r->>'parentPhone','') !~ '^(0[0-9]{9})?$' or coalesce(r->>'phone','')||coalesce(r->>'parentPhone','')='' then raise exception 'Invalid identity';end if;
   if r ? 'school' and (jsonb_typeof(r->'school') is distinct from 'string' or char_length(r->>'school')>160 or r->>'school' ~ '[[:cntrl:]]') then raise exception 'Invalid school';end if;
   new_school=mtm_hw_private.public_school(r->>'school');
   ids=array_append(ids,ident);
   select (x->>'id')::uuid into cid from jsonb_array_elements(class_rows)x where x->>'label'=r->>'className';
   if cid is null then raise exception 'Class missing';end if;
   select * into s from mtm_hw_private.students where source_identity=ident for update;
   sid=s.id;
   if sid is not null and s.owner_id<>cfg.owner_id then raise exception 'Foreign identity' using errcode='42501';end if;
   if r->>'studentId' is not null then
    prior=(r->>'studentId')::uuid;
    if sid is not null and sid<>prior then raise exception 'Mapping conflict';end if;
    select * into s from mtm_hw_private.students where id=prior and owner_id=cfg.owner_id for update;
    if not found or s.source_identity is not null and s.source_identity<>ident then raise exception 'Legacy mapping unavailable';end if;
    sid=s.id;
   end if;
   if sid=any(cfg.protected_student_ids) or sid=any(student_ids) then raise exception 'Protected or duplicate mapped student';end if;
   if sid is null then
    insert into mtm_hw_private.students(owner_id,class_id,full_name,school,school_class,public_alias,student_phone,parent_phone,parent_name,cohort,source_identity)
    values(cfg.owner_id,cid,r->>'fullName',coalesce(new_school,'Chưa cập nhật'),'Chưa cập nhật','MTM-'||upper(left(replace(gen_random_uuid()::text,'-',''),12)),r->>'phone',r->>'parentPhone',nullif(r->>'parentName',''),r->>'cohort',ident) returning id into sid;
    added=added+1;
   else
    -- Chỉ bổ sung trường chưa có; không đổi trường đã lưu hoặc trường em tự nhập.
    new_school=case when mtm_hw_private.public_school(s.school) is null and not exists(
      select 1 from mtm_hw_private.student_appearance a where a.student_id=sid and mtm_hw_private.public_school(a.school) is not null
    ) then coalesce(new_school,s.school) else s.school end;
    if (s.class_id,s.full_name,s.student_phone,s.parent_phone,s.parent_name,s.cohort,s.source_identity,s.active,s.school) is distinct from (cid,r->>'fullName',r->>'phone',r->>'parentPhone',nullif(r->>'parentName',''),r->>'cohort',ident,true,new_school) then changed=changed+1;else unchanged=unchanged+1;end if;
    update mtm_hw_private.students set class_id=cid,full_name=r->>'fullName',school=new_school,student_phone=r->>'phone',parent_phone=r->>'parentPhone',parent_name=nullif(r->>'parentName',''),cohort=r->>'cohort',source_identity=ident,active=true where id=sid;
   end if;
   student_ids=array_append(student_ids,sid);
   if exists(select 1 from mtm_hw_private.memberships where student_id=sid and left_at is null and class_id<>cid) then update mtm_hw_private.memberships set left_at=clock_timestamp() where student_id=sid and left_at is null;end if;
   if not exists(select 1 from mtm_hw_private.memberships where student_id=sid and left_at is null) then insert into mtm_hw_private.memberships(student_id,class_id) values(sid,cid);end if;
   -- Chỉ gọi hàm giữ mã cũ cho người CHƯA từng có mã; không dùng issue_code cũ.
   issue='{"preserved":true}'::jsonb;
   if not exists(select 1 from mtm_hw_private.codes where student_id=sid) then
    perform set_config('request.jwt.claim.sub',cfg.owner_id::text,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',cfg.owner_id,'role','authenticated')::text,true);
    issue=mtm_hw_private.btvn_issue_import_code(sid,r->>'proposedCode');codes_added=codes_added+1;
   elsif exists(select 1 from mtm_hw_private.codes where student_id=sid and digest=mtm_hw_private.token_digest('code',lower(substr(r->>'proposedCode',4)))) then
    issue=jsonb_build_object('preserved',true,'code',r->>'proposedCode');
   end if;
   out_rows=out_rows||jsonb_build_array(jsonb_build_object('sourceIdentity',ident,'studentId',sid,'fullName',r->>'fullName','className',r->>'className','cohort',r->>'cohort','code',issue->>'code','preserved',issue->'preserved'));
  end loop;
  select count(*) into skipped from mtm_hw_private.students where owner_id=cfg.owner_id and source_identity like 'btvn:'|| (p_payload->>'sheetHash') ||':%' and not(source_identity=any(ids)) and not(id=any(cfg.protected_student_ids));
  update mtm_hw_private.btvn_roster_scope set synced_class_ids=(select array_agg((x->>'id')::uuid) from jsonb_array_elements(class_rows)x) where singleton;
  summary=jsonb_build_object('classes',jsonb_array_length(class_rows),'classesAdded',classes_added,'added',added,'updated',changed,'unchanged',unchanged,'skipped',skipped,'excluded',coalesce((p_payload->>'excluded')::integer,0),'codesAdded',codes_added,'removed',0,'applied',p_apply);
  if not p_apply then raise exception 'Dry rollback' using errcode='PZ001';end if;
 exception when sqlstate 'PZ001' then
  if p_apply then raise;end if;
 end;
 perform set_config('request.jwt.claim.sub',coalesce(old_sub,''),true);
 perform set_config('request.jwt.claims',coalesce(old_claims,''),true);
 if not p_apply then return jsonb_build_object('summary',summary);end if;
 return jsonb_build_object('summary',summary,'classes',class_rows,'students',out_rows);
end$$;
revoke all on function public.mtm_btvn_sync_roster(jsonb,boolean) from public,anon,authenticated,mtm_btvn_publisher;
grant execute on function public.mtm_btvn_sync_roster(jsonb,boolean) to service_role;


alter table mtm_hw_private.attendance_roster add column school text not null default ''
 check(char_length(school)<=160 and school !~ '[[:cntrl:]]');

create or replace function public.mtm_btvn_sync_attendance_roster(p_payload jsonb,p_apply boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare n integer;bad integer;
begin
 if p_apply is null or jsonb_typeof(p_payload) is distinct from 'object' or jsonb_typeof(p_payload->'rows') is distinct from 'array'
  or jsonb_array_length(p_payload->'rows')>10000 or octet_length(p_payload::text)>10485760 then raise exception 'Invalid roster';end if;
 select count(*),count(*) filter(where
  not exists(select 1 from mtm_hw_private.classes c where c.label=r->>'label' and c.active)
  or mtm_hw_private.btvn_phone2(r->>'phone') !~ '^0[0-9]{9}$' or length(mtm_hw_private.btvn_fold(r->>'fullName'))<2
  or (r ? 'school' and (jsonb_typeof(r->'school') is distinct from 'string' or char_length(r->>'school')>160 or r->>'school' ~ '[[:cntrl:]]')))
 into n,bad from jsonb_array_elements(p_payload->'rows') r;
 if not p_apply then return jsonb_build_object('ok',true,'rows',n,'invalid',bad,'applied',false);end if;
 delete from mtm_hw_private.attendance_roster;
 insert into mtm_hw_private.attendance_roster(label,full_name,phone,source,school)
 select r->>'label',btrim(r->>'fullName'),mtm_hw_private.btvn_phone2(r->>'phone'),coalesce(r->>'source',''),coalesce(mtm_hw_private.public_school(r->>'school'),'')
 from jsonb_array_elements(p_payload->'rows') r
 where exists(select 1 from mtm_hw_private.classes c where c.label=r->>'label' and c.active)
  and mtm_hw_private.btvn_phone2(r->>'phone') ~ '^0[0-9]{9}$' and length(mtm_hw_private.btvn_fold(r->>'fullName'))>=2
  and (not(r ? 'school') or (jsonb_typeof(r->'school')='string' and char_length(r->>'school')<=160 and r->>'school' !~ '[[:cntrl:]]'));
 -- Chỉ ghép đúng tên, SĐT, lớp; xung đột nhiều trường thì chờ đối soát.
 with candidates as (
  select s.id,min(r.school) school from mtm_hw_private.students s join mtm_hw_private.classes c on c.id=s.class_id
  join mtm_hw_private.attendance_roster r on r.label=c.label
   and mtm_hw_private.btvn_fold(r.full_name)=mtm_hw_private.btvn_fold(s.full_name)
   and mtm_hw_private.btvn_phone2(r.phone) in(mtm_hw_private.btvn_phone2(s.student_phone),mtm_hw_private.btvn_phone2(s.parent_phone))
  where mtm_hw_private.public_school(s.school) is null and r.school<>''
   and not exists(select 1 from mtm_hw_private.student_appearance a where a.student_id=s.id and mtm_hw_private.public_school(a.school) is not null)
  group by s.id having count(distinct r.school)=1
 ) update mtm_hw_private.students s set school=c.school from candidates c where s.id=c.id;
 delete from mtm_hw_private.support_events where created_at<now()-interval '30 days';
 return jsonb_build_object('ok',true,'rows',n,'invalid',bad,'applied',true);
end$$;
revoke all on function public.mtm_btvn_sync_attendance_roster(jsonb,boolean) from public,anon,authenticated;
grant execute on function public.mtm_btvn_sync_attendance_roster(jsonb,boolean) to service_role;

-- Giữ cơ chế tự bổ sung người thiếu trong roster, mang theo trường đã xác minh.
create or replace function mtm_hw_private.btvn_auto_add_from_attendance(p_full_name text,p_phone text,p_class_name text)
returns uuid language plpgsql security definer set search_path='' as $$
declare people integer;lbl text;nm text;ph text;cid uuid;own uuid;sid uuid;school_name text;
begin
 with m as (
  select r.* from mtm_hw_private.attendance_roster r
  where mtm_hw_private.btvn_phone2(r.phone)=mtm_hw_private.btvn_phone2(p_phone)
   and (mtm_hw_private.btvn_fold(r.full_name)=mtm_hw_private.btvn_fold(p_full_name)
    or mtm_hw_private.btvn_fold(r.full_name) like '% '||mtm_hw_private.btvn_fold(p_full_name))
 ) select count(distinct mtm_hw_private.btvn_fold(full_name)),
  coalesce((array_agg(label) filter(where mtm_hw_private.btvn_name(label)=mtm_hw_private.btvn_name(p_class_name)))[1],
   (array_agg(label) filter(where substring(lower(label) from '^2k[0-9]+')=substring(lower(p_class_name) from '^2k[0-9]+')))[1],(array_agg(label order by id))[1]),
  (array_agg(full_name order by id))[1],(array_agg(phone order by id))[1]
 into people,lbl,nm,ph from m;
 if people is distinct from 1 then return null;end if;
 if exists(select 1 from mtm_hw_private.students s where mtm_hw_private.btvn_phone2(ph) in(mtm_hw_private.btvn_phone2(s.student_phone),mtm_hw_private.btvn_phone2(s.parent_phone))
  and mtm_hw_private.btvn_fold(s.full_name)=mtm_hw_private.btvn_fold(nm)) then return null;end if;
 select c.id into cid from mtm_hw_private.classes c where c.label=lbl and c.active;
 select s.owner_id into own from mtm_hw_private.students s where s.owner_id is not null limit 1;
 if cid is null or own is null then return null;end if;
 select case when count(distinct r.school)=1 then min(r.school) else null end into school_name
 from mtm_hw_private.attendance_roster r where r.label=lbl and mtm_hw_private.btvn_phone2(r.phone)=mtm_hw_private.btvn_phone2(ph)
  and mtm_hw_private.btvn_fold(r.full_name)=mtm_hw_private.btvn_fold(nm) and r.school<>'';
 insert into mtm_hw_private.students(owner_id,class_id,full_name,school,school_class,public_alias,active,student_phone,cohort,source_identity)
 values(own,cid,normalize(btrim(regexp_replace(nm,'\s*[\(\[].*$','')),NFC),coalesce(school_name,'Chưa cập nhật'),'Chưa cập nhật',
  'MTM-'||upper(substr(md5(random()::text||ph),1,12)),true,ph,split_part(lbl,' ',1),'diem-danh-tu-dong:'||md5(lbl||ph||clock_timestamp()::text)) returning id into sid;
 insert into mtm_hw_private.memberships(student_id,class_id) values(sid,cid);
 insert into mtm_hw_private.support_events(kind,class_name,full_name,phone,student_id) values('tu_dong_them',lbl,nm,ph,sid);
 return sid;
end$$;
revoke all on function mtm_hw_private.btvn_auto_add_from_attendance(text,text,text) from public,anon,authenticated;

commit;

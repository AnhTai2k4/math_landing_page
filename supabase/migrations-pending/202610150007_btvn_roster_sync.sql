-- ĐỢT 10: CHƯA ÁP DỤNG. Review riêng sau 005/006, không chạy hàng loạt.
begin;
-- DB URL mặc định dùng postgres; cần quyền SET role, không dùng JWT ký tay.
-- Operator kiểm principal thật trước áp; không cấp publisher thêm quyền bảng.
grant mtm_btvn_publisher to postgres;
-- Lớp THCS của nguồn roster; grade do operator xác minh, không suy từ tên.
alter table mtm_hw_private.classes drop constraint classes_grade_check;
alter table mtm_hw_private.classes add constraint classes_grade_check check(grade between 6 and 12);
create table mtm_hw_private.btvn_roster_scope(
 singleton boolean primary key default true check(singleton),
 owner_id uuid not null references auth.users(id),sheet_id text not null check(length(sheet_id) between 1 and 200),
 protected_student_ids uuid[] not null check(cardinality(protected_student_ids)=2 and protected_student_ids[1]<>protected_student_ids[2]),
 synced_class_ids uuid[] not null default '{}'
);
alter table mtm_hw_private.btvn_roster_scope enable row level security;
revoke all on mtm_hw_private.btvn_roster_scope from public,anon,authenticated,service_role,mtm_btvn_publisher;
-- Mã đề xuất đã lưu bền trong bundle/INTENT trước RPC, tránh mất mã khi timeout.
create function mtm_hw_private.btvn_issue_import_code(p_student_id uuid,p_code text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid=mtm_hw_private.admin_id();raw text;
begin
 if p_code is null or p_code !~ '^HS-[0-9A-F]{32}$' then raise exception 'Code invalid';end if;
 raw=lower(substr(p_code,4));
 perform 1 from mtm_hw_private.students where id=p_student_id and owner_id=u and active for update;
 if not found then raise exception 'Student unavailable';end if;
 if exists(select 1 from mtm_hw_private.codes where student_id=p_student_id) then return '{"preserved":true}'::jsonb;end if;
 insert into mtm_hw_private.codes(student_id,digest,issued_by,expires_at) values(p_student_id,mtm_hw_private.token_digest('code',raw),u,clock_timestamp()+interval '90 days');
 return jsonb_build_object('code',p_code,'preserved',false);
end$$;
revoke all on function mtm_hw_private.btvn_issue_import_code(uuid,text) from public,anon,authenticated,service_role,mtm_btvn_publisher;
create function public.mtm_btvn_sync_roster(p_payload jsonb,p_apply boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare cfg mtm_hw_private.btvn_roster_scope; r jsonb;c jsonb;s mtm_hw_private.students;
 cid uuid;sid uuid;prior uuid;n integer;ident text;issue jsonb;out_rows jsonb='[]';class_rows jsonb='[]';
 added integer=0;changed integer=0;unchanged integer=0;classes_added integer=0;skipped integer=0;codes_added integer=0;
 summary jsonb;ids text[]='{}';student_ids uuid[]='{}';old_sub text;old_claims text;
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
   if ident is null or r->>'proposedCode' is null or r->>'proposedCode' !~ '^HS-[0-9A-F]{32}$' or ident is distinct from 'btvn:'||(p_payload->>'sheetHash')||':'||encode(sha256(convert_to(r->>'proposedCode','UTF8')),'hex') or ident=any(ids) or not mtm_hw_private.valid_text(r->>'fullName',200) or not mtm_hw_private.valid_text(r->>'cohort',40) or coalesce(r->>'phone','') !~ '^(0[0-9]{9})?$' or coalesce(r->>'parentPhone','') !~ '^(0[0-9]{9})?$' or coalesce(r->>'phone','')||coalesce(r->>'parentPhone','')='' then raise exception 'Invalid identity';end if;
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
    insert into mtm_hw_private.students(owner_id,class_id,full_name,school,school_class,public_alias,student_phone,parent_phone,cohort,source_identity)
    values(cfg.owner_id,cid,r->>'fullName','Chưa cập nhật','Chưa cập nhật','MTM-'||upper(left(replace(gen_random_uuid()::text,'-',''),12)),r->>'phone',r->>'parentPhone',r->>'cohort',ident) returning id into sid;
    added=added+1;
   else
    if (s.class_id,s.full_name,s.student_phone,s.parent_phone,s.cohort,s.source_identity,s.active) is distinct from (cid,r->>'fullName',r->>'phone',r->>'parentPhone',r->>'cohort',ident,true) then changed=changed+1;else unchanged=unchanged+1;end if;
    update mtm_hw_private.students set class_id=cid,full_name=r->>'fullName',student_phone=r->>'phone',parent_phone=r->>'parentPhone',cohort=r->>'cohort',source_identity=ident,active=true where id=sid;
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
-- Scope xuất bản chỉ đọc lớp, không đọc roster; thu hẹp đúng các tên đã đồng bộ.
create function public.mtm_btvn_configure_publish_scope(p_labels text[],p_apply boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare cfg mtm_hw_private.btvn_roster_scope;ids uuid[];n integer;
begin
 select * into cfg from mtm_hw_private.btvn_roster_scope where singleton;
 if not found or p_apply is null or p_labels is null or cardinality(p_labels)<>2 or not(p_labels @> array['2K9 9+','2K9 8+']::text[]) then raise exception 'Scope invalid';end if;
 select count(*),array_agg(id order by label) into n,ids from mtm_hw_private.classes where owner_id=cfg.owner_id and active and label=any(p_labels) and id=any(cfg.synced_class_ids);
 if n<>2 then raise exception 'Classes missing or ambiguous';end if;
 if p_apply then
  if exists(select 1 from mtm_hw_private.btvn_publish_scope where owner_id<>cfg.owner_id) then raise exception 'Foreign publisher owner';end if;
  insert into mtm_hw_private.btvn_publish_scope values(true,cfg.owner_id,ids) on conflict(singleton) do update set class_ids=excluded.class_ids;
 end if;
 return jsonb_build_object('applied',p_apply,'classes',2,'classIds',ids);
end$$;
revoke all on function public.mtm_btvn_configure_publish_scope(text[],boolean) from public,anon,authenticated,mtm_btvn_publisher;
grant execute on function public.mtm_btvn_configure_publish_scope(text[],boolean) to service_role;
commit;

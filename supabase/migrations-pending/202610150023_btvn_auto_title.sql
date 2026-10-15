-- Đợt 25: CHƯA ÁP DỤNG. Sau 022, chỉ thêm provenance của tên buổi.
begin;
create or replace function public.mtm_btvn_pipeline(p_action text,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare scope mtm_hw_private.btvn_publish_scope;l mtm_hw_private.btvn_lessons;patch jsonb=p_payload->'material';k text;v jsonb;result jsonb;
begin
 if p_action is distinct from 'update_material' then return public.mtm_btvn_pipeline_before_class_open(p_action,p_payload);end if;
 if p_payload is null or octet_length(p_payload::text)>1048576 or coalesce(p_payload->>'lesson_key','')!~'^[a-z0-9-]{1,160}$'
  or jsonb_typeof(patch) is distinct from 'object' or patch='{}' or exists(select 1 from jsonb_object_keys(p_payload) x where x not in ('lesson_key','material')) then raise exception 'Invalid material update';end if;
 select * into scope from mtm_hw_private.btvn_publish_scope where singleton;
 if not found then raise exception 'Publisher scope missing' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('btvn-publish:'||(p_payload->>'lesson_key'),0));
 select * into l from mtm_hw_private.btvn_lessons where code=p_payload->>'lesson_key' for update;
 if not found or not l.active or l.publish_status<>'da_dang' then raise exception 'Published lesson required';end if;
 if l.owner_id<>scope.owner_id or not l.class_ids<@scope.class_ids or exists(select 1 from unnest(l.class_ids) x(class_id) left join mtm_hw_private.classes c on c.id=x.class_id where c.id is null or not c.active or c.owner_id<>scope.owner_id) then raise exception 'Outside scope' using errcode='42501';end if;
 for k,v in select * from jsonb_each(patch) loop
  if k not in ('videoId','videoUrl','materialUrl','handoutUrl','homeworkNote','title','titleSource','classOpensAt') then raise exception 'Field not allowed';end if;
  if k='classOpensAt' then
   if jsonb_typeof(v) is distinct from 'object' or v='{}' then raise exception 'Invalid opening map';end if;
   if exists(select 1 from jsonb_each(v) a where not exists(select 1 from mtm_hw_private.classes c where c.id=any(l.class_ids) and c.label=a.key)
    or jsonb_typeof(a.value) is distinct from 'string' or (a.value#>>'{}')!~'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$') then raise exception 'Invalid class opening timestamp';end if;
   perform (value#>>'{}')::timestamptz from jsonb_each(v);
  else
   if v='null'::jsonb and k in ('videoId','videoUrl','materialUrl','handoutUrl') then continue;end if;
   if jsonb_typeof(v) is distinct from 'string' then raise exception 'Invalid material text';end if;
   if (k='videoId' and (v#>>'{}')!~'^[A-Za-z0-9_-]{11}$')
    or (k in ('videoUrl','materialUrl','handoutUrl') and (length(v#>>'{}')>4096 or (v#>>'{}')!~'^https://[^\s/@?#]+([/?#][^\s]*)?$'))
    or (k='title' and (length(v#>>'{}')>300 or btrim(v#>>'{}')=''))
    or (k='titleSource' and (v#>>'{}') not in ('sheet','auto'))
    or (k='homeworkNote' and length(v#>>'{}')>2000) then raise exception 'Invalid material value';end if;
  end if;
 end loop;
 -- Bổ sung riêng từng lớp phải giữ giờ của các lớp còn lại.
 if patch ? 'classOpensAt' then patch=jsonb_set(patch,'{classOpensAt}',coalesce(l.material->'classOpensAt','{}')||(patch->'classOpensAt'));end if;
 result=l.material||patch;
 if result is distinct from l.material then
  insert into mtm_hw_private.btvn_material_history(lesson_code,before_material,after_material) values(l.code,l.material,result);
  update mtm_hw_private.btvn_lessons set material=result,updated_at=clock_timestamp() where code=l.code;
 end if;
 return jsonb_build_object('status','updated','changed',result is distinct from l.material,'material',result);
end$$;
commit;

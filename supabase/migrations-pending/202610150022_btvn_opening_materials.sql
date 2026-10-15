-- Đợt 24: operator chỉ lấy metadata cần tính lại giờ mở, không có đề hoặc hồ sơ học sinh.
begin;
create function public.mtm_btvn_opening_materials(p_code text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if p_code is not null and p_code !~ '^[a-z0-9-]{1,160}$' then raise exception 'Invalid lesson code';end if;
 select coalesce(jsonb_agg(jsonb_build_object('lessonCode',l.code,'date',l.material->>'date',
  'classNames',l.material->'classNames','classDates',coalesce(l.material->'classDates','{}')) order by l.code),'[]') into result
 from mtm_hw_private.btvn_lessons l join mtm_hw_private.btvn_publish_scope cfg on cfg.singleton and l.owner_id=cfg.owner_id
 where l.active and l.publish_status='da_dang' and l.kind='btvn' and l.class_ids <@ cfg.class_ids
 and (p_code is null or l.code=p_code);
 return result;
end$$;
revoke all on function public.mtm_btvn_opening_materials(text) from public,anon,authenticated,mtm_btvn_publisher;
grant execute on function public.mtm_btvn_opening_materials(text) to service_role;
commit;

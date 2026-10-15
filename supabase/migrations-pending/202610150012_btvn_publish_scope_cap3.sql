-- 15/10/2026 (Claude): anh Thành giao lên BTVN cho 2K10, 2K11 (cấp 3); cấp 2 tạm chưa áp dụng.
-- Phạm vi đăng bài nhận mọi lớp cấp 3 (nhãn bắt đầu 2K9/2K10/2K11) đã đồng bộ từ danh sách, phải có 2K9 9+ và 2K9 8+.
-- Gốc: hàm 007 đang chạy; chỉ đổi điều kiện số lớp và tiền tố.
create or replace function public.mtm_btvn_configure_publish_scope(p_labels text[], p_apply boolean default false)
 returns jsonb language plpgsql security definer set search_path='' as $$
declare cfg mtm_hw_private.btvn_roster_scope;ids uuid[];n integer;
begin
 select * into cfg from mtm_hw_private.btvn_roster_scope where singleton;
 if not found or p_apply is null or p_labels is null or cardinality(p_labels) not between 2 and 30
  or not(p_labels @> array['2K9 9+','2K9 8+']::text[])
  or exists(select 1 from unnest(p_labels) x where x !~ '^2K(9|10|11)( |$)')
  or cardinality(p_labels)<>(select count(distinct x) from unnest(p_labels) x) then raise exception 'Scope invalid';end if;
 select count(*),array_agg(id order by label) into n,ids from mtm_hw_private.classes where owner_id=cfg.owner_id and active and label=any(p_labels) and id=any(cfg.synced_class_ids);
 if n<>cardinality(p_labels) then raise exception 'Classes missing or ambiguous';end if;
 if p_apply then
  if exists(select 1 from mtm_hw_private.btvn_publish_scope where owner_id<>cfg.owner_id) then raise exception 'Foreign publisher owner';end if;
  insert into mtm_hw_private.btvn_publish_scope values(true,cfg.owner_id,ids) on conflict(singleton) do update set class_ids=excluded.class_ids;
 end if;
 return jsonb_build_object('applied',p_apply,'classes',n,'classIds',ids);
end$$;

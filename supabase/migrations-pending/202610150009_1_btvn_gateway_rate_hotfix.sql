-- 15/10/2026 06:10 (Claude, hotfix production): ngưỡng 5 lượt/15 phút/mạng khoá cả lớp dùng chung wifi
-- (anh Thành bị chặn sau 12 lượt). Tạm nâng lên 120 lượt/15 phút; đợt 12b chỉ đếm lượt sai và báo rõ thời gian chờ.
CREATE OR REPLACE FUNCTION public.mtm_btvn_gateway_rate(p_network_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare n integer;begin
 if p_network_key is null or p_network_key !~ '^[0-9a-f]{64}$' then return '{"ok":false}'::jsonb;end if;
 insert into mtm_hw_private.btvn_limits values(p_network_key,1,clock_timestamp()+interval '15 minutes') on conflict(network_key) do update set hits=case when mtm_hw_private.btvn_limits.until_at<=clock_timestamp() then 1 else mtm_hw_private.btvn_limits.hits+1 end,until_at=case when mtm_hw_private.btvn_limits.until_at<=clock_timestamp() then clock_timestamp()+interval '15 minutes' else mtm_hw_private.btvn_limits.until_at end returning hits into n;
 return jsonb_build_object('ok',n<=120);
end$function$
;

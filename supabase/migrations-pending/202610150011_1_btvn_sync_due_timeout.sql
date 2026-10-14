-- 15/10 (Claude): RPC đồng bộ hạn quá statement_timeout mặc định của service_role (8 giây).
alter function public.mtm_btvn_sync_due(jsonb,boolean) set statement_timeout='60s';

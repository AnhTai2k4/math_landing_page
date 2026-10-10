-- Preserve the original applied migration. Invalid guesses do not allocate per-code counters.
-- The gateway network quota still applies before resolve; valid codes retain 10/minute.
begin;
create or replace function public.mtm_hw_resolve_code(p_code text) returns jsonb language plpgsql security definer set search_path='' as $$
declare raw text;d bytea;c mtm_hw_private.codes;token text;bad jsonb='{"ok":false,"message":"Mã không hợp lệ hoặc chưa dùng được."}'::jsonb;
begin
 if p_code is null or length(p_code)>100 then return bad;end if;raw=lower(regexp_replace(p_code,'[-[:space:]]','','g'));
 if raw !~ '^[0-9a-f]{32}$' then return bad;end if;d=mtm_hw_private.token_digest('code',raw);
 select * into c from mtm_hw_private.codes where digest=d and revoked_at is null and expires_at>clock_timestamp();
 if not found or mtm_hw_private.profile(c.student_id) is null then return bad;end if;
 if not mtm_hw_private.rate_ok('resolve-code-'||encode(d,'hex'),10) then return bad;end if;
 delete from mtm_hw_private.challenges where expires_at<clock_timestamp()-interval '1 day';delete from mtm_hw_private.sessions where expires_at<clock_timestamp()-interval '1 day';token=mtm_hw_private.random_token();
 insert into mtm_hw_private.challenges(student_id,code_id,digest,expires_at) values(c.student_id,c.id,mtm_hw_private.token_digest('challenge',token),clock_timestamp()+interval '5 minutes');
 return jsonb_build_object('ok',true,'challenge',token,'profile',mtm_hw_private.profile(c.student_id));end $$;
commit;

// CHƯA DEPLOY. Service role chỉ dùng Storage, DB luôn SET LOCAL ROLE.
import {createClient} from 'npm:@supabase/supabase-js@2.117.3';
import postgres from 'npm:postgres@3.4.5';
import {createBtvnPublishHandler} from './handler.generated.js';
import {createPublishPort} from './port.mjs';
const env=(name:string)=>{const value=Deno.env.get(name);if(!value)throw Error('Publisher configuration missing');return value;};
const sql=postgres(env('SUPABASE_DB_URL'),{prepare:false,max:1,idle_timeout:20,connect_timeout:10});
const storage=createClient(env('SUPABASE_URL'),env('SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}).storage;
Deno.serve(createBtvnPublishHandler(createPublishPort(sql,storage),env('MTM_BTVN_PUBLISH_SECRET')));

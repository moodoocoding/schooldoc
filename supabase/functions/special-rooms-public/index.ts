import { createClient } from 'npm:@supabase/supabase-js@2.110.8';
import { handleSpecialRooms } from '../_shared/specialRoomsServer.ts';
const url=Deno.env.get('SUPABASE_URL');
const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')??Deno.env.get('SUPABASE_SECRET_KEY');
if(!url||!serviceKey)throw new Error('Supabase service environment is not configured.');
const db=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
Deno.serve(request=>handleSpecialRooms(request,db,name=>Deno.env.get(name)));

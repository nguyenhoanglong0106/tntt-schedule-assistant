import { createClient } from 'jsr:@supabase/supabase-js@2'
export function userClient(req:Request){return createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:req.headers.get('Authorization')??''}}})}
export function serviceClient(){return createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)}
export async function requireUser(req:Request){const db=userClient(req);const{data,error}=await db.auth.getUser();if(error||!data.user)throw new Error('UNAUTHORIZED');return{db,user:data.user}}

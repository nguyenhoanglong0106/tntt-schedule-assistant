import { corsHeaders, json } from '../_shared/cors.ts'
import { requireUser } from '../_shared/clients.ts'
Deno.serve(async(req)=>{if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders});try{const{db}=await requireUser(req);const{pending_action_id}=await req.json();if(!pending_action_id)return json({error:'Thiếu pending_action_id'},400);const{data,error}=await db.rpc('confirm_ai_pending_action',{p_pending_id:pending_action_id});if(error)throw error;return json(data)}catch(e:any){return json({error:e?.message??'Không xác nhận được'},e?.message==='UNAUTHORIZED'?401:400)}})

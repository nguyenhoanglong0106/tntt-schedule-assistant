import { corsHeaders, json } from '../_shared/cors.ts'
import { requireUser } from '../_shared/clients.ts'

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders})
  try{
    const{db,user}=await requireUser(req)
    if(req.method==='POST'){
      const{token}=await req.json()
      if(!token)return json({error:'Missing token'},400)
      await db.from('push_subscriptions').upsert(
        {user_id:user.id,fcm_token:token,created_at:new Date().toISOString()},
        {onConflict:'user_id'}
      )
      return json({ok:true})
    }
    if(req.method==='DELETE'){
      const{token}=await req.json()
      if(!token)return json({error:'Missing token'},400)
      await db.from('push_subscriptions').delete().eq('user_id',user.id).eq('fcm_token',token)
      return json({ok:true})
    }
    return json({error:'Method not allowed'},405)
  }catch(e:any){return json({error:e?.message??'Error'},401)}
})
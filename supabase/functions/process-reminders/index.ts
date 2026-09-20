import { corsHeaders, json } from '../_shared/cors.ts'
import { serviceClient } from '../_shared/clients.ts'

function fcmSend(token: string, title: string, body: string, data: Record<string,string>, serverKey: string): Promise<boolean> {
  return fetch('https://fcm.googleapis.com/fcm/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `key=${serverKey}`
    },
    body: JSON.stringify({
      to: token,
      notification: { title, body, icon: '/icon-192.png', badge: '/icon-512.png' },
      data,
      priority: 'high',
      content_available: true
    })
  }).then(res => res.ok || res.status === 201).catch(() => false)
}

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders})
  const expected=Deno.env.get('CRON_SECRET');
  if(expected&&req.headers.get('x-cron-secret')!==expected)return json({error:'Unauthorized'},401)
  try{
    const db=serviceClient()
    const now=Date.now()
    const horizon=new Date(now+25*60_000).toISOString().slice(0,10)
    const FCM_SERVER_KEY=Deno.env.get('FCM_SERVER_KEY')??''
    const{data:items,error}=await db.from('reminders').select('id,offset_minutes,delivered_at,schedules!inner(id,branch_id,scheduled_date,start_time,status,task_types(name),assignment_assignees(members(full_name),classes(name)))')
.is('delivered_at',null).lte('schedules.scheduled_date',horizon)
    if(error)throw error
    let delivered=0
    for(const r of items??[]){
      const s:any=r.schedules
      if(!s.start_time||['COMPLETED','CANCELLED'].includes(s.status))continue
      const eventMs=new Date(`${s.scheduled_date}T${s.start_time}+07:00`).getTime()
      const dueMs=eventMs-r.offset_minutes*60_000
      if(dueMs>now||dueMs<now-60*60_000)continue

      const assignees: string[]=(s.assignment_assignees ?? []).map((a:any)=>a.members?.full_name ?? a.classes?.name).filter(Boolean)
      const taskName: string=s.task_types?.name ?? 'Công việc'
      const timeStr: string=s.start_time.slice(0,5)
      const title=`🔔 ${taskName}`
      const body=assignees.length
        ? `${assignees.join(', ')} – ${timeStr} ngày ${s.scheduled_date}`
        : `Bắt đầu lúc ${timeStr} ngày ${s.scheduled_date}`

      if(FCM_SERVER_KEY){
        const{data:profiles}=await db.from('profiles').select('id').or(`role.eq.SUPER_ADMIN,branch_id.eq.${s.branch_id}`)
        for(const p of profiles ?? []){
          await db.from('notifications').insert({user_id: p.id, schedule_id: s.id, title, body})
          const{data:subs}=await db.from('push_subscriptions').select('fcm_token').eq('user_id',p.id)
          const tokens: string[]=(subs ?? []).filter(x=>x.fcm_token).map(x=>x.fcm_token) as string[]
          if(tokens.length){
            const data: Record<string,string>={ url: '/reminders', schedule_id: s.id }
            for(const token of tokens){
              try{ await fcmSend(token,title,body,data,FCM_SERVER_KEY) }catch(_){}
            }
          }
        }
      }

      await db.from('reminders').update({delivered_at:new Date().toISOString()}).eq('id',r.id)
      delivered++
    }
    return json({ok:true,delivered})
  }catch(e:any){return json({error:e?.message ?? 'Reminder error'},500)}})
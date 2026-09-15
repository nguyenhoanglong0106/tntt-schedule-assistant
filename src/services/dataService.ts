import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import { makeDemoData } from '@/services/demoData'
import type { AppData, PendingAction, Profile, ReadingRotationConfig, Schedule } from '@/types'

const DEMO_KEY = 'tntt-demo-data-v1'
const DEMO_PROFILE_KEY = 'tntt-demo-profile-v1'
const DEMO_PENDING_KEY = 'tntt-demo-pending-v1'

function readDemo(): AppData {
  const raw = localStorage.getItem(DEMO_KEY)
  if (raw) return JSON.parse(raw)
  const seed = makeDemoData()
  localStorage.setItem(DEMO_KEY, JSON.stringify(seed))
  return seed
}
function writeDemo(data: AppData) { localStorage.setItem(DEMO_KEY, JSON.stringify(data)) }

export async function getCurrentProfile(): Promise<Profile | null> {
  if (!isSupabaseConfigured || !supabase) {
    const raw = localStorage.getItem(DEMO_PROFILE_KEY)
    if (raw) return JSON.parse(raw)
    const p: Profile = { id:'demo-super', fullName:'Trưởng Đoàn', role:'SUPER_ADMIN', branchId:null }
    localStorage.setItem(DEMO_PROFILE_KEY, JSON.stringify(p))
    return p
  }
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data, error } = await supabase.from('profiles').select('id, full_name, role, branch_id').eq('id', user.id).maybeSingle()
  if (error) throw error
  if (!data) return null
  return { id:data.id, fullName:data.full_name, role:data.role, branchId:data.branch_id }
}

export async function bootstrapProfile(fullName: string): Promise<Profile> {
  if (!supabase) return getCurrentProfile() as Promise<Profile>
  const { data, error } = await supabase.rpc('bootstrap_first_admin', { p_full_name: fullName })
  if (error) throw error
  return { id:data.id, fullName:data.full_name, role:data.role, branchId:data.branch_id }
}

export async function loadAppData(): Promise<AppData> {
  if (!isSupabaseConfigured || !supabase) return readDemo()
  const [branchesR, tasksR, membersR, classesR, schedulesR, rotationR, assigneesR, remindersR, notificationsR] = await Promise.all([
    supabase.from('branches').select('id,code,name,color_hex,rotation_index').order('rotation_index'),
    supabase.from('task_types').select('id,code,name,icon').eq('active', true).order('sort_order'),
    supabase.from('members').select('id,branch_id,class_id,full_name,active').eq('active', true).order('full_name'),
    supabase.from('classes').select('id,branch_id,name').eq('active', true).order('name'),
    supabase.from('schedules').select('id,task_type_id,branch_id,scheduled_date,start_time,end_time,status,notes,created_by,completed_at,completed_by,task_types(code,name)').order('scheduled_date'),
    supabase.from('reading_rotation_config').select('start_date,start_branch_id').eq('singleton_key', 1).maybeSingle(),
    supabase.from('assignment_assignees').select('id,schedule_id,assignee_type,member_id,class_id,members(full_name),classes(name)'),
    supabase.from('reminders').select('schedule_id,offset_minutes'),
    supabase.from('notifications').select('id,schedule_id,title,body,read_at,created_at').order('created_at',{ascending:false}).limit(50),
  ])
  for (const r of [branchesR,tasksR,membersR,classesR,schedulesR,rotationR,assigneesR,remindersR,notificationsR]) if (r.error) throw r.error
  const assignees = assigneesR.data ?? []
  const reminders = remindersR.data ?? []
  return {
    branches:(branchesR.data??[]).map((x:any)=>({id:x.id,code:x.code,name:x.name,colorHex:x.color_hex,rotationIndex:x.rotation_index})),
    taskTypes:(tasksR.data??[]).map((x:any)=>({id:x.id,code:x.code,name:x.name,icon:x.icon})),
    members:(membersR.data??[]).map((x:any)=>({id:x.id,branchId:x.branch_id,classId:x.class_id,fullName:x.full_name,active:x.active})),
    classes:(classesR.data??[]).map((x:any)=>({id:x.id,branchId:x.branch_id,name:x.name})),
    schedules:(schedulesR.data??[]).map((x:any)=>({
      id:x.id,taskTypeId:x.task_type_id,taskCode:x.task_types.code,taskName:x.task_types.name,branchId:x.branch_id,date:x.scheduled_date,
      startTime:x.start_time?.slice(0,5)??null,endTime:x.end_time?.slice(0,5)??null,status:x.status,notes:x.notes,createdBy:x.created_by,
      completedAt:x.completed_at,completedBy:x.completed_by,
      assignees:assignees.filter((a:any)=>a.schedule_id===x.id).map((a:any)=>({id:a.id,type:a.assignee_type,memberId:a.member_id,classId:a.class_id,label:a.members?.full_name??a.classes?.name??'Chưa rõ'})),
      reminderOffsets:reminders.filter((r:any)=>r.schedule_id===x.id).map((r:any)=>r.offset_minutes),
    })),
    rotation: rotationR.data ? {startDate:rotationR.data.start_date,startBranchId:rotationR.data.start_branch_id} : {startDate:'',startBranchId:''},
    notifications:(notificationsR.data??[]).map((n:any)=>({id:n.id,scheduleId:n.schedule_id,title:n.title,body:n.body,readAt:n.read_at,createdAt:n.created_at}))
  }
}

export async function saveSchedule(input: Omit<Schedule,'id'> & {id?:string}): Promise<Schedule> {
  if (!isSupabaseConfigured || !supabase) {
    const data=readDemo(); const id=input.id??crypto.randomUUID(); const schedule={...input,id} as Schedule
    const i=data.schedules.findIndex(s=>s.id===id); if(i>=0)data.schedules[i]=schedule;else data.schedules.push(schedule); writeDemo(data); return schedule
  }
  const row={task_type_id:input.taskTypeId,branch_id:input.branchId,scheduled_date:input.date,start_time:input.startTime||null,end_time:input.endTime||null,status:input.status,notes:input.notes||null,source:'MANUAL'}
  const result=input.id ? await supabase.from('schedules').update(row).eq('id',input.id).select().single() : await supabase.from('schedules').insert(row).select().single()
  if(result.error) throw result.error
  const id=result.data.id
  await supabase.from('assignment_assignees').delete().eq('schedule_id',id)
  if(input.assignees.length){
    const rows=input.assignees.map(a=>({schedule_id:id,assignee_type:a.type,member_id:a.type==='MEMBER'?a.memberId:null,class_id:a.type==='CLASS'?a.classId:null}))
    const {error}=await supabase.from('assignment_assignees').insert(rows); if(error)throw error
  }
  await supabase.from('reminders').delete().eq('schedule_id',id)
  if(input.reminderOffsets.length){ const {error}=await supabase.from('reminders').insert(input.reminderOffsets.map(offset_minutes=>({schedule_id:id,offset_minutes}))); if(error)throw error }
  return {...input,id} as Schedule
}

export async function deleteSchedule(id:string):Promise<void>{
  if(!isSupabaseConfigured||!supabase){const d=readDemo();d.schedules=d.schedules.filter(s=>s.id!==id);writeDemo(d);return}
  const {error}=await supabase.from('schedules').delete().eq('id',id);if(error)throw error
}

export async function saveRotation(rotation:ReadingRotationConfig):Promise<void>{
  if(!isSupabaseConfigured||!supabase){const d=readDemo();d.rotation=rotation;writeDemo(d);return}
  const {error}=await supabase.from('reading_rotation_config').upsert({singleton_key:1,start_date:rotation.startDate,start_branch_id:rotation.startBranchId},{onConflict:'singleton_key'});if(error)throw error
}

export async function savePendingAction(action:PendingAction):Promise<void>{
  if(!isSupabaseConfigured||!supabase){localStorage.setItem(DEMO_PENDING_KEY,JSON.stringify(action));return}
  const {error}=await supabase.from('ai_pending_actions').insert({id:action.id,user_id:(await supabase.auth.getUser()).data.user?.id,intent:action.intent,payload:action.payload,preview_data:{title:action.previewTitle,lines:action.previewLines},status:'PENDING',expires_at:new Date(Date.now()+15*60_000).toISOString()});if(error)throw error
}
export async function getPendingAction(id:string):Promise<PendingAction|null>{
  if(!isSupabaseConfigured||!supabase){const r=localStorage.getItem(DEMO_PENDING_KEY);const a=r?JSON.parse(r):null;return a?.id===id?a:null}
  const {data,error}=await supabase.from('ai_pending_actions').select('*').eq('id',id).maybeSingle();if(error)throw error;if(!data)return null
  return {id:data.id,intent:data.intent,payload:data.payload,previewTitle:data.preview_data?.title??'Xác nhận',previewLines:data.preview_data?.lines??[],status:data.status}
}

export function resetDemo(){ localStorage.removeItem(DEMO_KEY); localStorage.removeItem(DEMO_PENDING_KEY) }

export async function createMember(branchId:string,classId:string|null,fullName:string):Promise<void>{
  if(!isSupabaseConfigured||!supabase){const d=readDemo();d.members.push({id:crypto.randomUUID(),branchId,classId,fullName,active:true});writeDemo(d);return}
  const {error}=await supabase.from('members').insert({branch_id:branchId,class_id:classId||null,full_name:fullName,active:true});if(error)throw error
}
export async function createClass(branchId:string,name:string):Promise<void>{
  if(!isSupabaseConfigured||!supabase){const d=readDemo();d.classes.push({id:crypto.randomUUID(),branchId,name});writeDemo(d);return}
  const {error}=await supabase.from('classes').insert({branch_id:branchId,name,active:true});if(error)throw error
}
export async function deactivateMember(id:string):Promise<void>{
  if(!isSupabaseConfigured||!supabase){const d=readDemo();const m=d.members.find(x=>x.id===id);if(m)m.active=false;writeDemo(d);return}
  const {error}=await supabase.from('members').update({active:false}).eq('id',id);if(error)throw error
}
export function setDemoProfile(profile:Profile){localStorage.setItem(DEMO_PROFILE_KEY,JSON.stringify(profile))}

export async function markNotificationRead(id:string):Promise<void>{ if(!isSupabaseConfigured||!supabase)return; const{error}=await supabase.from('notifications').update({read_at:new Date().toISOString()}).eq('id',id);if(error)throw error }

export async function getActivityLogs(limit=100):Promise<any[]>{
  if(!isSupabaseConfigured||!supabase)return []
  const{data,error}=await supabase.from('activity_logs').select('id,actor_user_id,branch_id,action,entity_type,entity_id,before_data,after_data,source,created_at').order('created_at',{ascending:false}).limit(limit);if(error)throw error;return data??[]
}

export async function copyWeek(sourceWeekStart:string,targetWeekStart:string,branchId:string|null):Promise<number>{
  const data=await loadAppData();const srcEnd=new Date(new Date(`${sourceWeekStart}T12:00:00+07:00`).getTime()+6*86400000).toISOString().slice(0,10)
  const items=data.schedules.filter(s=>s.date>=sourceWeekStart&&s.date<=srcEnd&&(!branchId||s.branchId===branchId)&&s.taskCode!=='READING')
  let count=0
  for(const s of items){
    const offset=Math.round((new Date(`${s.date}T12:00:00+07:00`).getTime()-new Date(`${sourceWeekStart}T12:00:00+07:00`).getTime())/86400000)
    const date=new Date(new Date(`${targetWeekStart}T12:00:00+07:00`).getTime()+offset*86400000).toISOString().slice(0,10)
    const duplicate=data.schedules.some(x=>x.date===date&&x.branchId===s.branchId&&x.taskCode===s.taskCode&&x.startTime===s.startTime)
    if(duplicate)continue
    await saveSchedule({...s,id:undefined,date,status:s.assignees.length?'ASSIGNED':'UNASSIGNED',completedAt:null,completedBy:null})
    count++
  }
  return count
}

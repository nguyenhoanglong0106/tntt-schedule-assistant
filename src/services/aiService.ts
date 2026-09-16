import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import { savePendingAction, getPendingAction, saveSchedule } from '@/services/dataService'
import type { AppData, PendingAction, Profile, Schedule, TaskCode } from '@/types'
import { nextWeekdayInWeek, readingBranchForDate, startOfWeek, weekLabel } from '@/utils/date'
import { normalizeVi } from '@/utils/normalize'

type AiResult = { kind:'answer'; text:string } | { kind:'pending'; action:PendingAction } | { kind:'clarify'; text:string }

type Draft = { taskCode:TaskCode; date:string; branchId:string; startTime?:string|null; endTime?:string|null; assigneeIds:string[] }

const dayMap: Record<string,number> = { 't2':1,'thu 2':1,'thu hai':1,'t3':2,'thu 3':2,'thu ba':2,'t5':4,'thu 5':4,'thu nam':4,'cn':0,'chu nhat':0 }

function memberMatches(name:string,data:AppData,branchId?:string){ const n=normalizeVi(name); return data.members.filter(m=>(!branchId||m.branchId===branchId)&&normalizeVi(m.fullName).includes(n)) }
function taskFromText(n:string):TaskCode|undefined{ if(n.includes('doc sach'))return'READING';if(n.includes('ban kem'))return'ICE_CREAM';if(n.includes('van phong'))return'OFFICE_DUTY';if(n.includes('ve sinh'))return'CLEANING';return undefined }
function taskMeta(code:TaskCode,data:AppData){return data.taskTypes.find(t=>t.code===code)!}

function demoQuery(message:string,data:AppData):AiResult|null{
  const n=normalizeVi(message); const now=new Date().toISOString().slice(0,10); const week=startOfWeek(now)
  if(n.includes('nganh nao')&&n.includes('doc sach')){const b=readingBranchForDate(week,data.rotation,data.branches);return{kind:'answer',text:b?`Tuần ${weekLabel(week)}, Ngành ${b.name} phụ trách đọc sách.`:'Chưa cấu hình vòng đọc sách.'}}
  if(n.includes('ai ban kem')||n.includes('ai truc van phong')||n.includes('ai ve sinh')){
    const code=n.includes('ban kem')?'ICE_CREAM':n.includes('van phong')?'OFFICE_DUTY':'CLEANING'; const sunday=nextWeekdayInWeek(week,0)
    const list=data.schedules.filter(s=>s.date===sunday&&s.taskCode===code)
    if(!list.length)return{kind:'answer',text:`Chủ Nhật ${sunday} chưa có lịch ${taskMeta(code,data).name.toLowerCase()}.`}
    return{kind:'answer',text:list.map(s=>{const b=data.branches.find(x=>x.id===s.branchId);return `${b?.name}: ${s.startTime??''}${s.endTime?`–${s.endTime}`:''} · ${s.assignees.map(a=>a.label).join(', ')||'chưa phân công'}`}).join('\n')}
  }
  if(n.includes('tuan nay')&&n.includes('lam gi')){
    const branch=data.branches.find(b=>n.includes(normalizeVi(b.name))); if(branch){const list=data.schedules.filter(s=>s.branchId===branch.id&&s.date>=week&&s.date<=nextWeekdayInWeek(week,0));return{kind:'answer',text:list.length?list.map(s=>`${s.date} · ${s.taskName} · ${s.assignees.map(a=>a.label).join(', ')||'chưa phân công'}`).join('\n'):`Ngành ${branch.name} chưa có lịch trong tuần này.`}}
  }
  return null
}

function demoCommand(message:string,data:AppData,profile:Profile):AiResult{
  const n=normalizeVi(message); const taskCode=taskFromText(n)
  if(!taskCode)return{kind:'clarify',text:'Tôi chưa xác định được công việc. Hãy nói rõ: đọc sách, bán kem, trực văn phòng hoặc vệ sinh.'}
  const currentWeek=startOfWeek(new Date().toISOString().slice(0,10))
  let branchId=profile.branchId
  for(const b of data.branches) if(n.includes(normalizeVi(b.name))) branchId=b.id
  if(taskCode==='READING') branchId=readingBranchForDate(currentWeek,data.rotation,data.branches)?.id??branchId
  if(!branchId)return{kind:'clarify',text:'Tôi chưa xác định được Ngành phụ trách.'}
  if(profile.role==='BRANCH_ADMIN'&&branchId!==profile.branchId)return{kind:'answer',text:'Bạn có thể xem lịch Ngành khác nhưng chỉ được chỉnh sửa dữ liệu của Ngành mình.'}

  const drafts:Draft[]=[]
  const dayPattern=/(t2|thứ\s*2|thứ hai|t3|thứ\s*3|thứ ba|t5|thứ\s*5|thứ năm|cn|chủ nhật)\s+([^,.;]+)/giu
  let match:RegExpExecArray|null
  while((match=dayPattern.exec(message))){
    const dayKey=normalizeVi(match[1]).replace(/\s+/g,' '); const weekday=dayMap[dayKey]; if(weekday===undefined)continue
    let segment=match[2].trim(); segment=segment.replace(/đọc sách|bán kem|trực văn phòng|vệ sinh( nhà giáo lý)?/giu,'').trim()
    const time=segment.match(/(\d{1,2})(?:h|:)(\d{2})?\s*(?:đến|toi|-)\s*(\d{1,2})(?:h|:)(\d{2})?/iu)
    let startTime:null|string=null,endTime:null|string=null
    if(time){startTime=`${time[1].padStart(2,'0')}:${(time[2]||'00').padStart(2,'0')}`;endTime=`${time[3].padStart(2,'0')}:${(time[4]||'00').padStart(2,'0')}`;segment=segment.replace(time[0],'')}
    const branchName=data.branches.find(b=>b.id===branchId)?.name; if(branchName) segment=segment.replace(new RegExp(branchName,'giu'),''); segment=segment.replace(/phụ trách|phu trach|đọc|doc/giu,'').trim()
    const tokens=segment.split(/\s+(?:và|voi|với|\+)\s+/iu).map(s=>s.trim()).filter(Boolean)
    const ids:string[]=[]
    for(const token of tokens){ const hits=memberMatches(token,data,branchId); if(hits.length>1)return{kind:'clarify',text:`Tôi tìm thấy nhiều người phù hợp với “${token}”: ${hits.map(h=>h.fullName).join(', ')}. Vui lòng nói rõ tên.`}; if(hits.length===1)ids.push(hits[0].id) }
    if(!ids.length){const hits=memberMatches(segment,data,branchId);if(hits.length>1)return{kind:'clarify',text:`Có nhiều người phù hợp với “${segment}”: ${hits.map(h=>h.fullName).join(', ')}.`};if(hits.length===1)ids.push(hits[0].id)}
    drafts.push({taskCode,date:nextWeekdayInWeek(currentWeek,weekday),branchId,startTime,endTime,assigneeIds:ids})
  }
  if(!drafts.length)return{kind:'clarify',text:'Tôi đã nhận ra công việc nhưng chưa hiểu ngày/người phụ trách. Ví dụ: “T2 Minh Thư đọc sách, T3 Đức”.'}
  const task=taskMeta(taskCode,data); const branch=data.branches.find(b=>b.id===branchId)!
  const lines=drafts.map(d=>{const names=d.assigneeIds.map(id=>data.members.find(m=>m.id===id)?.fullName).filter(Boolean).join(', ')||'chưa xác định người';return `${d.date} · ${d.startTime??''}${d.endTime?`–${d.endTime}`:''} ${names}`.trim()})
  const action:PendingAction={id:crypto.randomUUID(),intent:'CREATE_ASSIGNMENTS',payload:{drafts},previewTitle:`${task.icon} ${task.name} · Ngành ${branch.name}`,previewLines:[`Tuần ${weekLabel(currentWeek)}`,...lines],status:'PENDING'}
  return{kind:'pending',action}
}

export async function sendAiMessage(message:string,data:AppData,profile:Profile):Promise<AiResult>{
  if(isSupabaseConfigured&&supabase){ const {data:result,error}=await supabase.functions.invoke('ai-chat',{body:{message,week_start:startOfWeek(new Date().toISOString().slice(0,10))}});if(error)throw error;return result as AiResult }
  const query=demoQuery(message,data); if(query)return query
  const result=demoCommand(message,data,profile); if(result.kind==='pending')await savePendingAction(result.action); return result
}

export async function confirmAiAction(id:string,data:AppData):Promise<{message:string}>{
  if(isSupabaseConfigured&&supabase){const{data:result,error}=await supabase.functions.invoke('ai-confirm-action',{body:{pending_action_id:id}});if(error)throw error;return result}
  const action=await getPendingAction(id);if(!action||action.status!=='PENDING')throw new Error('Yêu cầu xác nhận không còn hiệu lực.')
  const drafts=(action.payload.drafts??[]) as Draft[]
  for(const d of drafts){const task=taskMeta(d.taskCode,data);const assignees=d.assigneeIds.map(memberId=>({type:'MEMBER' as const,memberId,label:data.members.find(m=>m.id===memberId)?.fullName??'Không rõ'}));await saveSchedule({taskTypeId:task.id,taskCode:task.code,taskName:task.name,taskIcon:task.icon,branchId:d.branchId,date:d.date,startTime:d.startTime,endTime:d.endTime,status:assignees.length?'ASSIGNED':'UNASSIGNED',notes:null,assignees,reminderOffsets:[180]})}
  return{message:`Đã lưu ${drafts.length} phân công.`}
}

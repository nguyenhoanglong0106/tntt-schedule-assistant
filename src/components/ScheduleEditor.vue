<script setup lang="ts">
import { computed, reactive, watch, ref } from 'vue'
import { REMINDER_PRESETS } from '@/lib/constants'
import type { AppData, Assignee, Profile, Schedule, TaskCode } from '@/types'
import { endOfWeek, formatShortDate, readingBranchForDate, startOfWeek, todayISO } from '@/utils/date'
import { normalizeVi } from '@/utils/normalize'
import TimeInput24 from '@/components/TimeInput24.vue'

const props=defineProps<{data:AppData;profile:Profile;existing?:Schedule|null;hideReading?:boolean;weekCursor?:string;defaultTask?:{code:TaskCode;date:string}}>()
const taskChoices=computed(()=>props.hideReading?props.data.taskTypes.filter(t=>t.code!=='READING'):props.data.taskTypes)
type QuickSave={id?:string;taskTypeId:string;taskCode:TaskCode;taskName:string;taskIcon:string;branchId:string;date:string;startTime:string|null;assignees:Assignee[];reminders:number[]}
const emit=defineEmits<{save:[QuickSave];cancel:[];delete:[]}>()
const form=reactive({taskCode:props.existing?.taskCode??props.defaultTask?.code??('CLEANING' as TaskCode),branchId:props.existing?.branchId??props.profile.branchId??props.data.branches[0]?.id??'',date:props.existing?.date??props.defaultTask?.date??todayISO(),startTime:'06:00',selected:[] as string[],search:'',reminders:[180] as number[]})
const task=computed(()=>props.data.taskTypes.find(t=>t.code===form.taskCode)!)
const readingBranch=computed(()=>readingBranchForDate(form.date,props.data.rotation,props.data.branches))
const effectiveBranch=computed(()=>form.taskCode==='READING'?readingBranch.value?.id??form.branchId:form.branchId)
const branchTimeConfig=computed(()=>props.data.taskTypeBranchTimes.find(x=>x.taskTypeId===task.value?.id&&x.branchId===effectiveBranch.value))
const fixedDayOfWeek=computed(()=>{
  if(branchTimeConfig.value?.fixedDayOfWeek!=null)return branchTimeConfig.value.fixedDayOfWeek;
  if(form.taskCode==='ICE_CREAM'||form.taskCode==='OFFICE_DUTY')return 0;
  return null;
})
const isFixedDayLocked=computed(()=>fixedDayOfWeek.value!==null)
const fixedDate=computed(()=>{
  if(fixedDayOfWeek.value===null)return '';
  const monday=startOfWeek(props.weekCursor||todayISO());
  const daysToAdd=fixedDayOfWeek.value===0?6:fixedDayOfWeek.value-1;
  const d=new Date(new Date(`${monday}T12:00:00+07:00`).getTime()+daysToAdd*86400000);
  return d.toISOString().slice(0,10);
})
const fixedDayName=computed(()=>{
  if(fixedDayOfWeek.value===null)return '';
  return ['Chủ Nhật','Thứ 2','Thứ 3','Thứ 4','Thứ 5','Thứ 6','Thứ 7'][fixedDayOfWeek.value];
})
// Admin's branch time is only a suggestion: prefill it, the branch may change it per schedule.
function applyTaskDefaultTime(){
  if(props.existing)return
  if(branchTimeConfig.value){form.startTime=branchTimeConfig.value.startTime}
  else if(form.taskCode==='READING'){form.startTime=new Date(`${form.date}T12:00:00+07:00`).getDay()===0?'06:00':'17:00'}
  else if(isFixedDayLocked.value&&fixedDayOfWeek.value===0){form.startTime='06:00'}
}
watch([()=>form.taskCode,()=>form.branchId],()=>{
  if(!props.existing){
    if(isFixedDayLocked.value)form.date=fixedDate.value;
    applyTaskDefaultTime();
  }
})
function hydrate(){const e=props.existing;if(!e)return;form.taskCode=e.taskCode;form.branchId=e.branchId;form.date=e.date;form.startTime=e.startTime??branchTimeConfig.value?.startTime??'';form.reminders=[...e.reminderOffsets];form.selected=e.assignees.map(a=>a.type==='MEMBER'?`M:${a.memberId}`:`C:${a.classId}`)}
hydrate();watch(()=>props.existing,hydrate)
applyTaskDefaultTime()
watch(effectiveBranch,()=>{if(!props.existing)form.selected=[]})
type Choice={key:string;label:string;type:'MEMBER'|'CLASS';id:string}
const flatChoices=computed(():Choice[]=>{
  const bid=effectiveBranch.value
  const members=props.data.members.filter(m=>m.branchId===bid).map(m=>({key:`M:${m.id}`,label:m.fullName,type:'MEMBER' as const,id:m.id}))
  const classes=props.data.classes.filter(c=>c.branchId===bid).map(c=>({key:`C:${c.id}`,label:c.name,type:'CLASS' as const,id:c.id}))
  return [...members,...classes]
})
const groupedChoices=computed(()=>{
  const q=normalizeVi(form.search); const bid=effectiveBranch.value
  const matches=(label:string)=>!q||normalizeVi(label).includes(q)
  const groups:{label:string;items:Choice[]}[]=[]
  const members=props.data.members.filter(m=>m.branchId===bid&&matches(m.fullName)).sort((a,b)=>a.fullName.localeCompare(b.fullName)).map(m=>({key:`M:${m.id}`,label:m.fullName,type:'MEMBER' as const,id:m.id}))
  if(members.length)groups.push({label:'Người',items:members})
  const classes=props.data.classes.filter(c=>c.branchId===bid&&matches(c.name)).sort((a,b)=>a.name.localeCompare(b.name)).map(c=>({key:`C:${c.id}`,label:c.name,type:'CLASS' as const,id:c.id}))
  if(classes.length)groups.push({label:'Lớp',items:classes})
  return groups
})
const selectedLabel=computed(()=>form.selected.map(key=>flatChoices.value.find(c=>c.key===key)?.label).filter(Boolean).join(', '))
function toggle(key:string){const i=form.selected.indexOf(key);if(i>=0)form.selected.splice(i,1);else form.selected.push(key)}
const expandedGroups=ref<string[]>([])
function toggleGroup(label:string){const i=expandedGroups.value.indexOf(label);if(i>=0)expandedGroups.value.splice(i,1);else expandedGroups.value.push(label)}
const reminderLabel=(m:number)=>m===1440?'1 ngày':m===720?'12 giờ':m===180?'3 giờ':m===60?'1 giờ':`${m} phút`
// Server sends a reminder up to 60 min late, then drops it — warn before saving.
const reminderWarning=computed(()=>{
  const date=isFixedDayLocked.value?fixedDate.value:form.date
  if(!form.startTime||!date)return ''
  const now=Date.now();const eventMs=new Date(`${date}T${form.startTime}:00+07:00`).getTime()
  if(eventMs<now)return '⚠️ Giờ bắt đầu đã qua — sẽ không có nhắc việc nào được gửi.'
  const late=form.reminders.filter(r=>eventMs-r*60000<now)
  if(!late.length)return ''
  const dropped=late.filter(r=>eventMs-r*60000<now-60*60000)
  const names=(l:number[])=>[...l].sort((a,b)=>a-b).map(reminderLabel).join(', ')
  return dropped.length
    ?`⚠️ Mốc nhắc trước ${names(dropped)} đã qua quá lâu nên sẽ không được gửi. Hãy chọn mốc gần hơn.`
    :`ℹ️ Mốc nhắc trước ${names(late)} đã qua — thông báo sẽ được gửi ngay trong vài phút.`
})
function toggleReminder(v:number){const i=form.reminders.indexOf(v);if(i>=0)form.reminders.splice(i,1);else form.reminders.push(v)}
function submit(){
 if(form.taskCode==='READING'&&!([0,1,2,4].includes(new Date(`${form.date}T12:00:00+07:00`).getDay()))){alert('Đọc sách chỉ có lịch vào Thứ Hai, Thứ Ba, Thứ Năm và Chủ Nhật.');return}
 const assignees:Assignee[]=form.selected.map(key=>{const [kind,id]=key.split(':');if(kind==='M'){const m=props.data.members.find(x=>x.id===id)!;return{type:'MEMBER',memberId:id,label:m.fullName}}const c=props.data.classes.find(x=>x.id===id)!;return{type:'CLASS',classId:id,label:c.name}})
  emit('save',{id:props.existing?.id,taskTypeId:task.value.id,taskCode:form.taskCode,taskName:task.value.name,taskIcon:task.value.icon,branchId:effectiveBranch.value,date:isFixedDayLocked.value?fixedDate.value:form.date,startTime:form.startTime||null,assignees,reminders:[...form.reminders]})
}
</script>
<template><Teleport to="body"><div class="overlay sheet-overlay" @click.self="$emit('cancel')"><section class="editor"><div class="handle"></div><div class="head"><div><small>{{existing?'CHỈNH SỬA':'TẠO LỊCH NHANH'}}</small><h3>{{existing?'Cập nhật công việc':'Thêm công việc'}}</h3></div><button class="x" @click="$emit('cancel')">✕</button></div><div class="ed-body">
<label>Công việc</label><div class="task-grid"><button v-for="t in taskChoices" :key="t.id" :class="{selected:form.taskCode===t.code}" @click="form.taskCode=t.code"><span>{{t.icon}}</span>{{t.name}}</button></div>
<label v-if="profile.role==='SUPER_ADMIN'&&form.taskCode!=='READING'">Ngành</label><div v-if="profile.role==='SUPER_ADMIN'&&form.taskCode!=='READING'" class="chips"><button v-for="b in data.branches" :key="b.id" :class="{selected:form.branchId===b.id}" :style="{'--c':b.colorHex}" @click="form.branchId=b.id">{{b.name}}</button></div>
<div v-if="form.taskCode==='READING'" class="info">📖 Ngành đọc sách tuần này: <strong>{{readingBranch?.name||'Chưa cấu hình'}}</strong></div>
<div v-if="isFixedDayLocked" class="info">📅 Cố định vào {{fixedDayName}} · <strong>{{formatShortDate(fixedDate)}}</strong></div>
<div v-if="isFixedDayLocked" class="two"><div><label>Bắt đầu <span v-if="branchTimeConfig">(gợi ý {{branchTimeConfig.startTime}})</span></label><TimeInput24 v-model="form.startTime" /></div></div>
<template v-else><div class="two"><div><label>Ngày</label><input v-model="form.date" type="date" /></div><div><label>Bắt đầu <span v-if="branchTimeConfig">(gợi ý {{branchTimeConfig.startTime}})</span></label><TimeInput24 v-model="form.startTime" /></div></div></template>
<label>Người / lớp phụ trách <span>(không chọn = cả Ngành)</span></label><input v-model="form.search" placeholder="Tìm nhanh tên hoặc lớp..." /><div class="choice-list"><template v-for="g in groupedChoices" :key="g.label"><div class="group-label" @click="toggleGroup(g.label)">{{g.label}} <span>{{expandedGroups.includes(g.label)||form.search?'▼':'▶'}}</span></div><template v-if="expandedGroups.includes(g.label)||form.search"><button v-for="c in g.items" :key="c.key" type="button" :class="{selected:form.selected.includes(c.key)}" @click="toggle(c.key)"><span class="checkbox">{{form.selected.includes(c.key)?'✓':''}}</span>{{c.type==='CLASS'?'👥':'👤'}} {{c.label}}</button></template></template><p v-if="!groupedChoices.length" class="subtle no-result">Không tìm thấy.</p></div><div v-if="selectedLabel" class="selected-preview">Đã chọn: {{selectedLabel}}</div>
<label>Nhắc trước</label><div class="chips reminders"><button v-for="r in REMINDER_PRESETS" :key="r" type="button" :class="{selected:form.reminders.includes(r)}" @click="toggleReminder(r)">{{reminderLabel(r)}}</button></div><div v-if="reminderWarning" class="remind-warn">{{reminderWarning}}</div>
</div><div class="ed-foot"><button class="primary" @click="submit">{{existing?'Lưu thay đổi':'Tạo lịch'}}</button><button v-if="existing" class="danger" @click="$emit('delete')">Xóa lịch này</button></div></section></div></Teleport></template>
<style scoped>.editor{min-width:0;box-sizing:border-box;background:#fff;width:100%;max-width:480px;margin:0 auto;border-radius:22px 22px 0 0;padding:8px 0 0;max-height:100%;display:flex;flex-direction:column;overflow:hidden;font-size:.92rem}.editor>.handle{flex:none}.editor>.head{flex:none;margin:0 16px}/* Only the form scrolls; save / delete stay pinned at the bottom */.ed-body{flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;padding:0 16px 12px}.ed-foot{flex:none;padding:6px 16px calc(12px + env(safe-area-inset-bottom));border-top:1px solid #eef2f7;background:#fff}.ed-foot .primary{margin-top:6px}.handle{width:38px;height:4px;background:#cbd5e1;border-radius:5px;margin:0 auto 2px}.head{display:flex;justify-content:space-between;align-items:center}.head small{font-weight:800;color:#64748b;font-size:.72rem}.head h3{margin:1px 0 8px;font-size:1rem}.x{border:0;background:#f1f5f9;border-radius:50%;width:32px;height:32px}label{display:block;font-size:.78rem;font-weight:800;color:#475569;margin:10px 0 6px}label span{font-weight:500;color:#94a3b8}.task-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.task-grid button,.chips button,.choice-list button{border:1px solid #e2e8f0;background:#fff;border-radius:11px;padding:7px;font-size:.82rem;font-weight:700;text-align:left;white-space:normal;word-break:break-word}.task-grid button.selected,.chips button.selected,.choice-list button.selected{border-color:#2563eb;background:#eff6ff;color:#1d4ed8}.task-grid span{margin-right:4px}.chips{display:flex;flex-wrap:wrap;gap:6px}.chips button{padding:6px 9px}.info{margin-top:8px;background:#eff6ff;border-radius:11px;padding:8px 10px;color:#1e40af;font-size:.84rem}.choice-list{display:grid;gap:5px;max-height:170px;overflow:auto;margin-top:6px}.choice-list button{display:flex;align-items:center;gap:7px;padding:7px 9px;line-height:1.2}.checkbox{width:16px;height:16px;border:1.5px solid #cbd5e1;border-radius:5px;display:inline-flex;align-items:center;justify-content:center;font-size:.68rem;font-weight:900;color:#fff;flex-shrink:0}.choice-list button.selected .checkbox{background:#2563eb;border-color:#2563eb}.selected-preview{margin-top:6px;font-size:.8rem;color:#1e40af;font-weight:700}.two{display:grid;grid-template-columns:1fr 1fr;gap:8px}input{width:100%;box-sizing:border-box;border:1px solid #dbe3ee;border-radius:11px;padding:9px 10px;font:inherit}.remind-warn{margin-top:8px;background:#fffbeb;border:1px solid #fde68a;color:#92400e;border-radius:11px;padding:8px 10px;font-size:.8rem;line-height:1.4}.primary{width:100%;border:0;border-radius:12px;padding:11px;background:#1d4ed8;color:#fff;font-weight:800;margin-top:12px}.danger{width:100%;border:0;border-radius:12px;padding:9px;background:#fee2e2;color:#991b1b;font-weight:700;font-size:.86rem;margin-top:6px}.group-label{display:flex;justify-content:space-between;align-items:center;padding:4px 0;font-weight:700;color:#475569;font-size:.82rem;cursor:pointer}.group-label span{font-size:.7rem;color:#94a3b8}</style>

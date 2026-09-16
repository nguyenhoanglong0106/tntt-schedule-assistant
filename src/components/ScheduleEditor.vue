<script setup lang="ts">
import { computed, reactive, watch, ref } from 'vue'
import { REMINDER_PRESETS } from '@/lib/constants'
import type { AppData, Assignee, Profile, Schedule, TaskCode } from '@/types'
import { endOfWeek, formatShortDate, readingBranchForDate, startOfWeek, todayISO } from '@/utils/date'
import { normalizeVi } from '@/utils/normalize'

const props=defineProps<{data:AppData;profile:Profile;existing?:Schedule|null;hideReading?:boolean;weekCursor?:string;defaultTask?:{code:TaskCode;date:string}}>()
const taskChoices=computed(()=>props.hideReading?props.data.taskTypes.filter(t=>t.code!=='READING'):props.data.taskTypes)
type QuickSave={id?:string;taskTypeId:string;taskCode:TaskCode;taskName:string;taskIcon:string;branchId:string;date:string;startTime:string|null;endTime:string|null;assignees:Assignee[];reminders:number[]}
const emit=defineEmits<{save:[QuickSave];cancel:[];delete:[]}>()
const form=reactive({taskCode:props.existing?.taskCode??props.defaultTask?.code??('CLEANING' as TaskCode),branchId:props.existing?.branchId??props.profile.branchId??props.data.branches[0]?.id??'',date:props.existing?.date??props.defaultTask?.date??todayISO(),startTime:'06:00',endTime:'07:00',selected:[] as string[],search:'',reminders:[180] as number[]})
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
const needsTime=computed(()=>form.taskCode!=='CLEANING')
function applyTaskDefaultTime(){
  if(props.existing||!needsTime.value)return
  if(branchTimeConfig.value){form.startTime=branchTimeConfig.value.startTime;form.endTime=branchTimeConfig.value.endTime}
  else if(form.taskCode==='READING'){form.startTime=new Date(`${form.date}T12:00:00+07:00`).getDay()===0?'06:00':'17:00';form.endTime=''}
  else if(isFixedDayLocked.value&&fixedDayOfWeek.value===0){form.startTime='06:00';form.endTime='07:00'}
}
watch([()=>form.taskCode,()=>form.branchId],()=>{
  if(!props.existing){
    if(isFixedDayLocked.value)form.date=fixedDate.value;
    applyTaskDefaultTime();
  }
})
function hydrate(){const e=props.existing;if(!e)return;form.taskCode=e.taskCode;form.branchId=e.branchId;form.date=e.date;form.startTime=e.startTime??'';form.endTime=e.endTime??'';form.reminders=[...e.reminderOffsets];form.selected=e.assignees.map(a=>a.type==='MEMBER'?`M:${a.memberId}`:`C:${a.classId}`)}
hydrate();watch(()=>props.existing,hydrate)
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
function toggleReminder(v:number){const i=form.reminders.indexOf(v);if(i>=0)form.reminders.splice(i,1);else form.reminders.push(v)}
function submit(){
 if(form.taskCode==='READING'&&!([0,1,2,4].includes(new Date(`${form.date}T12:00:00+07:00`).getDay()))){alert('Đọc sách chỉ có lịch vào Thứ Hai, Thứ Ba, Thứ Năm và Chủ Nhật.');return}
 const assignees:Assignee[]=form.selected.map(key=>{const [kind,id]=key.split(':');if(kind==='M'){const m=props.data.members.find(x=>x.id===id)!;return{type:'MEMBER',memberId:id,label:m.fullName}}const c=props.data.classes.find(x=>x.id===id)!;return{type:'CLASS',classId:id,label:c.name}})
 emit('save',{id:props.existing?.id,taskTypeId:task.value.id,taskCode:form.taskCode,taskName:task.value.name,taskIcon:task.value.icon,branchId:effectiveBranch.value,date:isFixedDayLocked.value?fixedDate.value:form.date,startTime:needsTime.value?(form.startTime||null):null,endTime:needsTime.value?(form.endTime||null):null,assignees,reminders:[...form.reminders]})
}
</script>
<template><div class="overlay" @click.self="$emit('cancel')"><section class="editor"><div class="handle"></div><div class="head"><div><small>{{existing?'CHỈNH SỬA':'TẠO LỊCH NHANH'}}</small><h3>{{existing?'Cập nhật công việc':'Thêm công việc'}}</h3></div><button class="x" @click="$emit('cancel')">✕</button></div>
<label>Công việc</label><div class="task-grid"><button v-for="t in taskChoices" :key="t.id" :class="{selected:form.taskCode===t.code}" @click="form.taskCode=t.code"><span>{{t.icon}}</span>{{t.name}}</button></div>
<label v-if="profile.role==='SUPER_ADMIN'&&form.taskCode!=='READING'">Ngành</label><div v-if="profile.role==='SUPER_ADMIN'&&form.taskCode!=='READING'" class="chips"><button v-for="b in data.branches" :key="b.id" :class="{selected:form.branchId===b.id}" :style="{'--c':b.colorHex}" @click="form.branchId=b.id">{{b.name}}</button></div>
<div v-if="form.taskCode==='READING'" class="info">📖 Ngành đọc sách tuần này: <strong>{{readingBranch?.name||'Chưa cấu hình'}}</strong></div>
<div v-if="isFixedDayLocked" class="info">📅 Cố định vào {{fixedDayName}} · <strong>{{formatShortDate(fixedDate)}}</strong></div>
<template v-if="!needsTime"><label>Ngày</label><input v-model="form.date" type="date" /></template>
<div v-else-if="isFixedDayLocked" class="two"><div><label>Bắt đầu</label><input v-model="form.startTime" type="time" /></div><div><label>Kết thúc <span>(không bắt buộc)</span></label><input v-model="form.endTime" type="time" /></div></div>
<template v-else><div class="two"><div><label>Ngày</label><input v-model="form.date" type="date" /></div><div><label>Bắt đầu</label><input v-model="form.startTime" type="time" /></div></div><div><label>Kết thúc <span>(không bắt buộc)</span></label><input v-model="form.endTime" type="time" /></div></template>
<label>Người / lớp phụ trách <span>(không chọn = cả Ngành)</span></label><input v-model="form.search" placeholder="Tìm nhanh tên hoặc lớp..." /><div class="choice-list"><template v-for="g in groupedChoices" :key="g.label"><div class="group-label" @click="toggleGroup(g.label)">{{g.label}} <span>{{expandedGroups.includes(g.label)||form.search?'▼':'▶'}}</span></div><template v-if="expandedGroups.includes(g.label)||form.search"><button v-for="c in g.items" :key="c.key" type="button" :class="{selected:form.selected.includes(c.key)}" @click="toggle(c.key)"><span class="checkbox">{{form.selected.includes(c.key)?'✓':''}}</span>{{c.type==='CLASS'?'👥':'👤'}} {{c.label}}</button></template></template><p v-if="!groupedChoices.length" class="subtle no-result">Không tìm thấy.</p></div><div v-if="selectedLabel" class="selected-preview">Đã chọn: {{selectedLabel}}</div>
<label>Nhắc trước</label><div class="chips reminders"><button v-for="r in REMINDER_PRESETS" :key="r" type="button" :class="{selected:form.reminders.includes(r)}" @click="toggleReminder(r)">{{r===1440?'1 ngày':r===720?'12 giờ':r===180?'3 giờ':r===60?'1 giờ':'30 phút'}}</button></div>
<button class="primary" @click="submit">{{existing?'Lưu thay đổi':'Tạo lịch'}}</button><button v-if="existing" class="danger" @click="$emit('delete')">Xóa lịch này</button></section></div></template>
<style scoped>.overlay{position:fixed;inset:0;background:rgba(15,23,42,.4);display:flex;align-items:flex-end;z-index:40}.editor{min-width:0;box-sizing:border-box;background:#fff;width:100%;max-width:480px;margin:auto;border-radius:22px 22px 0 0;padding:8px 16px calc(16px + env(safe-area-inset-bottom));max-height:90vh;overflow-y:auto;overflow-x:hidden;font-size:.92rem}.handle{width:38px;height:4px;background:#cbd5e1;border-radius:5px;margin:0 auto 2px}.head{display:flex;justify-content:space-between;align-items:center}.head small{font-weight:800;color:#64748b;font-size:.72rem}.head h3{margin:1px 0 8px;font-size:1rem}.x{border:0;background:#f1f5f9;border-radius:50%;width:32px;height:32px}label{display:block;font-size:.78rem;font-weight:800;color:#475569;margin:10px 0 6px}label span{font-weight:500;color:#94a3b8}.task-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.task-grid button,.chips button,.choice-list button{border:1px solid #e2e8f0;background:#fff;border-radius:11px;padding:7px;font-size:.82rem;font-weight:700;text-align:left;white-space:normal;word-break:break-word}.task-grid button.selected,.chips button.selected,.choice-list button.selected{border-color:#2563eb;background:#eff6ff;color:#1d4ed8}.task-grid span{margin-right:4px}.chips{display:flex;flex-wrap:wrap;gap:6px}.chips button{padding:6px 9px}.info{margin-top:8px;background:#eff6ff;border-radius:11px;padding:8px 10px;color:#1e40af;font-size:.84rem}.choice-list{display:grid;gap:5px;max-height:170px;overflow:auto;margin-top:6px}.choice-list button{display:flex;align-items:center;gap:7px;padding:7px 9px;line-height:1.2}.checkbox{width:16px;height:16px;border:1.5px solid #cbd5e1;border-radius:5px;display:inline-flex;align-items:center;justify-content:center;font-size:.68rem;font-weight:900;color:#fff;flex-shrink:0}.choice-list button.selected .checkbox{background:#2563eb;border-color:#2563eb}.selected-preview{margin-top:6px;font-size:.8rem;color:#1e40af;font-weight:700}.two{display:grid;grid-template-columns:1fr 1fr;gap:8px}input{width:100%;box-sizing:border-box;border:1px solid #dbe3ee;border-radius:11px;padding:9px 10px;font:inherit}.primary{width:100%;border:0;border-radius:12px;padding:11px;background:#1d4ed8;color:#fff;font-weight:800;margin-top:12px}.danger{width:100%;border:0;border-radius:12px;padding:9px;background:#fee2e2;color:#991b1b;font-weight:700;font-size:.86rem;margin-top:6px}.group-label{display:flex;justify-content:space-between;align-items:center;padding:4px 0;font-weight:700;color:#475569;font-size:.82rem;cursor:pointer}.group-label span{font-size:.7rem;color:#94a3b8}</style>

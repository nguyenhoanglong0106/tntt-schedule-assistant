<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { REMINDER_PRESETS } from '@/lib/constants'
import type { AppData, Assignee, Profile, Schedule, TaskCode } from '@/types'
import { readingBranchForDate, todayISO } from '@/utils/date'
import { normalizeVi } from '@/utils/normalize'

const props=defineProps<{data:AppData;profile:Profile;existing?:Schedule|null}>()
const emit=defineEmits<{save:[Omit<Schedule,'id'> & {id?:string}];cancel:[]}>()
const form=reactive({taskCode:'CLEANING' as TaskCode,branchId:props.profile.branchId??props.data.branches[0]?.id??'',date:todayISO(),startTime:'06:00',endTime:'07:00',selected:[] as string[],reminders:[180] as number[],search:''})
const task=computed(()=>props.data.taskTypes.find(t=>t.code===form.taskCode)!)
const readingBranch=computed(()=>readingBranchForDate(form.date,props.data.rotation,props.data.branches))
const effectiveBranch=computed(()=>form.taskCode==='READING'?readingBranch.value?.id??form.branchId:form.branchId)
const conflicts=computed(()=>{const selectedMembers=form.selected.filter(x=>x.startsWith('M:')).map(x=>x.slice(2));if(!selectedMembers.length||!form.startTime)return[];return props.data.schedules.filter(s=>s.id!==props.existing?.id&&s.date===form.date&&s.startTime&&s.assignees.some(a=>a.memberId&&selectedMembers.includes(a.memberId))&&timeOverlap(form.startTime,form.endTime||form.startTime,s.startTime!,s.endTime||s.startTime!))})
function timeOverlap(aStart:string,aEnd:string,bStart:string,bEnd:string){return aStart<bEnd&&bStart<aEnd}
const choices=computed(()=>{
  const q=normalizeVi(form.search); const bid=effectiveBranch.value
  const members=props.data.members.filter(m=>m.branchId===bid&&(!q||normalizeVi(m.fullName).includes(q))).map(m=>({key:`M:${m.id}`,label:m.fullName,type:'MEMBER' as const,id:m.id}))
  const classes=props.data.classes.filter(c=>c.branchId===bid&&(!q||normalizeVi(c.name).includes(q))).map(c=>({key:`C:${c.id}`,label:c.name,type:'CLASS' as const,id:c.id}))
  return [...members,...classes]
})
function hydrate(){const e=props.existing;if(!e)return;form.taskCode=e.taskCode;form.branchId=e.branchId;form.date=e.date;form.startTime=e.startTime??'';form.endTime=e.endTime??'';form.reminders=[...e.reminderOffsets];form.selected=e.assignees.map(a=>a.type==='MEMBER'?`M:${a.memberId}`:`C:${a.classId}`)}
hydrate();watch(()=>props.existing,hydrate)
watch(effectiveBranch,()=>{if(!props.existing)form.selected=[]})
function toggle(key:string){const i=form.selected.indexOf(key);if(i>=0)form.selected.splice(i,1);else form.selected.push(key)}
function toggleReminder(v:number){const i=form.reminders.indexOf(v);if(i>=0)form.reminders.splice(i,1);else form.reminders.push(v)}
function submit(){
 if(form.taskCode==='READING'&&!([0,1,2,4].includes(new Date(`${form.date}T12:00:00+07:00`).getDay()))){alert('Đọc sách chỉ có lịch vào Thứ Hai, Thứ Ba, Thứ Năm và Chủ Nhật.');return}
 const assignees:Assignee[]=form.selected.map(key=>{const [kind,id]=key.split(':');if(kind==='M'){const m=props.data.members.find(x=>x.id===id)!;return{type:'MEMBER',memberId:id,label:m.fullName}}const c=props.data.classes.find(x=>x.id===id)!;return{type:'CLASS',classId:id,label:c.name}})
 emit('save',{id:props.existing?.id,taskTypeId:task.value.id,taskCode:form.taskCode,taskName:task.value.name,branchId:effectiveBranch.value,date:form.date,startTime:form.startTime||null,endTime:form.endTime||null,status:assignees.length?'ASSIGNED':'UNASSIGNED',notes:props.existing?.notes??null,assignees,reminderOffsets:[...form.reminders],createdBy:props.existing?.createdBy??props.profile.id,completedAt:props.existing?.completedAt??null,completedBy:props.existing?.completedBy??null})
}
</script>
<template><div class="overlay" @click.self="$emit('cancel')"><section class="editor"><div class="handle"></div><div class="head"><div><small>{{existing?'CHỈNH SỬA':'TẠO LỊCH NHANH'}}</small><h3>{{existing?'Cập nhật công việc':'Thêm công việc'}}</h3></div><button class="x" @click="$emit('cancel')">✕</button></div>
<label>Công việc</label><div class="task-grid"><button v-for="t in data.taskTypes" :key="t.id" :class="{selected:form.taskCode===t.code}" @click="form.taskCode=t.code"><span>{{t.icon}}</span>{{t.name}}</button></div>
<label v-if="profile.role==='SUPER_ADMIN'&&form.taskCode!=='READING'">Ngành</label><div v-if="profile.role==='SUPER_ADMIN'&&form.taskCode!=='READING'" class="chips"><button v-for="b in data.branches" :key="b.id" :class="{selected:form.branchId===b.id}" :style="{'--c':b.colorHex}" @click="form.branchId=b.id">{{b.name}}</button></div>
<div v-if="form.taskCode==='READING'" class="info">📖 Ngành đọc sách tuần này: <strong>{{readingBranch?.name||'Chưa cấu hình'}}</strong></div>
<div class="two"><div><label>Ngày</label><input v-model="form.date" type="date" /></div><div><label>Bắt đầu</label><input v-model="form.startTime" type="time" /></div></div><div><label>Kết thúc <span>(không bắt buộc)</span></label><input v-model="form.endTime" type="time" /></div>
<label>Người / lớp phụ trách</label><input v-model="form.search" placeholder="Tìm nhanh tên..." /><div class="choice-list"><button v-for="c in choices" :key="c.key" :class="{selected:form.selected.includes(c.key)}" @click="toggle(c.key)">{{c.type==='CLASS'?'👥':'👤'}} {{c.label}} <span>{{form.selected.includes(c.key)?'✓':''}}</span></button></div>
<div v-if="conflicts.length" class="conflict">⚠️ Có {{conflicts.length}} lịch trùng giờ với người đang chọn. Bạn vẫn có thể lưu nếu đây là chủ ý.</div><label>Nhắc trước</label><div class="chips reminders"><button v-for="r in REMINDER_PRESETS" :key="r" :class="{selected:form.reminders.includes(r)}" @click="toggleReminder(r)">{{r===1440?'1 ngày':r===720?'12 giờ':r===180?'3 giờ':r===60?'1 giờ':'30 phút'}}</button></div>
<button class="primary" @click="submit">{{existing?'Lưu thay đổi':'Tạo lịch'}}</button></section></div></template>
<style scoped>.overlay{position:fixed;inset:0;background:rgba(15,23,42,.4);display:flex;align-items:flex-end;z-index:40}.editor{background:#fff;width:100%;max-width:620px;margin:auto;border-radius:26px 26px 0 0;padding:10px 18px calc(22px + env(safe-area-inset-bottom));max-height:92vh;overflow:auto}.handle{width:42px;height:5px;background:#cbd5e1;border-radius:5px;margin:auto}.head{display:flex;justify-content:space-between;align-items:center}.head small{font-weight:800;color:#64748b}.head h3{margin:2px 0 12px}.x{border:0;background:#f1f5f9;border-radius:50%;width:38px;height:38px}label{display:block;font-size:.82rem;font-weight:800;color:#475569;margin:14px 0 7px}label span{font-weight:500;color:#94a3b8}.task-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.task-grid button,.chips button,.choice-list button{border:1px solid #e2e8f0;background:#fff;border-radius:13px;padding:10px;font-weight:700;text-align:left}.task-grid button.selected,.chips button.selected,.choice-list button.selected{border-color:#2563eb;background:#eff6ff;color:#1d4ed8}.task-grid span{margin-right:5px}.chips{display:flex;flex-wrap:wrap;gap:7px}.chips button{padding:8px 11px}.choice-list{display:grid;gap:6px;max-height:160px;overflow:auto;margin-top:7px}.choice-list button{display:flex;justify-content:space-between}.conflict{margin-top:12px;background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;border-radius:12px;padding:10px;font-size:.82rem;font-weight:700}.info{margin-top:12px;background:#eff6ff;border-radius:12px;padding:10px;color:#1e40af}.two{display:grid;grid-template-columns:1fr 1fr;gap:10px}input{width:100%;box-sizing:border-box;border:1px solid #dbe3ee;border-radius:13px;padding:11px 12px;font:inherit}.primary{width:100%;border:0;border-radius:14px;padding:13px;background:#1d4ed8;color:#fff;font-weight:800;margin-top:18px}</style>

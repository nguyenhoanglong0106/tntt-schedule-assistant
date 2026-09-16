<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import BranchBadge from '@/components/BranchBadge.vue'
import ScheduleEditor from '@/components/ScheduleEditor.vue'
import { useApp } from '@/composables/useApp'
import { REMINDER_PRESETS } from '@/lib/constants'
import { deleteSchedule, findOrCreateMemberByName, saveSchedule } from '@/services/dataService'
import type { Assignee, Schedule } from '@/types'
import { addDays, datesOfWeek, formatShortDate, readingBranchForDate, startOfWeek, todayISO, weekdayLabel, weekLabel } from '@/utils/date'
const {state,refresh}=useApp();const cursor=ref(todayISO());const showEditor=ref(false);const editing=ref<Schedule|null>(null);const defaultTask=ref<{code:string;date:string}|undefined>(undefined)
onMounted(refresh)
const readingBranch=computed(()=>state.data?readingBranchForDate(cursor.value,state.data.rotation,state.data.branches):undefined)
const isReadingDay=(d:string)=>[1,2,4,0].includes(new Date(`${d}T12:00:00+07:00`).getDay())
const hasReading=(d:string)=>state.data?.schedules.some(s=>s.date===d&&s.taskCode==='READING')??false
const itemsFor=(d:string)=>state.data?.schedules.filter(s=>s.date===d).sort((a,b)=>(a.startTime||'99:99').localeCompare(b.startTime||'99:99'))??[]
const showsReadingPlaceholder=(d:string)=>isReadingDay(d)&&!hasReading(d)
const days=computed(()=>datesOfWeek(cursor.value).filter(d=>showsReadingPlaceholder(d)||itemsFor(d).length>0))
const canAssignReading=computed(()=>!!state.profile&&!!readingBranch.value&&(state.profile.role==='SUPER_ADMIN'||state.profile.branchId===readingBranch.value.id))
function branchOf(s:Schedule){return state.data?.branches.find(b=>b.id===s.branchId)}
function canEdit(s:Schedule){return state.profile?.role==='SUPER_ADMIN'||s.branchId===state.profile?.branchId}
async function save(payload:any){
  if(!state.profile)return
  await saveSchedule({id:payload.id,taskTypeId:payload.taskTypeId,taskCode:payload.taskCode,taskName:payload.taskName,taskIcon:payload.taskIcon,branchId:payload.branchId,date:payload.date,startTime:payload.startTime,endTime:payload.endTime,status:'ASSIGNED',notes:null,assignees:payload.assignees,reminderOffsets:payload.reminders,createdBy:state.profile.id,completedAt:null,completedBy:null})
  showEditor.value=false;editing.value=null;defaultTask.value=undefined;await refresh()
}
async function remove(s:Schedule){if(!confirm(`Xóa lịch ${s.taskName}?`))return;await deleteSchedule(s.id);showEditor.value=false;editing.value=null;defaultTask.value=undefined;await refresh()}
function openItem(s:Schedule){if(!canEdit(s))return;editing.value=s;defaultTask.value=undefined;showEditor.value=true}
function openQuickAssign(d:string){if(!canAssignReading.value||!readingBranch.value)return;editing.value=null;defaultTask.value={code:'READING',date:d};showEditor.value=true}

</script>
<template><div class="page" v-if="state.data&&state.profile"><div class="page-head"><div><div class="eyebrow">LỊCH CHUNG</div><h1>{{weekLabel(cursor)}}</h1></div></div>
<div class="reading-week" v-if="readingBranch" :style="{'--c':readingBranch.colorHex}"><span>📖 Tuần đọc sách</span><BranchBadge :branch="readingBranch"/></div><div class="week-switch"><button @click="cursor=addDays(startOfWeek(cursor),-7)">‹</button><button @click="cursor=todayISO()">Tuần này</button><button @click="cursor=addDays(startOfWeek(cursor),7)">›</button></div>
<div class="agenda"><section v-for="d in days" :key="d" class="day"><div class="date"><strong>{{weekdayLabel(d)}}</strong><span>{{formatShortDate(d)}}</span></div><div class="day-list"><button v-if="showsReadingPlaceholder(d)" class="reading-placeholder" :class="{clickable:canAssignReading}" :style="{'--c':readingBranch?.colorHex}" :disabled="!canAssignReading" @click="openQuickAssign(d)"><div><strong>📖 Đọc sách</strong><small>{{canAssignReading?'Bấm để nhập tên người đọc':'Chưa phân công người/lớp'}}</small></div><BranchBadge :branch="readingBranch"/></button><button v-for="s in itemsFor(d)" :key="s.id" class="agenda-item" :style="{'--c':branchOf(s)?.colorHex}" @click="openItem(s)"><div><strong>{{s.taskIcon}} {{s.taskName}}</strong><small>{{s.startTime||''}}{{s.endTime?`–${s.endTime}`:''}} · {{s.assignees.map(a=>a.label).join(', ')||'Chưa phân công'}}</small></div><BranchBadge :branch="branchOf(s)"/></button></div></section></div>
<ScheduleEditor v-if="showEditor" :data="state.data" :profile="state.profile" :existing="editing" :week-cursor="cursor" :default-task="defaultTask" @cancel="showEditor=false;editing=null;defaultTask=undefined" @save="save" @delete="editing&&remove(editing)"/>
</div></template>
<style scoped>.reading-week{display:flex;align-items:center;justify-content:space-between;background:color-mix(in srgb,var(--c) 10%,white);border:1px solid color-mix(in srgb,var(--c) 24%,white);border-radius:15px;padding:10px 12px;margin-bottom:10px;font-weight:800}.reading-placeholder{width:100%;box-sizing:border-box;font:inherit;text-align:left;border:1px dashed var(--c);background:color-mix(in srgb,var(--c) 6%,white);border-radius:14px;padding:11px;display:flex;align-items:center;justify-content:space-between;gap:8px}.reading-placeholder:disabled{opacity:1}.reading-placeholder.clickable{cursor:pointer}.reading-placeholder small{display:block;color:#64748b;margin-top:4px}.overlay{position:fixed;inset:0;background:rgba(15,23,42,.4);display:flex;align-items:flex-end;z-index:40}.week-switch{display:grid;grid-template-columns:46px 1fr 46px;gap:8px;margin-bottom:10px}.week-switch button{border:1px solid #e2e8f0;background:#fff;border-radius:12px;padding:9px;font-weight:800}.agenda{display:grid;gap:10px}.day{display:grid;grid-template-columns:50px 1fr;gap:9px}.date{padding-top:9px;text-align:center}.date strong{display:block;font-size:.82rem;color:#475569}.date span{font-size:.72rem;color:#94a3b8}.day-list{display:grid;gap:7px}.agenda-item{width:100%;border:1px solid #e7edf5;border-left:5px solid var(--c);background:#fff;border-radius:14px;padding:11px;text-align:left;display:flex;justify-content:space-between;align-items:center;gap:8px}.agenda-item strong{display:block}.agenda-item small{display:block;color:#64748b;margin-top:4px}</style>

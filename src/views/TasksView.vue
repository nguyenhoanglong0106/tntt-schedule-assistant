<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import BranchBadge from '@/components/BranchBadge.vue'
import EmptyState from '@/components/EmptyState.vue'
import ScheduleEditor from '@/components/ScheduleEditor.vue'
import { useApp } from '@/composables/useApp'
import { deleteSchedule, saveSchedule } from '@/services/dataService'
import type { Schedule } from '@/types'
import { addDays, datesOfWeek, formatShortDate, startOfWeek, todayISO, weekdayLabel, weekLabel } from '@/utils/date'
const {state,refresh}=useApp();const cursor=ref(todayISO());const showEditor=ref(false);const editing=ref<Schedule|null>(null)
onMounted(refresh)
const days=computed(()=>datesOfWeek(cursor.value).filter(d=>itemsFor(d).length>0))
const itemsFor=(d:string)=>state.data?.schedules.filter(s=>s.taskCode!=='READING'&&s.date===d).sort((a,b)=>(a.startTime||'99:99').localeCompare(b.startTime||'99:99'))??[]
function branchOf(s:Schedule){return state.data?.branches.find(b=>b.id===s.branchId)}
function canEdit(s:Schedule){return state.profile?.role==='SUPER_ADMIN'||s.branchId===state.profile?.branchId}
async function save(payload:any){
  if(!state.profile)return
  await saveSchedule({id:payload.id,taskTypeId:payload.taskTypeId,taskCode:payload.taskCode,taskName:payload.taskName,taskIcon:payload.taskIcon,branchId:payload.branchId,date:payload.date,startTime:payload.startTime,endTime:payload.endTime,status:'ASSIGNED',notes:null,assignees:payload.assignees,reminderOffsets:payload.reminders,createdBy:state.profile.id,completedAt:null,completedBy:null})
  showEditor.value=false;editing.value=null;await refresh()
}
async function remove(s:Schedule){if(!confirm(`Xóa lịch ${s.taskName}?`))return;await deleteSchedule(s.id);showEditor.value=false;editing.value=null;await refresh()}
function openCreate(){editing.value=null;showEditor.value=true}
</script>
<template><div class="page" v-if="state.data&&state.profile"><div class="page-head"><div><div class="eyebrow">CÔNG TÁC</div><h1>{{weekLabel(cursor)}}</h1></div><button class="primary-btn" @click="openCreate">＋ Tạo lịch</button></div>
<div class="week-switch"><button @click="cursor=addDays(startOfWeek(cursor),-7)">‹</button><button @click="cursor=todayISO()">Tuần này</button><button @click="cursor=addDays(startOfWeek(cursor),7)">›</button></div>
<div class="agenda" v-if="days.length"><section v-for="d in days" :key="d" class="day"><div class="date"><strong>{{weekdayLabel(d)}}</strong><span>{{formatShortDate(d)}}</span></div><div class="day-list"><button v-for="s in itemsFor(d)" :key="s.id" class="agenda-item" :style="{'--c':branchOf(s)?.colorHex}" @click="canEdit(s)&&(editing=s,showEditor=true)"><div><strong>{{s.taskIcon}} {{s.taskName}}</strong><small>{{s.startTime||''}}{{s.endTime?`–${s.endTime}`:''}} · {{s.assignees.map(a=>a.label).join(', ')||'Chưa phân công'}}</small></div><BranchBadge :branch="branchOf(s)"/></button></div></section></div>
<EmptyState v-else title="Trống" text="Chưa có lịch công tác trong tuần này." />
<ScheduleEditor v-if="showEditor" :data="state.data" :profile="state.profile" :existing="editing" :week-cursor="cursor" hide-reading @cancel="showEditor=false;editing=null" @save="save" @delete="editing&&remove(editing)"/></div></template>
<style scoped>.week-switch{display:grid;grid-template-columns:46px 1fr 46px;gap:8px;margin-bottom:10px}.week-switch button{border:1px solid #e2e8f0;background:#fff;border-radius:12px;padding:9px;font-weight:800}.agenda{display:grid;gap:10px}.day{display:grid;grid-template-columns:50px 1fr;gap:9px}.date{padding-top:9px;text-align:center}.date strong{display:block;font-size:.82rem;color:#475569}.date span{font-size:.72rem;color:#94a3b8}.day-list{display:grid;gap:7px}.agenda-item{width:100%;border:1px solid #e7edf5;border-left:5px solid var(--c);background:#fff;border-radius:14px;padding:11px;text-align:left;display:flex;justify-content:space-between;align-items:center;gap:8px}.agenda-item strong{display:block}.agenda-item small{display:block;color:#64748b;margin-top:4px}</style>

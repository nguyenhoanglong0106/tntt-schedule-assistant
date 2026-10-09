<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import BranchBadge from '@/components/BranchBadge.vue'
import EmptyState from '@/components/EmptyState.vue'
import ScheduleEditor from '@/components/ScheduleEditor.vue'
import ScopeToggle from '@/components/ScopeToggle.vue'
import { useApp } from '@/composables/useApp'
import { copyWeek, deleteSchedule, saveSchedule } from '@/services/dataService'
import type { Schedule } from '@/types'
import { addDays, datesOfWeek, formatShortDate, startOfWeek, todayISO, weekdayLabel, weekLabel } from '@/utils/date'
import { canEditBranch } from '@/utils/roles'
const {state,refresh,readOnly}=useApp();const cursor=ref(todayISO());const showEditor=ref(false);const editing=ref<Schedule|null>(null)
// Thư ký ngành starts on its own branch
const allBranches=ref(false);const mineOnly=computed(()=>readOnly.value&&!allBranches.value)
onMounted(refresh)
const days=computed(()=>datesOfWeek(cursor.value).filter(d=>itemsFor(d).length>0))
const itemsFor=(d:string)=>state.data?.schedules.filter(s=>s.taskCode!=='READING'&&s.date===d&&(!mineOnly.value||s.branchId===state.profile?.branchId)).sort((a,b)=>(a.startTime||'99:99').localeCompare(b.startTime||'99:99'))??[]
function branchOf(s:Schedule){return state.data?.branches.find(b=>b.id===s.branchId)}
// Schedules without their own time use the branch default (same rule as reminders).
const timeOf=(s:Schedule)=>s.startTime??state.data?.taskTypeBranchTimes.find(t=>t.taskTypeId===s.taskTypeId&&t.branchId===s.branchId)?.startTime??null
const canEdit=(s:Schedule)=>canEditBranch(state.profile,s.branchId)
async function save(payload:any){
  if(!state.profile)return
  await saveSchedule({id:payload.id,taskTypeId:payload.taskTypeId,taskCode:payload.taskCode,taskName:payload.taskName,taskIcon:payload.taskIcon,branchId:payload.branchId,date:payload.date,startTime:payload.startTime,status:'ASSIGNED',notes:null,assignees:payload.assignees,reminderOffsets:payload.reminders,createdBy:state.profile.id,completedAt:null,completedBy:null})
  showEditor.value=false;editing.value=null;await refresh()
}
async function remove(s:Schedule){if(!confirm(`Xóa lịch ${s.taskName}?`))return;await deleteSchedule(s.id);showEditor.value=false;editing.value=null;await refresh()}
function openCreate(){editing.value=null;showEditor.value=true}
// Copy last week's schedules (own branch for branch admins; all for super admin) into the shown week
const prevWeek=computed(()=>addDays(startOfWeek(cursor.value),-7))
const copyScope=computed(()=>state.profile?.role==='SUPER_ADMIN'?null:state.profile?.branchId??null)
const prevCount=computed(()=>state.data?.schedules.filter(s=>s.taskCode!=='READING'&&s.status!=='CANCELLED'&&s.date>=prevWeek.value&&s.date<=addDays(prevWeek.value,6)&&(!copyScope.value||s.branchId===copyScope.value)).length??0)
const copying=ref(false)
async function copyPrev(){
  if(!confirm(`Sao chép ${prevCount.value} lịch của tuần ${weekLabel(prevWeek.value)} sang tuần ${weekLabel(cursor.value)}?\nLịch trùng (cùng ngày, giờ, công việc) sẽ được bỏ qua.`))return
  copying.value=true
  try{const n=await copyWeek(prevWeek.value,startOfWeek(cursor.value),copyScope.value);await refresh();alert(n?`Đã sao chép ${n} lịch.`:'Không có lịch mới nào để sao chép (đã có sẵn).')}
  catch(e:any){alert('Sao chép thất bại: '+(e?.message??e))}
  finally{copying.value=false}
}
</script>
<template><div class="page" v-if="state.data&&state.profile"><div class="page-head"><div><div class="eyebrow">CÔNG TÁC</div><h1>{{weekLabel(cursor)}}</h1></div><button v-if="!readOnly" class="primary-btn" @click="openCreate">＋ Tạo lịch</button></div>
<ScopeToggle v-if="readOnly" v-model="allBranches" :branch="state.data.branches.find(b=>b.id===state.profile?.branchId)"/>
<div class="week-switch"><button @click="cursor=addDays(startOfWeek(cursor),-7)">‹</button><button @click="cursor=todayISO()">Tuần này</button><button @click="cursor=addDays(startOfWeek(cursor),7)">›</button></div>
<button v-if="prevCount&&!readOnly" class="copy-btn" :disabled="copying" @click="copyPrev">{{copying?'Đang sao chép…':`📋 Sao chép ${prevCount} lịch từ tuần trước`}}</button>
<div class="agenda" v-if="days.length"><section v-for="d in days" :key="d" class="day"><div v-for="(s,i) in itemsFor(d)" :key="s.id" class="row"><div class="when"><template v-if="i===0"><strong>{{weekdayLabel(d)}}</strong><span>{{formatShortDate(d)}}</span></template><b>{{timeOf(s)||'--:--'}}</b></div><button class="agenda-item" :style="{'--c':branchOf(s)?.colorHex}" @click="canEdit(s)&&(editing=s,showEditor=true)"><div class="item-top"><strong class="item-title">{{s.taskIcon}} {{s.taskName}}</strong><BranchBadge small :branch="branchOf(s)"/></div><div class="item-who">👤 {{s.assignees.map(a=>a.label).join(', ')||'Cả ngành'}}</div></button></div></section></div>
<EmptyState v-else title="Trống" text="Chưa có lịch công tác trong tuần này." />
<ScheduleEditor v-if="showEditor" :data="state.data" :profile="state.profile" :existing="editing" :week-cursor="cursor" hide-reading @cancel="showEditor=false;editing=null" @save="save" @delete="editing&&remove(editing)"/></div></template>
<style scoped>.week-switch{display:grid;grid-template-columns:46px 1fr 46px;gap:8px;margin-bottom:10px}.week-switch button{border:1px solid #e2e8f0;background:#fff;border-radius:12px;padding:9px;font-weight:800;font-size:.95rem;color:#1e293b}.week-switch button:first-child,.week-switch button:last-child{font-size:1.3rem;line-height:1;color:#475569}.copy-btn{width:100%;margin-bottom:12px;border:1px dashed #93c5fd;background:#eff6ff;color:#1d4ed8;border-radius:12px;padding:10px;font-weight:800}.copy-btn:disabled{opacity:.6}.agenda{display:grid;gap:12px}.day{display:grid;gap:6px}.row{display:grid;grid-template-columns:50px minmax(0,1fr);gap:9px}.when{display:flex;flex-direction:column;align-items:center;padding-top:9px;line-height:1.25}.when strong{font-size:.82rem;color:#475569}.when span{font-size:.72rem;color:#94a3b8}.when b{margin-top:2px;font-size:.8rem;color:#1d4ed8}.agenda-item{width:100%;min-width:0;border:1px solid #e7edf5;border-left:5px solid var(--c);background:#fff;border-radius:14px;padding:10px 12px;text-align:left;display:grid;gap:5px;color:#0f172a}.item-top{display:flex;align-items:center;gap:8px;min-width:0}.item-title{flex:1;min-width:0;font-size:.93rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.item-who{font-size:.82rem;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}</style>

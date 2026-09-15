<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import BranchBadge from '@/components/BranchBadge.vue'
import ScheduleEditor from '@/components/ScheduleEditor.vue'
import { useApp } from '@/composables/useApp'
import { REMINDER_PRESETS } from '@/lib/constants'
import { createMember, deleteSchedule, saveSchedule } from '@/services/dataService'
import type { Schedule } from '@/types'
import { addDays, datesOfWeek, formatShortDate, readingBranchForDate, startOfWeek, todayISO, weekdayLabel, weekLabel } from '@/utils/date'
import { normalizeVi } from '@/utils/normalize'
const {state,refresh}=useApp();const cursor=ref(todayISO());const branchFilter=ref('ALL');const showEditor=ref(false);const editing=ref<Schedule|null>(null);const quickDate=ref<string|null>(null);const quickName=ref('');const quickReminders=ref<number[]>([180]);const quickBusy=ref(false);const quickEditingId=ref<string|null>(null);const quickBranchId=ref<string|null>(null)
onMounted(refresh)
const readingBranch=computed(()=>state.data?readingBranchForDate(cursor.value,state.data.rotation,state.data.branches):undefined)
const isReadingDay=(d:string)=>[1,2,4,0].includes(new Date(`${d}T12:00:00+07:00`).getDay())
const hasReading=(d:string)=>state.data?.schedules.some(s=>s.date===d&&s.taskCode==='READING')??false
const itemsFor=(d:string)=>state.data?.schedules.filter(s=>s.date===d&&(branchFilter.value==='ALL'||s.branchId===branchFilter.value)).sort((a,b)=>(a.startTime||'99:99').localeCompare(b.startTime||'99:99'))??[]
const showsReadingPlaceholder=(d:string)=>isReadingDay(d)&&!hasReading(d)&&(branchFilter.value==='ALL'||branchFilter.value===readingBranch.value?.id)
const days=computed(()=>datesOfWeek(cursor.value).filter(d=>showsReadingPlaceholder(d)||itemsFor(d).length>0))
const canAssignReading=computed(()=>!!state.profile&&!!readingBranch.value&&(state.profile.role==='SUPER_ADMIN'||state.profile.branchId===readingBranch.value.id))
const readingStartTime=(d:string)=>new Date(`${d}T12:00:00+07:00`).getDay()===0?'06:00':'17:00'
const quickTime=computed(()=>quickDate.value?readingStartTime(quickDate.value):'')
function branchOf(s:Schedule){return state.data?.branches.find(b=>b.id===s.branchId)}
function canEdit(s:Schedule){return state.profile?.role==='SUPER_ADMIN'||s.branchId===state.profile?.branchId}
async function save(s:any){await saveSchedule(s);showEditor.value=false;editing.value=null;await refresh()}
async function remove(s:Schedule){if(!confirm(`Xóa lịch ${s.taskName}?`))return;await deleteSchedule(s.id);editing.value=null;await refresh()}
function openItem(s:Schedule){if(!canEdit(s))return;if(s.taskCode==='READING')openQuickEdit(s);else{editing.value=s;showEditor.value=true}}
function closeQuick(){quickDate.value=null;quickEditingId.value=null;quickBranchId.value=null}
function openQuickAssign(d:string){if(!canAssignReading.value||!readingBranch.value)return;quickDate.value=d;quickName.value='';quickReminders.value=[180];quickEditingId.value=null;quickBranchId.value=readingBranch.value.id}
function openQuickEdit(s:Schedule){quickDate.value=s.date;quickName.value=s.assignees[0]?.label??'';quickReminders.value=[...s.reminderOffsets];quickEditingId.value=s.id;quickBranchId.value=s.branchId}
function toggleQuickReminder(v:number){const i=quickReminders.value.indexOf(v);if(i>=0)quickReminders.value.splice(i,1);else quickReminders.value.push(v)}
async function saveQuickAssign(){
  const d=quickDate.value;const branchId=quickBranchId.value;const name=quickName.value.trim()
  if(!d||!branchId||!name||!state.data||!state.profile)return
  quickBusy.value=true
  try{
    const taskType=state.data.taskTypes.find(t=>t.code==='READING')
    if(!taskType)return
    let member=state.data.members.find(m=>m.branchId===branchId&&normalizeVi(m.fullName)===normalizeVi(name))
    if(!member){await createMember(branchId,null,name);await refresh();member=state.data.members.find(m=>m.branchId===branchId&&normalizeVi(m.fullName)===normalizeVi(name))}
    if(!member)return
    await saveSchedule({id:quickEditingId.value??undefined,taskTypeId:taskType.id,taskCode:'READING',taskName:taskType.name,branchId,date:d,startTime:readingStartTime(d),endTime:null,status:'ASSIGNED',notes:null,assignees:[{type:'MEMBER',memberId:member.id,label:member.fullName}],reminderOffsets:[...quickReminders.value],createdBy:state.profile.id,completedAt:null,completedBy:null})
    closeQuick()
    await refresh()
  } finally { quickBusy.value=false }
}
async function removeQuick(){const id=quickEditingId.value;if(!id)return;if(!confirm('Xóa lịch đọc sách này?'))return;await deleteSchedule(id);closeQuick();await refresh()}
</script>
<template><div class="page" v-if="state.data&&state.profile"><div class="page-head"><div><div class="eyebrow">LỊCH CHUNG</div><h1>{{weekLabel(cursor)}}</h1></div></div>
<div class="reading-week" v-if="readingBranch" :style="{'--c':readingBranch.colorHex}"><span>📖 Tuần đọc sách</span><BranchBadge :branch="readingBranch"/></div><div class="week-switch"><button @click="cursor=addDays(startOfWeek(cursor),-7)">‹</button><button @click="cursor=todayISO()">Tuần này</button><button @click="cursor=addDays(startOfWeek(cursor),7)">›</button></div>
<div class="filters"><button :class="{active:branchFilter==='ALL'}" @click="branchFilter='ALL'">Tất cả</button><button v-for="b in state.data.branches" :key="b.id" :style="{'--c':b.colorHex}" :class="{active:branchFilter===b.id}" @click="branchFilter=b.id">{{b.name}}</button></div>
<div class="agenda"><section v-for="d in days" :key="d" class="day"><div class="date"><strong>{{weekdayLabel(d)}}</strong><span>{{formatShortDate(d)}}</span></div><div class="day-list"><button v-if="showsReadingPlaceholder(d)" class="reading-placeholder" :class="{clickable:canAssignReading}" :style="{'--c':readingBranch?.colorHex}" :disabled="!canAssignReading" @click="openQuickAssign(d)"><div><strong>📖 Đọc sách</strong><small>{{canAssignReading?'Bấm để nhập tên người đọc':'Chưa phân công người/lớp'}}</small></div><BranchBadge :branch="readingBranch"/></button><button v-for="s in itemsFor(d)" :key="s.id" class="agenda-item" :style="{'--c':branchOf(s)?.colorHex}" @click="openItem(s)"><div><strong>{{s.taskCode==='READING'?'📖':s.taskCode==='ICE_CREAM'?'🍦':s.taskCode==='OFFICE_DUTY'?'🏢':'🧹'}} {{s.taskName}}</strong><small>{{s.startTime||''}}{{s.endTime?`–${s.endTime}`:''}} · {{s.assignees.map(a=>a.label).join(', ')||'Chưa phân công'}}</small></div><BranchBadge :branch="branchOf(s)"/></button></div></section></div>
<ScheduleEditor v-if="showEditor" :data="state.data" :profile="state.profile" :existing="editing" @cancel="showEditor=false;editing=null" @save="save"/><div v-if="editing&&showEditor&&canEdit(editing)" class="delete-floating"><button @click="remove(editing)">Xóa lịch này</button></div>
<div class="overlay" v-if="quickDate" @click.self="closeQuick"><section class="quick-sheet"><div class="handle"></div><h3>📖 {{quickEditingId?'Chỉnh sửa đọc sách':'Đọc sách'}} · {{formatShortDate(quickDate)}} · {{quickTime}}</h3><p class="subtle">Nhập tên người đọc sách Ngành {{state.data?.branches.find(b=>b.id===quickBranchId)?.name}}. Giờ nhắc sẽ tính theo giờ đọc sách {{quickTime}}.</p><input v-model="quickName" placeholder="Tên người đọc" autofocus @keydown.enter="saveQuickAssign"/><label>Nhắc trước</label><div class="chips reminders"><button v-for="r in REMINDER_PRESETS" :key="r" type="button" :class="{selected:quickReminders.includes(r)}" @click="toggleQuickReminder(r)">{{r===1440?'1 ngày':r===720?'12 giờ':r===180?'3 giờ':r===60?'1 giờ':'30 phút'}}</button></div><button class="primary" :disabled="quickBusy||!quickName.trim()" @click="saveQuickAssign">{{quickBusy?'Đang lưu…':quickEditingId?'Lưu thay đổi':'Lưu'}}</button><button v-if="quickEditingId" class="danger" @click="removeQuick">Xóa lịch này</button><button class="cancel" @click="closeQuick">Hủy</button></section></div>
</div></template>
<style scoped>.reading-week{display:flex;align-items:center;justify-content:space-between;background:color-mix(in srgb,var(--c) 10%,white);border:1px solid color-mix(in srgb,var(--c) 24%,white);border-radius:15px;padding:10px 12px;margin-bottom:10px;font-weight:800}.reading-placeholder{width:100%;box-sizing:border-box;font:inherit;text-align:left;border:1px dashed var(--c);background:color-mix(in srgb,var(--c) 6%,white);border-radius:14px;padding:11px;display:flex;align-items:center;justify-content:space-between;gap:8px}.reading-placeholder:disabled{opacity:1}.reading-placeholder.clickable{cursor:pointer}.reading-placeholder small{display:block;color:#64748b;margin-top:4px}.overlay{position:fixed;inset:0;background:rgba(15,23,42,.4);display:flex;align-items:flex-end;z-index:40}.quick-sheet{background:#fff;width:100%;max-width:480px;margin:auto;border-radius:26px 26px 0 0;padding:10px 18px calc(22px + env(safe-area-inset-bottom));display:grid;gap:10px}.quick-sheet .handle{width:42px;height:5px;background:#cbd5e1;border-radius:5px;margin:0 auto 4px}.quick-sheet h3{margin:0}.quick-sheet input{border:1px solid #dbe3ee;border-radius:13px;padding:11px 12px;font:inherit}.quick-sheet label{font-size:.82rem;font-weight:800;color:#475569;margin:2px 0 -4px}.quick-sheet .chips{display:flex;flex-wrap:wrap;gap:7px}.quick-sheet .chips button{border:1px solid #e2e8f0;background:#fff;border-radius:13px;padding:8px 11px;font-weight:700}.quick-sheet .chips button.selected{border-color:#2563eb;background:#eff6ff;color:#1d4ed8}.quick-sheet .primary{border:0;border-radius:14px;padding:13px;background:#1d4ed8;color:#fff;font-weight:800}.quick-sheet .danger{border:0;border-radius:14px;padding:11px;background:#fee2e2;color:#991b1b;font-weight:800}.quick-sheet .cancel{border:0;border-radius:14px;padding:11px;background:#f1f5f9;color:#475569;font-weight:700}.week-switch{display:grid;grid-template-columns:46px 1fr 46px;gap:8px;margin-bottom:10px}.week-switch button,.filters button{border:1px solid #e2e8f0;background:#fff;border-radius:12px;padding:9px;font-weight:800}.filters{display:flex;gap:7px;overflow:auto;padding-bottom:10px}.filters button{white-space:nowrap}.filters button.active{background:#0f172a;color:#fff}.agenda{display:grid;gap:10px}.day{display:grid;grid-template-columns:50px 1fr;gap:9px}.date{padding-top:9px;text-align:center}.date strong{display:block;font-size:.82rem;color:#475569}.date span{font-size:.72rem;color:#94a3b8}.day-list{display:grid;gap:7px}.agenda-item{width:100%;border:1px solid #e7edf5;border-left:5px solid var(--c);background:#fff;border-radius:14px;padding:11px;text-align:left;display:flex;justify-content:space-between;align-items:center;gap:8px}.agenda-item strong{display:block}.agenda-item small{display:block;color:#64748b;margin-top:4px}.delete-floating{position:fixed;bottom:92px;left:50%;transform:translateX(-50%);z-index:45}.delete-floating button{border:0;background:#fee2e2;color:#991b1b;border-radius:12px;padding:10px 14px;font-weight:800}</style>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import ScheduleCard from '@/components/ScheduleCard.vue'
import EmptyState from '@/components/EmptyState.vue'
import { useApp } from '@/composables/useApp'
import { saveSchedule } from '@/services/dataService'
import type { Schedule } from '@/types'
import { addMonths, datesOfMonth, datesOfWeek, formatDate, monthLabel, readingBranchForDate, todayISO, weekLabel } from '@/utils/date'

const router=useRouter();const {state,refresh}=useApp()
const today=todayISO();const selectedDate=ref(today);const monthCursor=ref(today)
onMounted(refresh)
const readingBranchToday=computed(()=>state.data?readingBranchForDate(today,state.data.rotation,state.data.branches):undefined)
const readingCount=computed(()=>{if(!state.data||!readingBranchToday.value)return{done:0,total:4};const days=datesOfWeek(today).filter(d=>[1,2,4,0].includes(new Date(`${d}T12:00:00+07:00`).getDay()));const done=days.filter(d=>state.data!.schedules.some(s=>s.taskCode==='READING'&&s.date===d&&s.branchId===readingBranchToday.value!.id&&s.assignees.length)).length;return{done,total:4}})
const needsAttention=computed(()=>Math.max(0,readingCount.value.total-readingCount.value.done))
const isReadingDay=(d:string)=>[1,2,4,0].includes(new Date(`${d}T12:00:00+07:00`).getDay())
const monthDays=computed(()=>datesOfMonth(monthCursor.value))
function readingBranchOf(d:string){return state.data&&isReadingDay(d)?readingBranchForDate(d,state.data.rotation,state.data.branches):undefined}
const selectedSchedules=computed(()=>state.data?.schedules.filter(s=>s.date===selectedDate.value).sort((a,b)=>(a.startTime||'99:99').localeCompare(b.startTime||'99:99'))??[])
function branchOf(s:Schedule){return state.data?.branches.find(b=>b.id===s.branchId)}
async function complete(s:Schedule){await saveSchedule({...s,status:'COMPLETED',completedAt:new Date().toISOString(),completedBy:state.profile?.id??null});await refresh()}
</script>
<template><div class="page" v-if="state.data&&state.profile"><div class="page-head"><div><div class="eyebrow">TNTT SCHEDULE</div><h1>Xin chào, {{state.profile.fullName}} 👋</h1><div class="subtle">Tuần {{weekLabel(today)}}</div></div></div>
<h2 class="tight">Cần xử lý</h2><div v-if="needsAttention" class="warning">⚠️ Còn {{needsAttention}} ngày đọc sách chưa có người phụ trách trong tuần này.</div><div v-else class="surface">✅ Phân công đọc sách tuần này đã đầy đủ.</div>
<section class="surface month-card">
<div class="month-head"><button class="icon-btn" @click="monthCursor=addMonths(monthCursor,-1)">‹</button><strong>{{monthLabel(monthCursor)}}</strong><button class="icon-btn" @click="monthCursor=addMonths(monthCursor,1)">›</button></div>
<div class="weekday-row"><span v-for="w in ['T2','T3','T4','T5','T6','T7','CN']" :key="w">{{w}}</span></div>
<div class="month-grid">
<button v-for="c in monthDays" :key="c.date" class="day-cell" :class="{muted:!c.inMonth,selected:c.date===selectedDate,today:c.date===today}" :style="readingBranchOf(c.date)?{'--c':readingBranchOf(c.date)!.colorHex}:{}" @click="selectedDate=c.date">
<span>{{Number(c.date.slice(8,10))}}</span><i v-if="readingBranchOf(c.date)"></i>
</button>
</div>
</section>
<h2 class="tight">{{selectedDate===today?'Hôm nay':formatDate(selectedDate)}}</h2><div class="stack" v-if="selectedSchedules.length"><ScheduleCard v-for="s in selectedSchedules" :key="s.id" :schedule="s" :branch="branchOf(s)" :readonly="state.profile.role==='BRANCH_ADMIN'&&s.branchId!==state.profile.branchId" @complete="complete"/></div><EmptyState v-else class="compact" title="Chưa có công việc" text="Bạn có thể tạo lịch nhanh hoặc hỏi AI."/>
<h2 class="tight">Trợ lý nhanh</h2><button class="ai-entry" @click="router.push('/ai')"><span>✨</span><div><strong>Phân công bằng câu tự nhiên</strong><small>Ví dụ: T2 Minh Thư, T3 Đức đọc sách...</small></div><b>›</b></button>
</div><div v-else class="page"><div class="surface">Đang tải dữ liệu…</div></div></template>
<style scoped>.tight{margin:14px 0 8px}:deep(.empty.compact){padding:14px 18px}:deep(.empty.compact .icon){font-size:1.4rem;margin-bottom:4px}.month-card{padding:12px;margin-top:16px}.month-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;font-weight:800;font-size:.9rem}.month-head .icon-btn{width:28px;height:28px;box-shadow:none;border:1px solid #e2e8f0}.weekday-row{display:grid;grid-template-columns:repeat(7,1fr);text-align:center;font-size:.66rem;font-weight:800;color:#94a3b8;margin-bottom:3px}.month-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:2px}.day-cell{position:relative;aspect-ratio:1/0.8;border:0;background:transparent;border-radius:9px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;font-weight:700;font-size:.82rem;color:#334155}.day-cell.muted{color:#cbd5e1}.day-cell[style*="--c"]{background:color-mix(in srgb,var(--c) 14%,white)}.day-cell i{width:4px;height:4px;border-radius:50%;background:var(--c,transparent)}.day-cell.today span{text-decoration:underline;text-decoration-color:#94a3b8}.day-cell.selected{background:#1d4ed8!important;color:#fff}.day-cell.selected i{background:#fff!important}.ai-entry{width:100%;border:1px solid #dbeafe;background:#fff;border-radius:18px;padding:14px;display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:12px;text-align:left}.ai-entry>span{font-size:1.5rem;background:#eff6ff;border-radius:14px;padding:10px}.ai-entry strong{display:block}.ai-entry small{display:block;color:#64748b;margin-top:3px}.ai-entry b{font-size:1.5rem;color:#94a3b8}</style>

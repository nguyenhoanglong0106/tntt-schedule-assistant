<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import BranchBadge from '@/components/BranchBadge.vue'
import ScheduleCard from '@/components/ScheduleCard.vue'
import ScheduleEditor from '@/components/ScheduleEditor.vue'
import EmptyState from '@/components/EmptyState.vue'
import { useApp } from '@/composables/useApp'
import { saveSchedule } from '@/services/dataService'
import type { Schedule } from '@/types'
import { datesOfWeek, readingBranchForDate, todayISO, weekLabel } from '@/utils/date'

const router=useRouter();const {state,refresh}=useApp();const showEditor=ref(false);const editing=ref<Schedule|null>(null)
onMounted(refresh)
const today=todayISO()
const readingBranch=computed(()=>state.data?readingBranchForDate(today,state.data.rotation,state.data.branches):undefined)
const todaySchedules=computed(()=>state.data?.schedules.filter(s=>s.date===today).sort((a,b)=>(a.startTime||'99:99').localeCompare(b.startTime||'99:99'))??[])
const readingCount=computed(()=>{if(!state.data||!readingBranch.value)return{done:0,total:4};const days=datesOfWeek(today).filter(d=>[1,2,4,0].includes(new Date(`${d}T12:00:00+07:00`).getDay()));const done=days.filter(d=>state.data!.schedules.some(s=>s.taskCode==='READING'&&s.date===d&&s.branchId===readingBranch.value!.id&&s.assignees.length)).length;return{done,total:4}})
const needsAttention=computed(()=>Math.max(0,readingCount.value.total-readingCount.value.done))
function branchOf(s:Schedule){return state.data?.branches.find(b=>b.id===s.branchId)}
async function save(s:any){await saveSchedule(s);showEditor.value=false;editing.value=null;await refresh()}
async function complete(s:Schedule){await saveSchedule({...s,status:'COMPLETED',completedAt:new Date().toISOString(),completedBy:state.profile?.id??null});await refresh()}
</script>
<template><div class="page" v-if="state.data&&state.profile"><div class="page-head"><div><div class="eyebrow">TNTT SCHEDULE</div><h1>Xin chào, {{state.profile.fullName}} 👋</h1><div class="subtle">Tuần {{weekLabel(today)}}</div></div><button class="icon-btn" @click="showEditor=true">＋</button></div>
<section class="hero"><div class="subtle">📖 TUẦN ĐỌC SÁCH</div><div class="row" style="margin-top:8px"><div><div class="count">{{readingBranch?.name||'Chưa cấu hình'}}</div><div style="margin-top:7px">{{readingCount.done}}/{{readingCount.total}} ngày đã phân công</div></div><BranchBadge v-if="readingBranch" :branch="readingBranch"/></div><div class="progress"><i :style="{width:`${readingCount.done/readingCount.total*100}%`}"></i></div></section>
<h2>Cần xử lý</h2><div v-if="needsAttention" class="warning">⚠️ Còn {{needsAttention}} ngày đọc sách chưa có người phụ trách trong tuần này.</div><div v-else class="surface">✅ Phân công đọc sách tuần này đã đầy đủ.</div>
<h2>Hôm nay</h2><div class="stack" v-if="todaySchedules.length"><ScheduleCard v-for="s in todaySchedules" :key="s.id" :schedule="s" :branch="branchOf(s)" :readonly="state.profile.role==='BRANCH_ADMIN'&&s.branchId!==state.profile.branchId" @edit="editing=$event;showEditor=true" @complete="complete"/></div><EmptyState v-else title="Hôm nay chưa có công việc" text="Bạn có thể tạo lịch nhanh hoặc hỏi AI."/>
<h2>Trợ lý nhanh</h2><button class="ai-entry" @click="router.push('/ai')"><span>✨</span><div><strong>Phân công bằng câu tự nhiên</strong><small>Ví dụ: T2 Minh Thư, T3 Đức đọc sách...</small></div><b>›</b></button>
<ScheduleEditor v-if="showEditor" :data="state.data" :profile="state.profile" :existing="editing" @cancel="showEditor=false;editing=null" @save="save"/></div><div v-else class="page"><div class="surface">Đang tải dữ liệu…</div></div></template>
<style scoped>.progress{height:7px;background:rgba(255,255,255,.22);border-radius:8px;margin-top:15px;overflow:hidden}.progress i{display:block;height:100%;background:white;border-radius:8px}.ai-entry{width:100%;border:1px solid #dbeafe;background:#fff;border-radius:18px;padding:14px;display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:12px;text-align:left}.ai-entry>span{font-size:1.5rem;background:#eff6ff;border-radius:14px;padding:10px}.ai-entry strong{display:block}.ai-entry small{display:block;color:#64748b;margin-top:3px}.ai-entry b{font-size:1.5rem;color:#94a3b8}</style>

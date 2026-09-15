<script setup lang="ts">
import { computed, onMounted } from 'vue'
import EmptyState from '@/components/EmptyState.vue'
import BranchBadge from '@/components/BranchBadge.vue'
import { useApp } from '@/composables/useApp'
import { markNotificationRead } from '@/services/dataService'
import { todayISO } from '@/utils/date'
const {state,refresh}=useApp();onMounted(refresh)
const upcoming=computed(()=>state.data?.schedules.filter(s=>s.date>=todayISO()&&s.status!=='COMPLETED'&&s.status!=='CANCELLED').sort((a,b)=>(a.date+(a.startTime||'')).localeCompare(b.date+(b.startTime||''))).slice(0,30)??[])
const unread=computed(()=>state.data?.notifications.filter(n=>!n.readAt)??[])
const label=(m:number)=>m===1440?'1 ngày':m===720?'12 giờ':m===180?'3 giờ':m===60?'1 giờ':`${m} phút`
async function read(id:string){await markNotificationRead(id);await refresh()}
</script>
<template><div class="page" v-if="state.data"><div class="eyebrow">NHẮC VIỆC</div><h1>Thông báo 🔔</h1><div class="stack" v-if="unread.length"><button class="notice" v-for="n in unread" :key="n.id" @click="read(n.id)"><strong>{{n.title}}</strong><span>{{n.body}}</span><small>Chạm để đánh dấu đã đọc</small></button></div><div v-else class="surface subtle">Không có thông báo mới.</div><h2>Lịch sắp tới</h2><div class="stack" v-if="upcoming.length"><article class="surface" v-for="s in upcoming" :key="s.id"><div class="row"><strong>{{s.taskCode==='READING'?'📖':s.taskCode==='ICE_CREAM'?'🍦':s.taskCode==='OFFICE_DUTY'?'🏢':'🧹'}} {{s.taskName}}</strong><BranchBadge :branch="state.data.branches.find(b=>b.id===s.branchId)"/></div><div class="subtle" style="margin-top:7px">{{s.date}} · {{s.startTime||'Chưa đặt giờ'}} · {{s.assignees.map(a=>a.label).join(', ')||'Chưa phân công'}}</div><div class="reminders" v-if="s.reminderOffsets.length"><span v-for="r in s.reminderOffsets" :key="r">⏰ {{label(r)}}</span></div></article></div><EmptyState v-else title="Chưa có lịch sắp tới"/></div></template>
<style scoped>.notice{border:1px solid #bfdbfe;background:#eff6ff;border-radius:15px;padding:12px;text-align:left;color:#1e3a8a}.notice strong,.notice span,.notice small{display:block}.notice span{margin-top:4px}.notice small{color:#64748b;margin-top:6px}.reminders{display:flex;gap:6px;flex-wrap:wrap;margin-top:9px}.reminders span{background:#f1f5f9;border-radius:999px;padding:6px 8px;font-size:.72rem;font-weight:700;color:#475569}</style>

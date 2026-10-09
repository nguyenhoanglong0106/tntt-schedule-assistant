<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AttendanceSheet from '@/components/AttendanceSheet.vue'
import { useApp } from '@/composables/useApp'
import { outboxIds } from '@/services/attendanceOutbox'
import type { Schedule } from '@/types'
import { addDays, todayISO, weekdayLabel } from '@/utils/date'
import { canMark, hasPeople, hasStarted, pendingAttendance, STATUS_META, timeOf } from '@/utils/kpi'
const router=useRouter();const {state,refresh,readOnly}=useApp();const today=todayISO()
// Thư ký ngành cannot mark attendance
onMounted(async()=>{await refresh();if(readOnly.value)router.replace('/')})
const open=ref<Schedule|null>(null)
const pending=computed(()=>state.data&&state.profile?pendingAttendance(state.data,state.profile,today):[])
// Marked in the last 14 days, newest first, so a mistake can still be fixed
const recent=computed(()=>{
  if(!state.data||!state.profile)return[]
  const marked=new Set(state.data.attendance.map(a=>a.scheduleId));const from=addDays(today,-14)
  return state.data.schedules.filter(s=>marked.has(s.id)&&s.date>=from&&canMark(s,state.profile!)).sort((a,b)=>b.date.localeCompare(a.date))
})
function summary(s:Schedule){
  const rows=state.data?.attendance.filter(a=>a.scheduleId===s.id)??[]
  const own=rows.filter(r=>!r.isSubstitute);const ok=own.filter(r=>r.status==='PRESENT'||r.status==='LATE').length;const subs=rows.length-own.length
  return `${ok}/${own.length} có mặt${subs?` · 🔄 ${subs} làm thay`:''}`
}
// Class / whole-branch tasks are marked per person, so the name may not be among the assignees
const nameOf=(s:Schedule,a:{memberId?:string|null;classId?:string|null})=>s.assignees.find(x=>(a.memberId&&x.memberId===a.memberId)||(a.classId&&x.classId===a.classId))?.label??state.data?.members.find(m=>m.id===a.memberId)?.fullName??''
const absentees=(s:Schedule)=>(state.data?.attendance.filter(a=>a.scheduleId===s.id&&!a.isSubstitute&&(a.status==='ABSENT'||a.status==='EXCUSED'))??[]).map(a=>`${STATUS_META[a.status].icon} ${nameOf(s,a)}`)
const who=(s:Schedule)=>s.assignees.length?s.assignees.map(a=>(a.type==='CLASS'?'👥 ':'👤 ')+a.label).join(', '):'👥 Cả ngành'
const branchOf=(s:Schedule)=>state.data?.branches.find(b=>b.id===s.branchId)
const when=(s:Schedule)=>`${s.date===today?'Hôm nay':weekdayLabel(s.date)+' '+s.date.slice(8,10)+'/'+s.date.slice(5,7)}${timeOf(s,state.data!)?' · '+timeOf(s,state.data!):''}`
// Any past day, so a session forgotten long ago (beyond the lists above) can still be marked or fixed
const pickDate=ref('')
const isMarked=(s:Schedule)=>!!state.data?.attendance.some(a=>a.scheduleId===s.id)
const onDate=computed(()=>!state.data||!state.profile||!pickDate.value?[]:state.data.schedules.filter(s=>s.date===pickDate.value&&s.status!=='CANCELLED'&&hasPeople(s,state.data!)&&canMark(s,state.profile!)&&hasStarted(s,state.data!)).sort((a,b)=>(timeOf(a,state.data!)??'').localeCompare(timeOf(b,state.data!)??'')))
async function saved(){open.value=null;await refresh()}
</script>
<template><div class="page" v-if="state.data&&state.profile">
<div class="page-head"><div><div class="eyebrow">ĐÁNH GIÁ</div><h1>📋 Điểm danh</h1></div><button class="back" @click="router.back()">‹ Quay lại</button></div>
<button class="kpi-link" @click="router.push('/kpi')"><span>🏆 Xem Bảng siêng năng</span><b>›</b></button>
<h2>Cần điểm danh <span v-if="pending.length" class="count-badge">{{pending.length}}</span></h2>
<div v-if="pending.length" class="stack"><button v-for="s in pending" :key="s.id" class="item todo" :style="{'--c':branchOf(s)?.colorHex}" @click="open=s"><div class="top"><strong>{{s.taskIcon}} {{s.taskName}}</strong><span class="go">Điểm danh ›</span></div><div class="meta">{{when(s)}} · {{branchOf(s)?.name}}</div><div class="who">{{who(s)}}</div></button></div>
<p v-else class="done-all">🎉 Đã điểm danh hết các công việc.</p>
<h2>📅 Điểm danh bù buổi cũ</h2>
<div class="makeup"><label>Chọn ngày của buổi quên điểm danh hoặc cần sửa<input type="date" v-model="pickDate" :max="today"/></label>
<div v-if="pickDate&&onDate.length" class="stack"><button v-for="s in onDate" :key="s.id" class="item" :class="{todo:!isMarked(s)}" :style="{'--c':branchOf(s)?.colorHex}" @click="open=s"><div class="top"><strong>{{s.taskIcon}} {{s.taskName}}</strong><span v-if="isMarked(s)" class="ok">{{summary(s)}}</span><span v-else class="go">Điểm danh ›</span></div><div class="meta">{{when(s)}} · {{branchOf(s)?.name}}<span v-if="outboxIds.includes(s.id)" class="wait">⏳ Chờ gửi</span></div><div class="who">{{who(s)}}</div></button></div>
<p v-else-if="pickDate" class="subtle">Ngày {{pickDate.slice(8,10)}}/{{pickDate.slice(5,7)}}/{{pickDate.slice(0,4)}} không có buổi nào cần điểm danh.</p>
<p class="note">ℹ️ Điểm danh bù được tính điểm siêng năng vào <b>đúng ngày của buổi đó</b>, không phải ngày bạn điểm danh.</p></div>
<h2>Đã điểm danh (14 ngày qua)</h2>
<div v-if="recent.length" class="stack"><button v-for="s in recent" :key="s.id" class="item" :style="{'--c':branchOf(s)?.colorHex}" @click="open=s"><div class="top"><strong>{{s.taskIcon}} {{s.taskName}}</strong><span class="ok">{{summary(s)}}</span></div><div class="meta">{{when(s)}} · {{branchOf(s)?.name}}<span v-if="outboxIds.includes(s.id)" class="wait">⏳ Chờ gửi</span></div><div v-if="absentees(s).length" class="who">{{absentees(s).join(' · ')}}</div></button></div>
<p v-else class="subtle">Chưa có buổi nào được điểm danh.</p>
<AttendanceSheet v-if="open" :schedule="open" :data="state.data" @close="open=null" @saved="saved"/>
</div></template>
<style scoped>
.back{border:0;background:#fff;border-radius:12px;padding:9px 11px;font-weight:800;color:#475569;box-shadow:0 4px 14px rgba(15,23,42,.06)}
.kpi-link{width:100%;display:flex;justify-content:space-between;align-items:center;border:0;background:linear-gradient(135deg,#f59e0b,#ea580c);color:#fff;border-radius:16px;padding:13px 15px;font-weight:900;box-shadow:0 8px 20px rgba(234,88,12,.25)}
.count-badge{background:#dc2626;color:#fff;border-radius:999px;padding:1px 8px;font-size:.78rem;vertical-align:middle}
.item{width:100%;text-align:left;border:1px solid #e7edf5;border-left:5px solid var(--c);background:#fff;border-radius:14px;padding:10px 12px;display:grid;gap:4px;color:#0f172a}
.item.todo{border-color:#fed7aa;border-left-color:var(--c);background:#fffbf5}
.top{display:flex;justify-content:space-between;align-items:center;gap:8px}.top strong{font-size:.93rem}
.go{font-size:.76rem;font-weight:900;color:#fff;background:#ea580c;border-radius:999px;padding:4px 9px;white-space:nowrap}
.ok{font-size:.76rem;font-weight:800;color:#15803d;white-space:nowrap}
.meta{font-size:.78rem;color:#64748b;font-weight:700}.wait{margin-left:6px;color:#c2410c;background:#fff7ed;border-radius:999px;padding:1px 7px;font-weight:800;white-space:nowrap}.who{font-size:.8rem;color:#475569}
.makeup{display:grid;gap:10px}.note{margin:0;background:#eff6ff;border:1px solid #dbeafe;color:#1e3a8a;border-radius:12px;padding:8px 10px;font-size:.76rem;line-height:1.45;font-weight:600}.makeup label{display:grid;gap:6px;font-size:.82rem;font-weight:700;color:#475569}.makeup input{width:100%;min-width:0;border:1px solid #dbe3ee;border-radius:12px;padding:10px 12px;font-size:16px;background:#fff;color:#0f172a;-webkit-appearance:none;appearance:none;min-height:44px}
.done-all{background:#f0fdf4;border:1px solid #bbf7d0;color:#15803d;border-radius:14px;padding:12px;font-weight:800;margin:0}
</style>

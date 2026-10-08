<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import MonthReportSheet from '@/components/MonthReportSheet.vue'
import { useApp } from '@/composables/useApp'
import { todayISO } from '@/utils/date'
import { computeScores, PERIODS, periodRange, POINTS, STATUS_META, SUBSTITUTE_POINTS, type Period } from '@/utils/kpi'
const router=useRouter();const {state,refresh}=useApp();const today=todayISO()
// Branch heads start on their own branch; everyone may look at the others
const ownBranch=()=>state.profile?.role==='BRANCH_ADMIN'?state.profile.branchId:null
const branchId=ref<string|null>(ownBranch());const period=ref<Period>('schoolYear');const expanded=ref<string|null>(null);const showRules=ref(false)
onMounted(async()=>{await refresh();branchId.value??=ownBranch()})
const range=computed(()=>periodRange(period.value,today))
const scores=computed(()=>state.data?computeScores(state.data,{...range.value,branchId:branchId.value,today}):[])
const active=computed(()=>scores.value.filter(s=>s.assigned||s.substitutes))
const idle=computed(()=>scores.value.filter(s=>!s.assigned&&!s.substitutes))
const podium=computed(()=>active.value.filter(s=>s.points>0).slice(0,3))
const unmarkedTotal=computed(()=>active.value.reduce((t,s)=>t+s.unmarked,0))
const maxPoints=computed(()=>Math.max(1,...active.value.map(s=>s.points)))
const branchName=(id:string)=>state.data?.branches.find(b=>b.id===id)?.name??''
const className=(id?:string|null)=>state.data?.classes.find(c=>c.id===id)?.name??''
const MEDALS=['🥇','🥈','🥉']
const pct=(r:number|null)=>r===null?'—':`${Math.round(r*100)}%`
const dm=(iso:string)=>`${iso.slice(8,10)}/${iso.slice(5,7)}`
// Opened from the 1st-of-month notification (/kpi?report=YYYY-MM) or the button
const route=useRoute()
const reportMonth=ref<string|null>(typeof route.query.report==='string'?route.query.report:null)
function closeReport(){reportMonth.value=null;if(route.query.report)router.replace('/kpi')}
</script>
<template><div class="page" v-if="state.data&&state.profile">
<div class="page-head"><div><div class="eyebrow">ĐÁNH GIÁ</div><h1>🏆 Bảng siêng năng</h1></div><button class="back" @click="router.back()">‹ Quay lại</button></div>
<button class="report-btn" @click="reportMonth=''"><span>📊 Báo cáo tháng <small>(ảnh gửi Zalo / đính kèm họp)</small></span><b>›</b></button>
<div class="seg"><button v-for="p in PERIODS" :key="p.id" :class="{on:period===p.id}" @click="period=p.id">{{p.label}}</button></div>
<div class="chips"><button :class="{on:!branchId}" @click="branchId=null">Cả Đoàn</button><button v-for="b in state.data.branches" :key="b.id" :class="{on:branchId===b.id}" :style="{'--c':b.colorHex}" @click="branchId=b.id">{{b.name}}</button></div>
<div class="range">{{range.label}} · tính đến hôm nay</div>

<button v-if="unmarkedTotal" class="warn" @click="router.push('/attendance')">⚠️ Còn {{unmarkedTotal}} lượt chưa điểm danh, nên điểm số chưa đầy đủ. <b>Điểm danh ›</b></button>

<section v-if="podium.length" class="podium">
  <div v-for="i in [1,0,2]" :key="i" class="place" :class="'p'+i" v-show="podium[i]">
    <template v-if="podium[i]"><div class="medal">{{MEDALS[i]}}</div><div class="pname">{{podium[i].member.fullName.split(' ').slice(-2).join(' ')}}</div><div class="ppts">{{podium[i].points}} điểm</div><div class="block">{{i+1}}</div></template>
  </div>
</section>

<div v-if="active.length" class="rank">
  <div v-for="(s,i) in active" :key="s.member.id" class="row" :class="{open:expanded===s.member.id}" @click="expanded=expanded===s.member.id?null:s.member.id">
    <div class="line1"><span class="no" :class="{top:i<3&&s.points>0}">{{i<3&&s.points>0?MEDALS[i]:i+1}}</span><div class="who"><strong>{{s.member.fullName}}</strong><small>{{!branchId?'Ngành '+branchName(s.member.branchId):className(s.member.classId)||'Chưa xếp lớp'}}</small></div><div class="pts"><b>{{s.points}}</b><small>điểm</small></div></div>
    <div class="bar"><i :style="{width:Math.max(0,s.points)/maxPoints*100+'%'}"></i></div>
    <div class="stats"><span>📌 {{s.assigned}} buổi</span><span>✅ {{s.present}}</span><span>⏰ {{s.late}}</span><span>🟡 {{s.excused}}</span><span>❌ {{s.absent}}</span><span>🔄 {{s.substitutes}}</span><span class="rate">Chuyên cần {{pct(s.rate)}}</span></div>
    <div v-if="s.badges.length||s.unmarked" class="badges"><span v-for="b in s.badges" :key="b">{{b}}</span><span v-if="s.unmarked" class="unmarked">{{s.unmarked}} buổi chưa điểm danh</span></div>
    <div v-if="expanded===s.member.id" class="sessions">
      <div v-for="x in s.sessions" :key="x.schedule.id+(x.isSubstitute?'s':'')" class="sess"><span class="d">{{dm(x.schedule.date)}}</span><span class="t">{{x.schedule.taskIcon}} {{x.schedule.taskName}}<em v-if="x.isSubstitute"> · làm thay</em></span><span class="st" :style="{color:x.status?STATUS_META[x.status].color:'#94a3b8'}">{{x.status?STATUS_META[x.status].icon+' '+STATUS_META[x.status].short:'Chưa điểm danh'}}</span><b :class="{neg:x.points<0}">{{x.points>0?'+':''}}{{x.status?x.points:''}}</b></div>
    </div>
  </div>
</div>
<p v-else class="empty">Chưa có ai được phân công trong {{range.label.toLowerCase()}}.</p>

<details v-if="idle.length" class="idle"><summary>Chưa được phân công lần nào ({{idle.length}})</summary><p>{{idle.map(s=>s.member.fullName).join(', ')}}</p></details>

<button class="rules-btn" @click="showRules=!showRules">ℹ️ Cách tính điểm</button>
<section v-if="showRules" class="rules">
  <div v-for="(p,st) in POINTS" :key="st"><span>{{STATUS_META[st].icon}} {{STATUS_META[st].label}}</span><b :class="{neg:p<0}">{{p>0?'+':''}}{{p}}</b></div>
  <div><span>🔄 Làm thay (có mặt)</span><b>+{{SUBSTITUTE_POINTS.PRESENT}}</b></div>
  <div><span>🔄 Làm thay (đi trễ)</span><b>+{{SUBSTITUTE_POINTS.LATE}}</b></div>
  <p>Chuyên cần = số buổi có mặt hoặc đi trễ ÷ số buổi đã điểm danh. Phân công cho cả lớp không tính vào điểm cá nhân.</p>
</section>
<MonthReportSheet v-if="reportMonth!==null" :data="state.data" :profile="state.profile" :month="reportMonth||undefined" @close="closeReport"/>
</div></template>
<style scoped>
.report-btn{width:100%;display:flex;justify-content:space-between;align-items:center;gap:8px;border:1px solid #c7d2fe;background:#eef2ff;color:#3730a3;border-radius:14px;padding:11px 14px;font-weight:900;margin-bottom:12px;text-align:left}.report-btn small{display:block;font-weight:600;color:#6366f1;font-size:.74rem;margin-top:2px}
.back{border:0;background:#fff;border-radius:12px;padding:9px 11px;font-weight:800;color:#475569;box-shadow:0 4px 14px rgba(15,23,42,.06)}
.seg{display:grid;grid-template-columns:repeat(3,1fr);background:#e2e8f0;border-radius:12px;padding:3px;gap:3px;margin-bottom:10px}.seg button{border:0;background:transparent;border-radius:10px;padding:8px 4px;font-weight:800;font-size:.82rem;color:#475569}.seg button.on{background:#fff;color:#1d4ed8;box-shadow:0 2px 6px rgba(15,23,42,.1)}
.chips{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;margin-bottom:8px}.chips::-webkit-scrollbar{display:none}.chips button{white-space:nowrap;border:1px solid #e2e8f0;background:#fff;border-radius:999px;padding:6px 11px;font-size:.78rem;font-weight:700;color:#475569}.chips button.on{background:var(--c,#1d4ed8);border-color:var(--c,#1d4ed8);color:#fff}
.range{font-size:.78rem;color:#64748b;font-weight:700;margin-bottom:10px}
.warn{width:100%;text-align:left;border:1px solid #fed7aa;background:#fff7ed;color:#9a3412;border-radius:13px;padding:10px 12px;font-size:.8rem;font-weight:700;margin-bottom:12px}.warn b{color:#ea580c;white-space:nowrap}
.podium{display:grid;grid-template-columns:repeat(3,1fr);align-items:end;gap:8px;margin:6px 0 16px;padding:14px 10px 0;background:linear-gradient(180deg,#fef3c7,#fff7ed);border-radius:20px;border:1px solid #fde68a}
.place{display:flex;flex-direction:column;align-items:center;text-align:center;min-width:0}.medal{font-size:2rem;line-height:1}.p0 .medal{font-size:2.5rem}
.pname{font-weight:900;font-size:.82rem;margin-top:4px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ppts{font-size:.74rem;color:#92400e;font-weight:800;margin-bottom:6px}
.block{width:100%;border-radius:12px 12px 0 0;display:grid;place-items:center;color:#fff;font-weight:900;font-size:1.3rem}.p0 .block{height:78px;background:linear-gradient(#f59e0b,#d97706)}.p1 .block{height:56px;background:linear-gradient(#94a3b8,#64748b)}.p2 .block{height:42px;background:linear-gradient(#d97706,#92400e)}
.rank{display:grid;gap:8px}
.row{background:#fff;border:1px solid #e7edf5;border-radius:16px;padding:11px 12px;display:grid;gap:7px;cursor:pointer}.row.open{border-color:#93c5fd}
.line1{display:flex;align-items:center;gap:10px}.no{width:30px;text-align:center;font-weight:900;color:#94a3b8;flex:none}.no.top{font-size:1.35rem}
.who{flex:1;min-width:0;display:grid}.who strong{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:.93rem}.who small{color:#64748b;font-size:.74rem}
.pts{text-align:right;display:grid;line-height:1.1}.pts b{font-size:1.25rem;color:#1d4ed8}.pts small{font-size:.66rem;color:#94a3b8}
.bar{height:6px;background:#f1f5f9;border-radius:99px;overflow:hidden}.bar i{display:block;height:100%;background:linear-gradient(90deg,#60a5fa,#1d4ed8);border-radius:99px}
.stats{display:flex;flex-wrap:wrap;gap:4px 10px;font-size:.74rem;color:#475569;font-weight:700}.stats .rate{margin-left:auto;color:#15803d}
.badges{display:flex;flex-wrap:wrap;gap:5px}.badges span{background:#eff6ff;color:#1e40af;border-radius:999px;padding:3px 8px;font-size:.7rem;font-weight:800}.badges .unmarked{background:#fff7ed;color:#c2410c}
.sessions{border-top:1px dashed #e2e8f0;padding-top:7px;display:grid;gap:5px}
.sess{display:grid;grid-template-columns:42px 1fr auto 30px;gap:6px;align-items:center;font-size:.76rem}.sess .d{color:#64748b;font-weight:800}.sess .t{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.sess em{color:#16a34a;font-style:normal;font-weight:800}.sess .st{font-weight:800;white-space:nowrap}.sess b{text-align:right;color:#15803d}
.neg{color:#dc2626!important}
.empty{color:#64748b;text-align:center;padding:24px 0}
.idle{margin-top:14px;background:#fff;border:1px solid #e7edf5;border-radius:14px;padding:10px 12px;font-size:.82rem}.idle summary{font-weight:800;color:#475569;cursor:pointer}.idle p{margin:8px 0 0;color:#64748b}
.rules-btn{margin-top:14px;border:0;background:transparent;color:#1d4ed8;font-weight:800;padding:4px 0}
.rules{background:#fff;border:1px solid #e7edf5;border-radius:14px;padding:10px 12px;display:grid;gap:6px;font-size:.82rem}.rules div{display:flex;justify-content:space-between}.rules b{color:#15803d}.rules p{margin:4px 0 0;color:#64748b;font-size:.76rem}
</style>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useApp } from '@/composables/useApp'
import { addMonths, monthLabel, todayISO } from '@/utils/date'
import { exportYearExcel, exportYears } from '@/utils/exportExcel'
import { homeBranch } from '@/utils/roles'

const router=useRouter();const {state,refresh}=useApp()
const month=ref(todayISO().slice(0,7))
// Everyone may view every branch ("xem chung"); branch admins start on their own branch.
const ownBranch=()=>homeBranch(state.profile)
const branchId=ref<string|null>(ownBranch())
onMounted(async()=>{await refresh();branchId.value??=ownBranch()})
const taskId=ref<string|null>(null)
const years=computed(()=>state.data?exportYears(state.data,todayISO()):[]);const exportYear=ref(todayISO().slice(0,4));const exporting=ref(false)
async function doExport(){if(!state.data||exporting.value)return;exporting.value=true;try{await exportYearExcel(state.data,exportYear.value)}catch(e:any){alert(e?.message??'Không xuất được file Excel')}finally{exporting.value=false}}

const inScope=computed(()=>state.data?.schedules.filter(s=>s.date.startsWith(month.value)&&s.status!=='CANCELLED'&&(!branchId.value||s.branchId===branchId.value)&&(!taskId.value||s.taskTypeId===taskId.value))??[])

type Row={key:string;name:string;icon:string;total:number}
const rows=computed(()=>{
  const map=new Map<string,Row>()
  for(const s of inScope.value)for(const a of s.assignees){
    const key=a.type==='MEMBER'?`M:${a.memberId}`:`C:${a.classId}`
    const r=map.get(key)??{key,name:a.label,icon:a.type==='MEMBER'?'👤':'👥',total:0}
    r.total++
    map.set(key,r)
  }
  return [...map.values()].sort((a,b)=>b.total-a.total||a.name.localeCompare(b.name))
})
const maxTotal=computed(()=>Math.max(1,...rows.value.map(r=>r.total)))
// Active members of the chosen branch with no assignment this month — candidates for the next turn.
const idle=computed(()=>{
  if(!branchId.value||!state.data)return []
  const used=new Set(rows.value.map(r=>r.key))
  return state.data.members.filter(m=>m.active&&m.branchId===branchId.value&&!used.has(`M:${m.id}`)).map(m=>m.fullName).sort((a,b)=>a.localeCompare(b))
})
</script>
<template><div class="page" v-if="state.data&&state.profile">
<div class="page-head"><div><div class="eyebrow">THỐNG KÊ</div><h1>Phân công</h1></div><button class="back" @click="router.back()">‹ Quay lại</button></div>
<div class="export"><select v-model="exportYear"><option v-for="y in years" :key="y" :value="y">Năm {{y}}</option></select><button :disabled="exporting" @click="doExport">{{exporting?'Đang tạo…':'📊 Xuất Excel'}}</button></div>
<div class="month-switch"><button @click="month=addMonths(`${month}-01`,-1).slice(0,7)">‹</button><strong>{{monthLabel(`${month}-01`)}}</strong><button @click="month=addMonths(`${month}-01`,1).slice(0,7)">›</button></div>
<div class="chips"><button :class="{on:!branchId}" @click="branchId=null">Tất cả ngành</button><button v-for="b in state.data.branches" :key="b.id" :class="{on:branchId===b.id}" :style="{'--c':b.colorHex}" @click="branchId=b.id">{{b.name}}</button></div>
<div class="chips"><button :class="{on:!taskId}" @click="taskId=null">Mọi công việc</button><button v-for="t in state.data.taskTypes" :key="t.id" :class="{on:taskId===t.id}" @click="taskId=t.id">{{t.icon}} {{t.name}}</button></div>
<div class="tiles"><div class="tile"><b>{{inScope.length}}</b><span>Lịch</span></div><div class="tile"><b>{{rows.length}}</b><span>Người / lớp được phân công</span></div></div>
<h2>Số lần được phân công</h2>
<div v-if="rows.length" class="surface list"><div v-for="r in rows" :key="r.key" class="row-item"><div class="who"><span>{{r.icon}} {{r.name}}</span><b>{{r.total}}</b></div><div class="bar"><i :style="{width:`${r.total/maxTotal*100}%`}"></i></div></div></div>
<div v-else class="surface subtle">Chưa có phân công nào trong tháng này.</div>
<template v-if="idle.length"><h2>Chưa được phân công tháng này</h2><div class="surface"><p class="subtle hint">Gợi ý: ưu tiên những người này cho lần phân công tới để chia việc đều hơn.</p><div class="idle"><span v-for="n in idle" :key="n">{{n}}</span></div></div></template>
</div></template>
<style scoped>.export{display:grid;grid-template-columns:auto 1fr;gap:8px;margin-bottom:12px}.export select{border:1px solid #e2e8f0;border-radius:12px;padding:9px 10px;font-weight:800;background:#fff}.export button{border:0;background:#16a34a;color:#fff;border-radius:12px;padding:10px 12px;font-weight:800;white-space:nowrap}.export button:disabled{opacity:.6}.back{border:1px solid #e2e8f0;background:#fff;border-radius:12px;padding:8px 12px;font-weight:700;color:#475569}.month-switch{display:grid;grid-template-columns:44px 1fr 44px;align-items:center;gap:8px;margin-bottom:10px;text-align:center}.month-switch button{border:1px solid #e2e8f0;background:#fff;border-radius:12px;padding:6px;font-size:1.2rem;color:#475569}.month-switch strong{text-transform:capitalize}.chips{display:flex;gap:6px;overflow-x:auto;padding-bottom:4px;margin-bottom:6px;scrollbar-width:none}.chips::-webkit-scrollbar{display:none}.chips button{flex-shrink:0;border:1px solid #e2e8f0;background:#fff;border-radius:999px;padding:6px 11px;font-size:.8rem;font-weight:700;color:#475569}.chips button.on{border-color:var(--c,#2563eb);background:color-mix(in srgb,var(--c,#2563eb) 12%,white);color:#0f172a}.tiles{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-top:8px}.tile{background:#fff;border:1px solid #e7edf5;border-radius:14px;padding:10px;text-align:center}.tile b{display:block;font-size:1.35rem}.tile span{font-size:.75rem;color:#64748b;font-weight:700}.list{display:grid;gap:12px}.who{display:flex;justify-content:space-between;gap:8px;font-size:.88rem;font-weight:700}.bar{height:6px;background:#f1f5f9;border-radius:99px;margin-top:5px;overflow:hidden}.bar i{display:block;height:100%;background:#3b82f6;border-radius:99px}.hint{margin:0 0 8px}.idle{display:flex;flex-wrap:wrap;gap:6px}.idle span{background:#f1f5f9;border-radius:999px;padding:5px 10px;font-size:.8rem;font-weight:600;color:#334155}</style>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useApp } from '@/composables/useApp'
import { saveAttendanceOrQueue } from '@/services/attendanceOutbox'
import type { AppData, Attendance, AttendanceStatus, Schedule } from '@/types'
import { groupMembersOf, isGroupTask, POINTS, STATUS_META, SUBSTITUTE_POINTS, timeOf } from '@/utils/kpi'
import { normalizeVi } from '@/utils/normalize'
const props=defineProps<{schedule:Schedule;data:AppData}>()
const emit=defineEmits<{close:[];saved:[]}>()
const STATUSES:AttendanceStatus[]=['PRESENT','LATE','EXCUSED','ABSENT']
const existing=props.data.attendance.filter(a=>a.scheduleId===props.schedule.id)
const wasMarked=existing.length>0
const own=(match:(e:Attendance)=>boolean)=>existing.find(e=>!e.isSubstitute&&match(e))
type Row={key:string;label:string;memberId:string|null;classId:string|null;group:string;isClass:boolean;status:AttendanceStatus}
// Everyone starts as "Có mặt" so usually only the absent ones need a tap.
// Named people first, then each person of an assigned class / the whole branch, marked one by one.
const list:Row[]=[];const seen=new Set<string>()
for(const a of props.schedule.assignees)if(a.type==='MEMBER'&&a.memberId&&!seen.has(a.memberId)){
  seen.add(a.memberId);list.push({key:a.memberId,label:a.label,memberId:a.memberId,classId:null,group:'',isClass:false,status:own(e=>e.memberId===a.memberId)?.status??'PRESENT'})
}
const groupMembers=groupMembersOf(props.schedule,props.data)
for(const {member,group} of groupMembers)if(!seen.has(member.id)){
  seen.add(member.id)
  // Marked before per-person marking existed: start from the class's status
  const classRow=member.classId?own(e=>e.classId===member.classId):undefined
  list.push({key:member.id,label:member.fullName,memberId:member.id,classId:null,group,isClass:false,status:own(e=>e.memberId===member.id)?.status??classRow?.status??'PRESENT'})
}
// A class with nobody entered in it yet is still marked as one row
for(const a of props.schedule.assignees)if(a.type==='CLASS'&&a.classId&&!groupMembers.some(g=>g.member.classId===a.classId)){
  list.push({key:a.classId,label:a.label,memberId:null,classId:a.classId,group:'',isClass:true,status:own(e=>e.classId===a.classId)?.status??'PRESENT'})
}
const rows=ref(list)
const isGroup=isGroupTask(props.schedule)
const scope=props.schedule.assignees.length?'cả lớp':'cả ngành'
const q=ref('')
const groups=computed(()=>{
  const needle=normalizeVi(q.value.trim())
  const out:{name:string;rows:Row[]}[]=[]
  for(const r of rows.value){
    if(needle&&!normalizeVi(r.label).includes(needle))continue
    let g=out.find(x=>x.name===r.group);if(!g)out.push(g={name:r.group,rows:[]})
    g.rows.push(r)
  }
  return out
})
const pointsNote=`Điểm: Có mặt +${POINTS.PRESENT} · Trễ +${POINTS.LATE} · Có phép ${POINTS.EXCUSED} · Vắng ${POINTS.ABSENT} · Làm thay +${SUBSTITUTE_POINTS.PRESENT}.`
const subs=ref(existing.filter(e=>e.isSubstitute&&e.memberId).map(e=>({memberId:e.memberId!,status:(e.status==='LATE'?'LATE':'PRESENT') as 'PRESENT'|'LATE'})))
const pick=ref('')
const branch=computed(()=>props.data.branches.find(b=>b.id===props.schedule.branchId))
const nameOf=(id:string)=>props.data.members.find(m=>m.id===id)?.fullName??'Chưa rõ'
// Substitutes come from the same branch and are not already on the list
const candidates=computed(()=>props.data.members.filter(m=>m.active&&m.branchId===props.schedule.branchId&&!rows.value.some(r=>r.memberId===m.id)&&!subs.value.some(s=>s.memberId===m.id)))
const absentCount=computed(()=>rows.value.filter(r=>r.status==='EXCUSED'||r.status==='ABSENT').length)
function addSub(){if(!pick.value)return;subs.value.push({memberId:pick.value,status:'PRESENT'});pick.value=''}
function allPresent(list:Row[]=rows.value){list.forEach(r=>r.status='PRESENT')}
const busy=ref(false);const error=ref('')
async function save(){
  busy.value=true;error.value=''
  try{
    const result=await saveAttendanceOrQueue(props.schedule.id,[
      ...rows.value.map(r=>({memberId:r.memberId,classId:r.classId,status:r.status,isSubstitute:false})),
      ...subs.value.map(s=>({memberId:s.memberId,classId:null,status:s.status as AttendanceStatus,isSubstitute:true})),
    ])
    // No signal: it is kept on the phone and sent later; show it as marked right away
    if(result==='queued')useApp().applyPending()
    emit('saved')
  }catch(e:any){error.value=e?.message??'Không lưu được điểm danh'}
  finally{busy.value=false}
}
const dateLabel=`${props.schedule.date.slice(8,10)}/${props.schedule.date.slice(5,7)}`
</script>
<template><Teleport to="body"><div class="overlay sheet-overlay" @click.self="emit('close')"><section class="sheet">
<div class="head"><div><strong>📋 Điểm danh</strong><div class="sub">{{schedule.taskIcon}} {{schedule.taskName}} · {{dateLabel}} {{timeOf(schedule,data)??''}} · <span :style="{color:branch?.colorHex}">{{branch?.name}}</span></div></div><button class="x" @click="emit('close')">✕</button></div>
<div class="body">
<p class="note">ℹ️ <template v-if="isGroup">Việc giao <b>{{scope}}</b>: điểm danh <b>từng người</b>, mỗi người được tính điểm siêng năng riêng. </template>Mọi người mặc định <b>Có mặt</b>, chỉ cần bấm người vắng hoặc trễ. {{pointsNote}}</p>
<div class="tools"><span>{{rows.length}} người cần điểm danh</span><button @click="allPresent()">✅ Tất cả có mặt</button></div>
<input v-if="rows.length>10" v-model="q" class="search" type="search" placeholder="🔍 Tìm tên…"/>
<div class="list">
  <template v-for="g in groups" :key="g.name">
    <div v-if="g.name" class="group"><span>👥 {{g.name}} <small>({{g.rows.length}})</small></span><button @click="allPresent(g.rows)">Cả nhóm có mặt</button></div>
    <div v-for="r in g.rows" :key="r.key" class="person">
      <div class="name">{{r.isClass?'👥 ':''}}{{r.label}}<small v-if="r.isClass"> (cả lớp)</small></div>
      <div class="seg"><button v-for="st in STATUSES" :key="st" :class="{on:r.status===st}" :style="{'--c':STATUS_META[st].color}" @click="r.status=st">{{STATUS_META[st].icon}}<span>{{STATUS_META[st].short}}</span></button></div>
    </div>
  </template>
  <p v-if="q&&!groups.length" class="empty">Không tìm thấy "{{q}}".</p>
</div>
<div class="subs">
  <div class="subs-title">🔄 Người làm thay <small>(+{{SUBSTITUTE_POINTS.PRESENT}} điểm mỗi lần)</small></div>
  <div v-for="(s,i) in subs" :key="s.memberId" class="sub-row"><span>{{nameOf(s.memberId)}}</span><div class="seg small"><button :class="{on:s.status==='PRESENT'}" :style="{'--c':STATUS_META.PRESENT.color}" @click="s.status='PRESENT'">✅ Có mặt</button><button :class="{on:s.status==='LATE'}" :style="{'--c':STATUS_META.LATE.color}" @click="s.status='LATE'">⏰ Trễ</button></div><button class="rm" @click="subs.splice(i,1)">✕</button></div>
  <div class="add-sub"><select v-model="pick"><option value="">{{absentCount?'Chọn người đến làm thay…':'Chọn người làm thay (nếu có)…'}}</option><option v-for="m in candidates" :key="m.id" :value="m.id">{{m.fullName}}</option></select><button :disabled="!pick" @click="addSub">＋ Thêm</button></div>
</div>
</div>
<div class="foot"><p v-if="error" class="err">{{error}}</p>
<button class="primary-btn" :disabled="busy" @click="save">{{busy?'Đang lưu…':wasMarked?'💾 Cập nhật điểm danh':'💾 Lưu điểm danh'}}</button></div>
</section></div></Teleport></template>
<style scoped>
.sheet{width:100%;max-width:560px;max-height:100%;background:#fff;border-radius:22px 22px 0 0;display:flex;flex-direction:column;overflow:hidden}
/* Only the middle scrolls; the save button stays pinned to the bottom */
.body{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:11px 14px;display:grid;gap:11px;align-content:start}
.foot{flex:none;padding:10px 14px calc(12px + env(safe-area-inset-bottom));border-top:1px solid #eef2f7;display:grid;gap:8px}.foot .primary-btn{padding:13px 14px;font-size:.95rem}
.head{flex:none;padding:14px 14px 0;display:flex;justify-content:space-between;align-items:flex-start;gap:10px}.sub{font-size:.8rem;color:#64748b;margin-top:3px;font-weight:700}.x{border:0;background:#f1f5f9;width:34px;height:34px;border-radius:50%;flex:none}
.tools{display:flex;justify-content:space-between;align-items:center;font-size:.8rem;color:#64748b;font-weight:700}.tools button{border:1px solid #bbf7d0;background:#f0fdf4;color:#15803d;border-radius:999px;padding:6px 10px;font-weight:800;font-size:.76rem}
.list{display:grid;gap:8px}.person{border:1px solid #e7edf5;border-radius:14px;padding:9px;display:grid;gap:7px}.name{font-weight:800;font-size:.92rem}.name small{color:#64748b;font-weight:600}
.seg{display:grid;grid-template-columns:repeat(4,1fr);gap:5px}.seg.small{grid-template-columns:1fr 1fr}
.seg button{border:1px solid #e2e8f0;background:#fff;border-radius:10px;padding:7px 2px;font-size:.74rem;font-weight:800;color:#475569;display:flex;flex-direction:column;align-items:center;gap:1px}
.seg.small button{flex-direction:row;justify-content:center;gap:4px;padding:6px}
.seg button.on{background:color-mix(in srgb,var(--c) 14%,white);border-color:var(--c);color:var(--c)}
.subs{background:#f8fafc;border-radius:14px;padding:10px;display:grid;gap:8px}.subs-title{font-weight:800;font-size:.86rem}.subs-title small{color:#16a34a}
.sub-row{display:grid;grid-template-columns:1fr auto auto;gap:6px;align-items:center;font-weight:700;font-size:.86rem}.rm{border:0;background:#fef2f2;color:#b91c1c;border-radius:9px;width:30px;height:30px}
.add-sub{display:grid;grid-template-columns:1fr auto;gap:6px}.add-sub select{border:1px solid #dbe3ee;border-radius:10px;padding:9px;font-size:16px;background:#fff;min-width:0}.add-sub button{border:0;background:#1d4ed8;color:#fff;border-radius:10px;padding:0 12px;font-weight:800}.add-sub button:disabled{opacity:.45}
.note{margin:0;background:#eff6ff;border:1px solid #dbeafe;color:#1e3a8a;border-radius:12px;padding:8px 10px;font-size:.76rem;line-height:1.45;font-weight:600}.search{width:100%;min-width:0;border:1px solid #dbe3ee;border-radius:12px;padding:9px 11px;font-size:16px;background:#fff}
.group{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:4px;font-weight:900;font-size:.86rem;color:#334155}.group small{color:#64748b;font-weight:700}.group button{flex:none;border:1px solid #bbf7d0;background:#f0fdf4;color:#15803d;border-radius:999px;padding:4px 9px;font-weight:800;font-size:.72rem}.empty{margin:0;color:#64748b;font-size:.82rem;text-align:center}
.err{margin:0;color:#b91c1c;font-weight:700;font-size:.82rem}
</style>

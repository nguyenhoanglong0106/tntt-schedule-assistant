<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import BranchBadge from '@/components/BranchBadge.vue'
import TimeInput24 from '@/components/TimeInput24.vue'
import { useApp } from '@/composables/useApp'
import { createTaskType, deactivateTaskType, deleteTaskTypeBranchTime, saveTaskTypeBranchTime, updateTaskType } from '@/services/dataService'
import { todayISO } from '@/utils/date'
const {state,refresh}=useApp();const router=useRouter()
const taskTypeId=ref('');const startTime=ref('06:00');const fixedDayOfWeek=ref<number|null>(null);const branchIds=ref<string[]>([]);const saving=ref(false)
const dayChoices=[{value:null,label:'Tùy ý'},{value:0,label:'Chủ Nhật'},{value:1,label:'Thứ 2'},{value:2,label:'Thứ 3'},{value:3,label:'Thứ 4'},{value:4,label:'Thứ 5'},{value:5,label:'Thứ 6'},{value:6,label:'Thứ 7'}]
onMounted(async()=>{
  await refresh()
  if(state.profile?.role!=='SUPER_ADMIN'){router.replace('/profile');return}
  taskTypeId.value=taskChoices.value[0]?.id??''
})
const taskChoices=computed(()=>state.data?.taskTypes.filter(t=>t.code!=='READING')??[])
const selectedTask=computed(()=>taskChoices.value.find(t=>t.id===taskTypeId.value))
const existingForTask=computed(()=>state.data?.taskTypeBranchTimes.filter(x=>x.taskTypeId===taskTypeId.value)??[])
const branchOf=(id:string)=>state.data?.branches.find(b=>b.id===id)
function pickTask(id:string){taskTypeId.value=id;branchIds.value=[];editingBranch.value=null;typeForm.value=null}
function toggleBranch(id:string){const i=branchIds.value.indexOf(id);if(i>=0)branchIds.value.splice(i,1);else branchIds.value.push(id)}

// ── Giờ của từng ngành ──────────────────────────────────────────────────────
const timeForm=ref<HTMLElement|null>(null)
// The branch whose saved time is loaded into the form for editing
const editingBranch=ref<string|null>(null)
function editExisting(branchId:string){
  const found=existingForTask.value.find(x=>x.branchId===branchId);if(!found)return
  startTime.value=found.startTime.slice(0,5);fixedDayOfWeek.value=found.fixedDayOfWeek??null;branchIds.value=[branchId];editingBranch.value=branchId
  nextTick(()=>timeForm.value?.scrollIntoView({behavior:'smooth',block:'start'}))
}
function cancelEdit(){editingBranch.value=null;branchIds.value=[]}
async function save(){
  if(!taskTypeId.value||!branchIds.value.length)return
  saving.value=true
  try{for(const bid of branchIds.value)await saveTaskTypeBranchTime(taskTypeId.value,bid,startTime.value,fixedDayOfWeek.value)}
  catch(e:any){alert('Không lưu được: '+(e?.message??e))}
  finally{saving.value=false}
  branchIds.value=[];editingBranch.value=null
  await refresh()
}
async function removeTime(branchId:string){
  if(!confirm(`Xóa giờ mặc định "${selectedTask.value?.name}" của Ngành ${branchOf(branchId)?.name}? Lịch mới của ngành này sẽ không còn giờ gợi ý.`))return
  try{await deleteTaskTypeBranchTime(taskTypeId.value,branchId)}catch(e:any){alert('Không xóa được: '+(e?.message??e));return}
  if(editingBranch.value===branchId)cancelEdit()
  await refresh()
}

// ── Công việc: thêm / sửa / xóa ─────────────────────────────────────────────
const typeForm=ref<{id?:string;name:string;icon:string}|null>(null)
function newType(){typeForm.value=typeForm.value&&!typeForm.value.id?null:{name:'',icon:'📌'}}
function editType(){if(selectedTask.value)typeForm.value={id:selectedTask.value.id,name:selectedTask.value.name,icon:selectedTask.value.icon}}
async function submitType(){
  const f=typeForm.value;if(!f||!f.name.trim())return
  try{f.id?await updateTaskType(f.id,f.name.trim(),f.icon.trim()):await createTaskType(f.name.trim(),f.icon.trim()||'📌')}
  catch(e:any){alert('Không lưu được: '+(e?.message??e));return}
  typeForm.value=null;await refresh()
}
async function removeType(){
  const t=selectedTask.value;if(!t)return
  const upcoming=state.data?.schedules.filter(s=>s.taskTypeId===t.id&&s.date>=todayISO()&&s.status!=='CANCELLED').length??0
  if(!confirm(`Xóa công việc "${t.name}"?\n${upcoming?`Còn ${upcoming} lịch sắp tới của công việc này; các lịch đó vẫn giữ nguyên.\n`:''}Công việc sẽ không còn để chọn khi tạo lịch.`))return
  try{await deactivateTaskType(t.id)}catch(e:any){alert('Không xóa được: '+(e?.message??e));return}
  typeForm.value=null;await refresh();pickTask(taskChoices.value[0]?.id??'')
}
</script>
<template><div class="page" v-if="state.data"><div class="page-head"><button class="icon-btn" @click="router.back()">‹</button><div style="flex:1"><div class="eyebrow">SUPER ADMIN</div><h1>Giờ mặc định công việc</h1></div></div>
<p class="subtle">Chọn công việc, chọn giờ, rồi chọn áp dụng cho Ngành nào. Đọc sách có quy tắc giờ riêng nên không hiện ở đây.</p>

<div class="row-head"><h2>Công việc</h2><button class="icon-btn small" aria-label="Thêm công việc" @click="newType">{{typeForm&&!typeForm.id?'✕':'＋'}}</button></div>
<section v-if="typeForm" class="surface form"><strong class="form-title">{{typeForm.id?'✏️ Sửa công việc':'＋ Công việc mới'}}</strong><input v-model="typeForm.name" placeholder="Tên công việc"><input v-model="typeForm.icon" placeholder="Icon (emoji), vd 🎨" maxlength="4"><div class="form-actions"><button class="ghost" @click="typeForm=null">Hủy</button><button class="primary-btn" @click="submitType">{{typeForm.id?'💾 Lưu':'＋ Tạo công việc'}}</button></div></section>
<div class="task-grid"><button v-for="t in taskChoices" :key="t.id" :class="{selected:taskTypeId===t.id}" @click="pickTask(t.id)"><span>{{t.icon}}</span>{{t.name}}</button></div>
<div v-if="selectedTask" class="type-actions"><span>Đang chọn: <b>{{selectedTask.icon}} {{selectedTask.name}}</b></span><div><button @click="editType">✏️ Sửa</button><button class="del" @click="removeType">🗑 Xóa</button></div></div>

<h2 ref="timeForm">Giờ áp dụng</h2>
<section class="surface" :class="{editing:editingBranch}">
<div v-if="editingBranch" class="edit-banner"><span>✏️ Đang sửa giờ của <b>Ngành {{branchOf(editingBranch)?.name}}</b></span><button @click="cancelEdit">Hủy</button></div>
<div class="two"><div><label>Bắt đầu</label><TimeInput24 v-model="startTime" /></div></div>
<label>Ngày cố định <span>(tùy chọn)</span></label>
<div class="chips"><button v-for="d in dayChoices" :key="d.value===null?-1:d.value" type="button" :class="{selected:fixedDayOfWeek===d.value}" @click="fixedDayOfWeek=d.value">{{d.label}}</button></div>
<label>Áp dụng cho Ngành <span>(chọn nhiều được)</span></label>
<div class="chips"><button v-for="b in state.data.branches" :key="b.id" type="button" :class="{selected:branchIds.includes(b.id)}" :style="{'--c':b.colorHex}" @click="toggleBranch(b.id)">{{b.name}}</button></div>
<button class="primary-btn" :disabled="saving||!branchIds.length" @click="save">{{saving?'Đang lưu…':editingBranch?'💾 Lưu thay đổi':'Lưu giờ mặc định'}}</button></section>

<h2>Đã cấu hình cho công việc này</h2>
<div class="stack" v-if="existingForTask.length"><div class="surface row existing" :class="{on:editingBranch===e.branchId}" v-for="e in existingForTask" :key="e.branchId"><div class="ex-main"><BranchBadge :branch="branchOf(e.branchId)"/><span>{{e.startTime.slice(0,5)}} <small v-if="e.fixedDayOfWeek!=null">· {{dayChoices.find(d=>d.value===e.fixedDayOfWeek)?.label}}</small></span></div><div class="ex-actions"><button @click="editExisting(e.branchId)">✏️ Sửa</button><button class="del" @click="removeTime(e.branchId)">🗑 Xóa</button></div></div></div>
<p v-else class="subtle empty-hint">Chưa có Ngành nào được cấu hình giờ cho công việc này.</p>
</div></template>
<style scoped>.row-head{display:flex;align-items:center;justify-content:space-between;margin:18px 0 8px}.row-head h2{margin:0}.icon-btn.small{width:32px;height:32px;box-shadow:none;border:1px solid #e2e8f0}label{display:block;font-size:.82rem;font-weight:800;color:#475569;margin:12px 0 6px}label span{font-weight:500;color:#94a3b8}input{width:100%;box-sizing:border-box;border:1px solid #dbe3ee;border-radius:12px;padding:10px;font-size:16px}.two{display:grid;grid-template-columns:1fr 1fr;gap:10px}.form{display:grid;gap:8px;margin-bottom:10px}.form-title{font-size:.9rem}.form-actions{display:grid;grid-template-columns:1fr 2fr;gap:8px}.form-actions .primary-btn{margin-top:0}.ghost{border:1px solid #e2e8f0;background:#fff;border-radius:13px;font-weight:800;color:#475569}.task-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(118px,1fr));gap:8px}.task-grid button{border:1px solid #e2e8f0;background:#fff;border-radius:13px;padding:10px;font-weight:700;text-align:left}.task-grid button.selected{border-color:#2563eb;background:#eff6ff;color:#1d4ed8}.task-grid span{margin-right:5px}
.type-actions{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:6px 10px;margin-top:10px;font-size:.82rem;color:#475569}.type-actions>div{display:flex;gap:6px}
.type-actions button,.ex-actions button{border:1px solid #e2e8f0;background:#f8fafc;border-radius:10px;padding:6px 10px;font-weight:800;font-size:.78rem;color:#334155;white-space:nowrap}.type-actions .del,.ex-actions .del{color:#b91c1c;background:#fef2f2;border-color:#fecaca}
.chips{display:flex;flex-wrap:wrap;gap:7px}.chips button{border:1px solid #e2e8f0;background:#fff;border-radius:999px;padding:8px 12px;font-weight:700}.chips button.selected{border-color:var(--c);background:color-mix(in srgb,var(--c) 14%,white);color:#1e293b}.primary-btn{width:100%;margin-top:14px}
.surface.editing{border-color:#93c5fd;box-shadow:0 0 0 3px #dbeafe}.edit-banner{display:flex;align-items:center;justify-content:space-between;gap:8px;background:#eff6ff;color:#1e3a8a;border-radius:11px;padding:8px 10px;font-size:.82rem;margin-bottom:4px}.edit-banner button{flex:none;border:0;background:#fff;border-radius:9px;padding:5px 10px;font-weight:800;color:#475569}
.existing{width:100%;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;text-align:left}.existing.on{border-color:#93c5fd;background:#f8fbff}.ex-main{display:flex;align-items:center;gap:10px;min-width:0}.ex-main span{font-weight:800;color:#475569}.ex-actions{display:flex;gap:6px;margin-left:auto}.empty-hint{margin:4px 0}</style>

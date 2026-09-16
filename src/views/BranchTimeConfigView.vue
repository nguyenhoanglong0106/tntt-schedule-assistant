<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import BranchBadge from '@/components/BranchBadge.vue'
import { useApp } from '@/composables/useApp'
import { createTaskType, saveTaskTypeBranchTime } from '@/services/dataService'
const {state,refresh}=useApp();const router=useRouter()
const taskTypeId=ref('');const startTime=ref('06:00');const endTime=ref('07:00');const fixedDayOfWeek=ref<number|null>(null);const branchIds=ref<string[]>([]);const saving=ref(false)
const showAddType=ref(false);const newTypeName=ref('');const newTypeIcon=ref('📌')
const dayChoices=[{value:null,label:'Tùy ý'},{value:0,label:'Chủ Nhật'},{value:1,label:'Thứ 2'},{value:2,label:'Thứ 3'},{value:3,label:'Thứ 4'},{value:4,label:'Thứ 5'},{value:5,label:'Thứ 6'},{value:6,label:'Thứ 7'}]
onMounted(async()=>{
  await refresh()
  if(state.profile?.role!=='SUPER_ADMIN'){router.replace('/profile');return}
  taskTypeId.value=taskChoices.value[0]?.id??''
})
const taskChoices=computed(()=>state.data?.taskTypes.filter(t=>t.code!=='READING')??[])
const existingForTask=computed(()=>state.data?.taskTypeBranchTimes.filter(x=>x.taskTypeId===taskTypeId.value)??[])
function toggleBranch(id:string){const i=branchIds.value.indexOf(id);if(i>=0)branchIds.value.splice(i,1);else branchIds.value.push(id)}
function editExisting(branchId:string){const found=existingForTask.value.find(x=>x.branchId===branchId);if(!found)return;startTime.value=found.startTime;endTime.value=found.endTime;fixedDayOfWeek.value=found.fixedDayOfWeek??null;branchIds.value=[branchId]}
async function save(){
  if(!taskTypeId.value||!branchIds.value.length)return
  saving.value=true
  for(const bid of branchIds.value) await saveTaskTypeBranchTime(taskTypeId.value,bid,startTime.value,endTime.value,fixedDayOfWeek.value)
  saving.value=false;branchIds.value=[]
  await refresh()
}
async function addType(){if(!newTypeName.value.trim())return;await createTaskType(newTypeName.value.trim(),newTypeIcon.value.trim()||'📌');newTypeName.value='';newTypeIcon.value='📌';showAddType.value=false;await refresh()}
</script>
<template><div class="page" v-if="state.data"><div class="page-head"><button class="icon-btn" @click="router.back()">‹</button><div style="flex:1"><div class="eyebrow">SUPER ADMIN</div><h1>Giờ mặc định công việc</h1></div></div>
<p class="subtle">Chọn công việc, chọn giờ, rồi chọn áp dụng cho Ngành nào. Đọc sách có quy tắc giờ riêng nên không hiện ở đây.</p>

<div class="row-head"><h2>Công việc</h2><button class="icon-btn small" @click="showAddType=!showAddType">{{showAddType?'✕':'＋'}}</button></div>
<section v-if="showAddType" class="surface form"><input v-model="newTypeName" placeholder="Tên công việc mới"><input v-model="newTypeIcon" placeholder="Icon (emoji), vd 🎨" maxlength="4"><button class="primary-btn" @click="addType">＋ Tạo công việc</button></section>
<div class="task-grid"><button v-for="t in taskChoices" :key="t.id" :class="{selected:taskTypeId===t.id}" @click="taskTypeId=t.id;branchIds=[]"><span>{{t.icon}}</span>{{t.name}}</button></div>

<h2>Giờ áp dụng</h2>
<section class="surface"><div class="two"><div><label>Bắt đầu</label><input v-model="startTime" type="time"></div><div><label>Kết thúc</label><input v-model="endTime" type="time"></div></div>
<label>Ngày cố định <span>(tùy chọn)</span></label>
<div class="chips"><button v-for="d in dayChoices" :key="d.value===null?-1:d.value" type="button" :class="{selected:fixedDayOfWeek===d.value}" @click="fixedDayOfWeek=d.value">{{d.label}}</button></div>
<label>Áp dụng cho Ngành <span>(chọn nhiều được)</span></label>
<div class="chips"><button v-for="b in state.data.branches" :key="b.id" type="button" :class="{selected:branchIds.includes(b.id)}" :style="{'--c':b.colorHex}" @click="toggleBranch(b.id)">{{b.name}}</button></div>
<button class="primary-btn" :disabled="saving||!branchIds.length" @click="save">{{saving?'Đang lưu…':'Lưu giờ mặc định'}}</button></section>

<h2>Đã cấu hình cho công việc này</h2>
<div class="stack" v-if="existingForTask.length"><button class="surface row existing" v-for="e in existingForTask" :key="e.branchId" @click="editExisting(e.branchId)"><BranchBadge :branch="state.data.branches.find(b=>b.id===e.branchId)"/><span>{{e.startTime}}–{{e.endTime}} <small v-if="e.fixedDayOfWeek!=null">· {{dayChoices.find(d=>d.value===e.fixedDayOfWeek)?.label}}</small></span></button></div>
<p v-else class="subtle empty-hint">Chưa có Ngành nào được cấu hình giờ cho công việc này.</p>
</div></template>
<style scoped>.row-head{display:flex;align-items:center;justify-content:space-between;margin:18px 0 8px}.row-head h2{margin:0}.icon-btn.small{width:32px;height:32px;box-shadow:none;border:1px solid #e2e8f0}label{display:block;font-size:.82rem;font-weight:800;color:#475569;margin:12px 0 6px}label span{font-weight:500;color:#94a3b8}input{width:100%;box-sizing:border-box;border:1px solid #dbe3ee;border-radius:12px;padding:10px}.two{display:grid;grid-template-columns:1fr 1fr;gap:10px}.form{display:grid;gap:8px;margin-bottom:10px}.task-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.task-grid button{border:1px solid #e2e8f0;background:#fff;border-radius:13px;padding:10px;font-weight:700;text-align:left}.task-grid button.selected{border-color:#2563eb;background:#eff6ff;color:#1d4ed8}.task-grid span{margin-right:5px}.chips{display:flex;flex-wrap:wrap;gap:7px}.chips button{border:1px solid #e2e8f0;background:#fff;border-radius:999px;padding:8px 12px;font-weight:700}.chips button.selected{border-color:var(--c);background:color-mix(in srgb,var(--c) 14%,white);color:#1e293b}.primary-btn{width:100%;margin-top:14px}.existing{width:100%;display:flex;align-items:center;justify-content:space-between;text-align:left}.existing span{font-weight:800;color:#475569}.empty-hint{margin:4px 0}</style>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import BranchBadge from '@/components/BranchBadge.vue'
import { useApp } from '@/composables/useApp'
import { createClass, createMember, deactivateClass, deactivateMember } from '@/services/dataService'
import { endOfWeek, startOfWeek, todayISO } from '@/utils/date'
const {state,refresh}=useApp();const router=useRouter();const selectedBranch=ref('');const name=ref('');const classId=ref('');const className=ref('');const showAddMember=ref(false);const showAddClass=ref(false)
onMounted(async()=>{await refresh();selectedBranch.value=state.profile?.branchId??state.data?.branches[0]?.id??''})
const canChooseBranch=computed(()=>state.profile?.role==='SUPER_ADMIN')
const members=computed(()=>state.data?.members.filter(m=>m.branchId===selectedBranch.value&&m.active)??[])
const classes=computed(()=>state.data?.classes.filter(c=>c.branchId===selectedBranch.value)??[])
async function addMember(){if(!name.value.trim())return;await createMember(selectedBranch.value,classId.value||null,name.value.trim());name.value='';showAddMember.value=false;await refresh()}
async function addClass(){if(!className.value.trim())return;await createClass(selectedBranch.value,className.value.trim());className.value='';showAddClass.value=false;await refresh()}
function hasCurrentWeekSchedule(memberId:string):boolean{
  if(!state.data)return false
  const s=startOfWeek(todayISO());const e=endOfWeek(todayISO())
  return state.data.schedules.some(sc=>sc.date>=s&&sc.date<=e&&sc.assignees.some(a=>a.memberId===memberId))
}
async function remove(id:string){
  if(hasCurrentWeekSchedule(id)){alert('Thành viên này đang có lịch trong tuần này. Vui lòng xóa lịch của họ trước, rồi mới xóa được thành viên.');return}
  if(confirm('Xóa thành viên này?')){await deactivateMember(id);await refresh()}
}
async function removeClass(id:string){
  const count=state.data?.members.filter(m=>m.classId===id&&m.active).length??0
  if(count>0){alert(`Lớp này còn ${count} thành viên. Hãy chuyển các thành viên ra khỏi lớp (chọn "Không chọn lớp") trước khi xóa.`);return}
  if(confirm('Xóa lớp này?')){await deactivateClass(id);await refresh()}
}
</script>
<template><div class="page" v-if="state.data&&state.profile"><div class="page-head"><button class="icon-btn" @click="router.back()">‹</button><div style="flex:1"><div class="eyebrow">DANH MỤC</div><h1>Thành viên & lớp</h1></div></div><select v-if="canChooseBranch" class="filters" v-model="selectedBranch" @change="classId=''"><option v-for="b in state.data.branches" :key="b.id" :value="b.id">{{b.name}}</option></select><BranchBadge :branch="state.data.branches.find(b=>b.id===selectedBranch)"/>
<div class="row-head"><h2>Thành viên</h2><button class="icon-btn small" @click="showAddMember=!showAddMember">{{showAddMember?'✕':'＋'}}</button></div>
<section v-if="showAddMember" class="surface form"><input v-model="name" placeholder="Họ tên"><select v-model="classId"><option value="">Không chọn lớp</option><option v-for="c in classes" :key="c.id" :value="c.id">{{c.name}}</option></select><button class="primary-btn" @click="addMember">＋ Thêm</button></section>
<div class="stack people" v-if="members.length"><div class="surface row" v-for="m in members" :key="m.id"><div><strong>{{m.fullName}}</strong><div class="subtle">{{classes.find(c=>c.id===m.classId)?.name||'Chưa xếp lớp'}}</div></div><button class="remove" @click="remove(m.id)">Xóa</button></div></div>
<p v-else class="subtle empty-hint">Chưa có thành viên nào.</p>
<div class="row-head"><h2>Lớp</h2><button class="icon-btn small" @click="showAddClass=!showAddClass">{{showAddClass?'✕':'＋'}}</button></div>
<section v-if="showAddClass" class="surface form"><input v-model="className" placeholder="Tên lớp"><button class="secondary-btn" @click="addClass">＋ Thêm lớp</button></section>
<div class="class-list" v-if="classes.length"><span v-for="c in classes" :key="c.id">👥 {{c.name}} <button class="chip-remove" @click="removeClass(c.id)">✕</button></span></div>
<p v-else class="subtle empty-hint">Chưa có lớp nào.</p>
</div></template>
<style scoped>.filters{display:block;width:100%;border:1px solid #e2e8f0;background:#fff;border-radius:12px;padding:10px 11px;font-weight:800;margin-bottom:10px}.row-head{display:flex;align-items:center;justify-content:space-between;margin:20px 0 8px}.row-head h2{margin:0}.icon-btn.small{width:32px;height:32px;box-shadow:none;border:1px solid #e2e8f0}.form{display:grid;grid-template-columns:1fr;gap:8px;margin-bottom:10px}.form input,.form select{border:1px solid #dbe3ee;border-radius:11px;padding:10px}.people{display:grid;gap:8px}.remove{border:0;background:#fef2f2;color:#b91c1c;border-radius:9px;padding:7px 9px}.class-list{display:flex;gap:7px;flex-wrap:wrap}.class-list span{display:inline-flex;align-items:center;gap:6px;background:#fff;border:1px solid #e2e8f0;border-radius:999px;padding:8px 10px;font-size:.8rem;font-weight:700}.chip-remove{border:0;background:#fef2f2;color:#b91c1c;border-radius:999px;width:18px;height:18px;font-size:.7rem;line-height:1;padding:0}.empty-hint{margin:4px 0}</style>

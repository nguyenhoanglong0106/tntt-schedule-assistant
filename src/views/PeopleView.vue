<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import BranchBadge from '@/components/BranchBadge.vue'
import { useApp } from '@/composables/useApp'
import { createClass, createMember, deactivateMember } from '@/services/dataService'
const {state,refresh}=useApp();const router=useRouter();const selectedBranch=ref('');const name=ref('');const classId=ref('');const className=ref('')
onMounted(async()=>{await refresh();selectedBranch.value=state.profile?.branchId??state.data?.branches[0]?.id??''})
const canChooseBranch=computed(()=>state.profile?.role==='SUPER_ADMIN')
const members=computed(()=>state.data?.members.filter(m=>m.branchId===selectedBranch.value&&m.active)??[])
const classes=computed(()=>state.data?.classes.filter(c=>c.branchId===selectedBranch.value)??[])
async function addMember(){if(!name.value.trim())return;await createMember(selectedBranch.value,classId.value||null,name.value.trim());name.value='';await refresh()}
async function addClass(){if(!className.value.trim())return;await createClass(selectedBranch.value,className.value.trim());className.value='';await refresh()}
async function remove(id:string){if(confirm('Ẩn thành viên này khỏi danh sách đang hoạt động?')){await deactivateMember(id);await refresh()}}
</script>
<template><div class="page" v-if="state.data&&state.profile"><div class="page-head"><button class="icon-btn" @click="router.back()">‹</button><div style="flex:1"><div class="eyebrow">DANH MỤC</div><h1>Thành viên & lớp</h1></div></div><div v-if="canChooseBranch" class="filters"><button v-for="b in state.data.branches" :key="b.id" :class="{active:selectedBranch===b.id}" @click="selectedBranch=b.id;classId=''">{{b.name}}</button></div><BranchBadge :branch="state.data.branches.find(b=>b.id===selectedBranch)"/>
<h2>Thêm thành viên</h2><section class="surface form"><input v-model="name" placeholder="Họ tên"><select v-model="classId"><option value="">Không chọn lớp</option><option v-for="c in classes" :key="c.id" :value="c.id">{{c.name}}</option></select><button class="primary-btn" @click="addMember">＋ Thêm</button></section><div class="stack people"><div class="surface row" v-for="m in members" :key="m.id"><div><strong>{{m.fullName}}</strong><div class="subtle">{{classes.find(c=>c.id===m.classId)?.name||'Chưa xếp lớp'}}</div></div><button class="remove" @click="remove(m.id)">Ẩn</button></div></div>
<h2>Lớp</h2><section class="surface form"><input v-model="className" placeholder="Tên lớp"><button class="secondary-btn" @click="addClass">＋ Thêm lớp</button></section><div class="class-list"><span v-for="c in classes" :key="c.id">👥 {{c.name}}</span></div></div></template>
<style scoped>.filters{display:flex;gap:6px;overflow:auto;margin-bottom:10px}.filters button{border:1px solid #e2e8f0;background:#fff;border-radius:999px;padding:8px 11px;font-weight:700}.filters button.active{background:#0f172a;color:#fff}.form{display:grid;grid-template-columns:1fr;gap:8px}.form input,.form select{border:1px solid #dbe3ee;border-radius:11px;padding:10px}.people{margin-top:10px}.remove{border:0;background:#fef2f2;color:#b91c1c;border-radius:9px;padding:7px 9px}.class-list{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}.class-list span{background:#fff;border:1px solid #e2e8f0;border-radius:999px;padding:8px 10px;font-size:.8rem;font-weight:700}</style>

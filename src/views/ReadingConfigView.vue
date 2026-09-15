<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import BranchBadge from '@/components/BranchBadge.vue'
import { useApp } from '@/composables/useApp'
import { saveRotation } from '@/services/dataService'
import { addDays, readingBranchForDate, startOfWeek, weekLabel } from '@/utils/date'
const {state,refresh}=useApp();const router=useRouter();const saving=ref(false);const form=reactive({startDate:'',startBranchId:''})
onMounted(async()=>{await refresh();if(state.profile?.role!=='SUPER_ADMIN'){router.replace('/profile');return}if(state.data){form.startDate=state.data.rotation.startDate;form.startBranchId=state.data.rotation.startBranchId}})
const preview=computed(()=>{if(!state.data||!form.startDate||!form.startBranchId)return[];const cfg={startDate:form.startDate,startBranchId:form.startBranchId};return Array.from({length:10},(_,i)=>{const date=addDays(startOfWeek(form.startDate),i*7);return{date,branch:readingBranchForDate(date,cfg,state.data!.branches)}})})
async function save(){if(!state.data)return;if(!confirm('Thay đổi cấu hình sẽ ảnh hưởng cách tính Ngành đọc sách các tuần tương lai. Lịch sử cũ không bị xóa. Xác nhận lưu?'))return;saving.value=true;await saveRotation({startDate:startOfWeek(form.startDate),startBranchId:form.startBranchId});saving.value=false;await refresh()}
</script>
<template><div class="page" v-if="state.data"><div class="page-head"><button class="icon-btn" @click="router.back()">‹</button><div style="flex:1"><div class="eyebrow">SUPER ADMIN</div><h1>Cấu hình đọc sách</h1></div></div><section class="surface"><label>Ngày bắt đầu (hệ thống quy về Thứ Hai)</label><input v-model="form.startDate" type="date"><label>Ngành bắt đầu</label><select v-model="form.startBranchId"><option v-for="b in state.data.branches" :key="b.id" :value="b.id">{{b.name}}</option></select><div class="rotation">Chiên → Ấu → Thiếu → Nghĩa → Hiệp → …</div><button class="primary-btn" :disabled="saving" @click="save">{{saving?'Đang lưu…':'Lưu cấu hình'}}</button></section><h2>Xem trước 10 tuần</h2><div class="stack"><div class="surface row" v-for="p in preview" :key="p.date"><strong>{{weekLabel(p.date)}}</strong><BranchBadge :branch="p.branch"/></div></div></div></template>
<style scoped>label{display:block;font-size:.82rem;font-weight:800;color:#475569;margin:10px 0 6px}input,select{width:100%;border:1px solid #dbe3ee;border-radius:12px;padding:11px}.rotation{background:#f8fafc;border-radius:12px;padding:11px;margin:12px 0;color:#475569;font-weight:700}.primary-btn{width:100%}</style>

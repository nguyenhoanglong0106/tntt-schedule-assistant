<script setup lang="ts">
import { ref } from 'vue'
import type { ClassGroup, Member } from '@/types'
import type { MemberDetails } from '@/services/dataService'
const props=defineProps<{member:Member;classes:ClassGroup[]}>()
const emit=defineEmits<{cancel:[];save:[MemberDetails]}>()
const fullName=ref(props.member.fullName);const classId=ref(props.member.classId??'');const error=ref('')
function save(){
  if(!fullName.value.trim()){error.value='Vui lòng nhập họ tên.';return}
  emit('save',{fullName:fullName.value.trim(),classId:classId.value||null})
}
</script>
<template><Teleport to="body"><div class="overlay sheet-overlay" @click.self="emit('cancel')"><section class="sheet">
<div class="head"><strong>✏️ Thông tin thành viên</strong><button class="x" @click="emit('cancel')">✕</button></div>
<div class="body">
<label>Họ tên<input v-model="fullName" placeholder="Họ tên"></label>
<label>Lớp<select v-model="classId"><option value="">Không chọn lớp</option><option v-for="c in classes" :key="c.id" :value="c.id">{{c.name}}</option></select></label>
<p v-if="error" class="err">{{error}}</p>
</div>
<div class="foot"><button class="primary-btn" @click="save">💾 Lưu</button></div>
</section></div></Teleport></template>
<style scoped>
.sheet{width:100%;max-width:560px;max-height:100%;background:#fff;border-radius:22px 22px 0 0;display:flex;flex-direction:column;overflow:hidden}
/* Only the fields scroll; Save stays pinned at the bottom */
.body{flex:1;min-height:0;overflow-y:auto;padding:10px 14px;display:grid;gap:10px;align-content:start}
.foot{flex:none;padding:10px 14px calc(12px + env(safe-area-inset-bottom));border-top:1px solid #eef2f7}.foot .primary-btn{width:100%;padding:13px}
.head{flex:none;padding:14px 14px 0;display:flex;justify-content:space-between;align-items:center}.x{border:0;background:#f1f5f9;width:34px;height:34px;border-radius:50%}
label{display:grid;gap:5px;font-size:.8rem;font-weight:800;color:#475569}
input,select{border:1px solid #dbe3ee;border-radius:11px;padding:10px;font-size:16px;font-weight:500;color:#0f172a;background:#fff;min-width:0}
.err{margin:0;color:#b91c1c;font-size:.82rem;font-weight:700}
</style>

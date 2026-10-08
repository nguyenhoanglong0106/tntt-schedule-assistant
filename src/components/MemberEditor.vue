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
<template><div class="overlay" @click.self="emit('cancel')"><section class="sheet">
<div class="head"><strong>✏️ Thông tin thành viên</strong><button class="x" @click="emit('cancel')">✕</button></div>
<label>Họ tên<input v-model="fullName" placeholder="Họ tên"></label>
<label>Lớp<select v-model="classId"><option value="">Không chọn lớp</option><option v-for="c in classes" :key="c.id" :value="c.id">{{c.name}}</option></select></label>
<p v-if="error" class="err">{{error}}</p>
<button class="primary-btn" @click="save">💾 Lưu</button>
</section></div></template>
<style scoped>
.overlay{position:fixed;inset:0;padding-top:calc(env(safe-area-inset-top) + 16px);background:rgba(15,23,42,.45);display:flex;align-items:flex-end;justify-content:center;z-index:50}
.sheet{width:100%;max-width:560px;max-height:100%;overflow:auto;background:#fff;border-radius:22px 22px 0 0;padding:14px 14px calc(14px + env(safe-area-inset-bottom));display:grid;gap:10px}
.head{display:flex;justify-content:space-between;align-items:center}.x{border:0;background:#f1f5f9;width:34px;height:34px;border-radius:50%}
label{display:grid;gap:5px;font-size:.8rem;font-weight:800;color:#475569}
input,select{border:1px solid #dbe3ee;border-radius:11px;padding:10px;font-size:16px;font-weight:500;color:#0f172a;background:#fff;min-width:0}
.err{margin:0;color:#b91c1c;font-size:.82rem;font-weight:700}
</style>

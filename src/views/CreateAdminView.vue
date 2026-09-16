<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useApp } from '@/composables/useApp'
import { supabase } from '@/lib/supabase'
import { usernameToAuthEmail } from '@/utils/username'
const {state,refresh}=useApp();const router=useRouter();const username=ref('');const password=ref('');const fullName=ref('');const branchId=ref('');const creating=ref(false);const message=ref('')
onMounted(async()=>{await refresh();if(state.profile?.role!=='SUPER_ADMIN'){router.replace('/profile')}})
async function createAdmin(){if(!supabase||!username.value||!password.value||!fullName.value||!branchId.value)return;creating.value=true;message.value='';const{data,error}=await supabase.functions.invoke('admin-create-user',{body:{email:usernameToAuthEmail(username.value),password:password.value,full_name:fullName.value,branch_id:branchId.value}});creating.value=false;message.value=error?error.message:(data?.message??'Đã tạo tài khoản');if(!error){fullName.value='';username.value='';password.value='';branchId.value=''}}
</script>
<template><div class="page" v-if="state.data"><div class="page-head"><button class="icon-btn" @click="router.back()">‹</button><div style="flex:1"><div class="eyebrow">SUPER ADMIN</div><h1>Tạo Admin Ngành</h1></div></div>
<section class="surface"><p class="subtle">Tạo tài khoản đăng nhập mới cho một Ngành.</p><input v-model="fullName" placeholder="Họ tên"/><input v-model="username" type="text" autocapitalize="off" placeholder="Tên đăng nhập"/><input v-model="password" type="password" placeholder="Mật khẩu ban đầu"/><select v-model="branchId"><option value="">Chọn Ngành</option><option v-for="b in state.data.branches" :key="b.id" :value="b.id">{{b.name}}</option></select><button class="primary-btn" :disabled="creating" @click="createAdmin">{{creating?'Đang tạo…':'Tạo tài khoản'}}</button><div class="subtle" v-if="message">{{message}}</div></section>
</div></template>
<style scoped>.surface input,.surface select{width:100%;border:1px solid #dbe3ee;border-radius:11px;padding:10px;margin-top:8px}.surface .primary-btn{width:100%;margin-top:10px}</style>

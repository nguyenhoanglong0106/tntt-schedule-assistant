<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useApp } from '@/composables/useApp'
import { supabase } from '@/lib/supabase'
import type { Role } from '@/types'
import { ROLE_LABEL } from '@/utils/roles'
import { usernameToAuthEmail } from '@/utils/username'
const {state,refresh}=useApp();const router=useRouter();const role=ref<Role>('BRANCH_ADMIN');const username=ref('');const password=ref('');const fullName=ref('');const branchId=ref('');const creating=ref(false);const message=ref('');const failed=ref(false)
// Existing branch logins, so Ban điều hành sees which branch already has its thư ký
const accounts=ref<{fullName:string;role:Role;branchId:string|null}[]>([])
async function loadAccounts(){if(!supabase)return;const{data}=await supabase.from('profiles').select('full_name,role,branch_id').neq('role','SUPER_ADMIN').order('full_name');accounts.value=(data??[]).map((p:any)=>({fullName:p.full_name,role:p.role,branchId:p.branch_id}))}
onMounted(async()=>{await refresh();if(state.profile?.role!=='SUPER_ADMIN'){router.replace('/profile');return}loadAccounts().catch(()=>undefined)})
const accountsOf=(bid:string)=>accounts.value.filter(a=>a.branchId===bid)
const existingSecretary=computed(()=>role.value==='BRANCH_SECRETARY'&&branchId.value?accountsOf(branchId.value).find(a=>a.role==='BRANCH_SECRETARY'):undefined)
async function createAdmin(){if(!supabase||!username.value||!password.value||!fullName.value||!branchId.value)return;creating.value=true;message.value='';const{data,error}=await supabase.functions.invoke('admin-create-user',{body:{email:usernameToAuthEmail(username.value),password:password.value,full_name:fullName.value,branch_id:branchId.value,role:role.value,username:username.value.trim()}});creating.value=false;failed.value=!!error;message.value=error?error.message:(data?.message??'Đã tạo tài khoản');if(!error){fullName.value='';username.value='';password.value='';branchId.value='';loadAccounts().catch(()=>undefined)}}
</script>
<template><div class="page" v-if="state.data"><div class="page-head"><button class="icon-btn" @click="router.back()">‹</button><div style="flex:1"><div class="eyebrow">SUPER ADMIN</div><h1>Tạo tài khoản ngành</h1></div></div>
<section class="surface">
<div class="roles"><button :class="{on:role==='BRANCH_ADMIN'}" @click="role='BRANCH_ADMIN'">👤 Admin ngành</button><button :class="{on:role==='BRANCH_SECRETARY'}" @click="role='BRANCH_SECRETARY'">👀 Thư ký ngành</button></div>
<p class="subtle">{{role==='BRANCH_ADMIN'?'Trưởng ngành: tạo/sửa lịch, điểm danh và chọn món ăn sáng cho ngành mình.':'Tài khoản dùng chung cho thành viên trong ngành: chỉ xem lịch công tác, đọc sách… của ngành và nhận thông báo nhắc việc như trưởng ngành. Không sửa được gì. Tên đăng nhập và mật khẩu sẽ hiện cho trưởng ngành để gửi thành viên, nên đừng dùng mật khẩu cá nhân.'}}</p>
<input v-model="fullName" :placeholder="role==='BRANCH_ADMIN'?'Họ tên':'Tên hiển thị, VD: Thư ký Ngành Thiếu'"/><input v-model="username" type="text" autocapitalize="off" :placeholder="role==='BRANCH_ADMIN'?'Tên đăng nhập':'Tên đăng nhập, VD: thuky.thieu'"/><input v-model="password" :type="role==='BRANCH_SECRETARY'?'text':'password'" placeholder="Mật khẩu ban đầu" autocomplete="new-password"/><select v-model="branchId"><option value="">Chọn Ngành</option><option v-for="b in state.data.branches" :key="b.id" :value="b.id">{{b.name}}</option></select>
<p v-if="existingSecretary" class="warn">⚠️ Ngành này đã có tài khoản thư ký: <b>{{existingSecretary.fullName}}</b>. Thường mỗi ngành chỉ cần 1 tài khoản, các thành viên đăng nhập chung.</p>
<button class="primary-btn" :disabled="creating" @click="createAdmin">{{creating?'Đang tạo…':role==='BRANCH_ADMIN'?'Tạo tài khoản Admin':'Tạo tài khoản Thư ký'}}</button><div class="msg" :class="{err:failed}" v-if="message">{{message}}</div></section>
<template v-if="accounts.length"><h2>Tài khoản hiện có</h2><div class="stack"><div v-for="b in state.data.branches" :key="b.id" class="surface acc" :style="{'--c':b.colorHex}"><strong><i></i>{{b.name}}</strong><span v-for="a in accountsOf(b.id)" :key="a.fullName+a.role">{{a.fullName}} <small :class="{sec:a.role==='BRANCH_SECRETARY'}">{{ROLE_LABEL[a.role]}}</small></span><span v-if="!accountsOf(b.id).length" class="none">Chưa có tài khoản</span></div></div></template>
</div></template>
<style scoped>.surface input,.surface select{width:100%;border:1px solid #dbe3ee;border-radius:11px;padding:10px;margin-top:8px;font-size:16px}.surface .primary-btn{width:100%;margin-top:10px}
.roles{display:grid;grid-template-columns:1fr 1fr;gap:4px;background:#eef2f7;border-radius:12px;padding:3px}.roles button{border:0;background:transparent;border-radius:10px;padding:9px 6px;font-weight:800;font-size:.86rem;color:#64748b}.roles button.on{background:#fff;color:#0f172a;box-shadow:0 2px 8px rgba(15,23,42,.08)}
.subtle{margin:10px 0 2px;font-size:.8rem;line-height:1.45}.warn{margin:8px 0 0;background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;border-radius:11px;padding:8px 10px;font-size:.8rem;line-height:1.4}
.msg{margin-top:10px;font-weight:700;font-size:.86rem;color:#166534}.msg.err{color:#b91c1c}
.acc{padding:11px 13px;display:grid;gap:4px;font-size:.84rem}.acc strong{display:flex;align-items:center;gap:7px}.acc i{width:9px;height:9px;border-radius:50%;background:var(--c)}.acc small{font-size:.7rem;font-weight:800;color:#1d4ed8;background:#eff6ff;border-radius:999px;padding:1px 7px;margin-left:4px}.acc small.sec{color:#166534;background:#f0fdf4}.acc .none{color:#94a3b8}</style>

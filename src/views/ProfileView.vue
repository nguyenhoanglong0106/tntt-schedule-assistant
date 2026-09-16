<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import BranchBadge from '@/components/BranchBadge.vue'
import { useApp } from '@/composables/useApp'
import { useAuth } from '@/composables/useAuth'
import { resetDemo, setDemoProfile } from '@/services/dataService'
const {state,refresh}=useApp();const {signOut,demoMode}=useAuth();const router=useRouter()
onMounted(refresh)
async function logout(){await signOut();if(demoMode){resetDemo();location.reload()}else router.replace('/login')}
async function switchDemo(bid:string|null){if(!state.profile)return;setDemoProfile({...state.profile,role:bid?'BRANCH_ADMIN':'SUPER_ADMIN',branchId:bid,fullName:bid?`Admin ${state.data?.branches.find(b=>b.id===bid)?.name}`:'Trưởng Đoàn'});await refresh()}
</script>
<template><div class="page" v-if="state.profile&&state.data"><div class="eyebrow">TÀI KHOẢN</div><h1>Cá nhân 👤</h1><section class="surface profile"><div class="avatar">{{state.profile.fullName.slice(0,1).toUpperCase()}}</div><div><strong>{{state.profile.fullName}}</strong><div class="subtle">{{state.profile.role==='SUPER_ADMIN'?'Super Admin':'Admin Ngành'}}</div><BranchBadge v-if="state.profile.branchId" :branch="state.data.branches.find(b=>b.id===state.profile?.branchId)"/></div></section>
<h2>Quản lý</h2><div class="stack"><button class="menu" @click="router.push('/people')"><span>👥 Thành viên</span><b>›</b></button><button v-if="state.profile.role==='SUPER_ADMIN'" class="menu" @click="router.push('/branch-times')"><span>⏰ Giờ mặc định Ngành</span><b>›</b></button><button v-if="state.profile.role==='SUPER_ADMIN'" class="menu" @click="router.push('/reading-config')"><span>📖 Cấu hình vòng đọc sách</span><b>›</b></button><button v-if="state.profile.role==='SUPER_ADMIN'" class="menu" @click="router.push('/create-admin')"><span>➕ Tạo Admin Ngành</span><b>›</b></button></div>
<section v-if="demoMode" class="surface demo"><strong>🧪 Chế độ Demo</strong><p>Chuyển vai để thử quyền “xem chung – sửa riêng”.</p><div class="demo-grid"><button @click="switchDemo(null)">Super Admin</button><button v-for="b in state.data.branches" :key="b.id" @click="switchDemo(b.id)">Admin {{b.name}}</button></div></section>
<button class="logout" @click="logout">{{demoMode?'Reset dữ liệu demo':'Đăng xuất'}}</button></div></template>
<style scoped>.profile{display:flex;align-items:center;gap:13px}.avatar{width:54px;height:54px;border-radius:17px;background:#dbeafe;color:#1d4ed8;display:grid;place-items:center;font-size:1.4rem;font-weight:900}.menu{border:1px solid #e2e8f0;background:#fff;border-radius:15px;padding:14px;display:flex;justify-content:space-between;font-weight:800}.demo{margin-top:18px;background:#fffbeb}.demo p{font-size:.83rem;color:#78716c}.demo-grid{display:flex;flex-wrap:wrap;gap:6px}.demo-grid button{border:1px solid #fde68a;background:#fff;border-radius:10px;padding:7px 9px}.logout{width:100%;margin-top:22px;border:0;background:#fee2e2;color:#991b1b;border-radius:13px;padding:12px;font-weight:800}</style>

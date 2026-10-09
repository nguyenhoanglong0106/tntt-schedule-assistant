<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import BranchBadge from '@/components/BranchBadge.vue'
import UserAvatar from '@/components/UserAvatar.vue'
import { useApp } from '@/composables/useApp'
import { useAuth } from '@/composables/useAuth'
import { resetDemo, setDemoProfile } from '@/services/dataService'
import type { Role } from '@/types'
import { ROLE_LABEL } from '@/utils/roles'
const {state,refresh,readOnly}=useApp();const {signOut,demoMode}=useAuth();const router=useRouter()
onMounted(refresh)
async function logout(){await signOut();if(demoMode){resetDemo();location.reload()}else router.replace('/login')}
async function switchDemo(bid:string|null,role:Role='BRANCH_ADMIN'){if(!state.profile)return;const name=state.data?.branches.find(b=>b.id===bid)?.name;setDemoProfile({...state.profile,role:bid?role:'SUPER_ADMIN',branchId:bid,fullName:!bid?'Ban Điều Hành':role==='BRANCH_SECRETARY'?`Thư ký ${name}`:`Admin ${name}`});await refresh()}
</script>
<template><div class="page" v-if="state.profile&&state.data"><div class="eyebrow">TÀI KHOẢN</div><h1>Cá nhân 👤</h1><section class="surface profile"><UserAvatar :role="state.profile.role" :branch="state.data.branches.find(b=>b.id===state.profile?.branchId)" :size="56"/><div><strong>{{state.profile.fullName}}</strong><div class="subtle">{{ROLE_LABEL[state.profile.role]}}</div><BranchBadge v-if="state.profile.branchId" :branch="state.data.branches.find(b=>b.id===state.profile?.branchId)"/></div></section>
<p v-if="readOnly" class="ro-note">👀 Tài khoản <b>chỉ xem</b>, dùng chung cho thành viên trong ngành: xem lịch công tác, đọc sách và nhận thông báo nhắc việc. Muốn thay đổi lịch, hãy nhờ trưởng ngành.</p>
<h2>Trợ giúp</h2><button class="menu guide" @click="router.push('/guide')"><span>💡 Gợi ý & hướng dẫn sử dụng</span><b>›</b></button>
<h2>{{readOnly?'Sinh hoạt':'Ban điều hành'}}</h2><div class="stack"><button v-if="!readOnly" class="menu" @click="router.push('/meetings')"><span>📁 Họp tháng &amp; tài liệu</span><b>›</b></button><button class="menu" @click="router.push('/breakfast')"><span>🍜 Ăn sáng Chủ nhật</span><b>›</b></button></div>
<h2>Đánh giá</h2><div class="stack"><button v-if="!readOnly" class="menu" @click="router.push('/attendance')"><span>📋 Điểm danh</span><b>›</b></button><button class="menu" @click="router.push('/kpi')"><span>🏆 Bảng siêng năng</span><b>›</b></button></div>
<h2>{{readOnly?'Ngành':'Quản lý'}}</h2><div class="stack"><button class="menu" @click="router.push('/people')"><span>👥 Thành viên</span><b>›</b></button><button class="menu" @click="router.push('/stats')"><span>📊 Thống kê phân công</span><b>›</b></button><button v-if="state.profile.role==='SUPER_ADMIN'" class="menu" @click="router.push('/branch-times')"><span>⏰ Giờ mặc định Ngành</span><b>›</b></button><button v-if="state.profile.role==='SUPER_ADMIN'" class="menu" @click="router.push('/reading-config')"><span>📖 Cấu hình vòng đọc sách</span><b>›</b></button><button v-if="state.profile.role==='SUPER_ADMIN'" class="menu" @click="router.push('/create-admin')"><span>➕ Tạo tài khoản ngành</span><b>›</b></button></div>
<section v-if="demoMode" class="surface demo"><strong>🧪 Chế độ Demo</strong><p>Chuyển vai để thử quyền “xem chung – sửa riêng”.</p><div class="demo-grid"><button @click="switchDemo(null)">Super Admin</button><button v-for="b in state.data.branches" :key="b.id" @click="switchDemo(b.id)">Admin {{b.name}}</button><button v-for="b in state.data.branches" :key="`s-${b.id}`" class="sec" @click="switchDemo(b.id,'BRANCH_SECRETARY')">Thư ký {{b.name}}</button></div></section>
<button class="logout" @click="logout">{{demoMode?'Reset dữ liệu demo':'Đăng xuất'}}</button></div></template>
<style scoped>.profile{display:flex;align-items:center;gap:13px}.ro-note{margin:10px 0 0;background:#f0fdf4;border:1px solid #bbf7d0;color:#166534;border-radius:13px;padding:9px 11px;font-size:.8rem;line-height:1.45}.menu{border:1px solid #e2e8f0;background:#fff;border-radius:15px;padding:14px;display:flex;justify-content:space-between;font-weight:800}.menu.guide{width:100%;background:#eff6ff;border-color:#bfdbfe;color:#1e3a8a}.demo{margin-top:18px;background:#fffbeb}.demo p{font-size:.83rem;color:#78716c}.demo-grid{display:flex;flex-wrap:wrap;gap:6px}.demo-grid button{border:1px solid #fde68a;background:#fff;border-radius:10px;padding:7px 9px}.demo-grid .sec{border-color:#bbf7d0}.logout{width:100%;margin-top:22px;border:0;background:#fee2e2;color:#991b1b;border-radius:13px;padding:12px;font-weight:800}</style>

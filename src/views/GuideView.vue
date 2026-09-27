<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useApp } from '@/composables/useApp'
import { datesOfWeek, todayISO } from '@/utils/date'

const router=useRouter();const {state,refresh}=useApp()
onMounted(refresh)

const pushOn=(()=>{try{return localStorage.getItem('tntt-push-on')==='1'&&typeof Notification!=='undefined'&&Notification.permission==='granted'}catch{return false}})()

type Tip={icon:string;text:string;action:string;to:string}
// Suggestions computed from the user's own data; only what they can act on.
const tips=computed(():Tip[]=>{
  const d=state.data,p=state.profile;if(!d||!p)return []
  const mine=(branchId:string)=>p.role==='SUPER_ADMIN'||branchId===p.branchId
  const out:Tip[]=[]
  if(!pushOn)out.push({icon:'🔔',text:'Bạn chưa bật thông báo trên thiết bị này — sẽ không nhận được nhắc việc.',action:'Bật ngay',to:'/reminders'})
  const week=datesOfWeek(todayISO())
  if(!d.schedules.some(s=>s.taskCode!=='READING'&&week.includes(s.date)&&mine(s.branchId)))out.push({icon:'📋',text:'Tuần này chưa có lịch công tác. Bạn có thể sao chép từ tuần trước.',action:'Mở Công tác',to:'/tasks'})
  if(p.role==='BRANCH_ADMIN'&&p.branchId){
    const month=todayISO().slice(0,7)
    const used=new Set(d.schedules.filter(s=>s.date.startsWith(month)).flatMap(s=>s.assignees.map(a=>a.memberId)))
    const idle=d.members.filter(m=>m.active&&m.branchId===p.branchId&&!used.has(m.id)).length
    if(idle)out.push({icon:'📊',text:`${idle} thành viên của ngành chưa được phân công tháng này.`,action:'Thống kê',to:'/stats'})
  }
  if(p.role==='SUPER_ADMIN'){
    const missing=d.taskTypes.filter(t=>t.code!=='READING').flatMap(t=>d.branches.filter(b=>!d.taskTypeBranchTimes.some(x=>x.taskTypeId===t.id&&x.branchId===b.id))).length
    if(missing)out.push({icon:'⏰',text:`Còn ${missing} cặp công việc – ngành chưa có giờ gợi ý mặc định.`,action:'Cài giờ',to:'/branch-times'})
  }
  return out
})

const guide=[
  {icon:'🚀',title:'Bắt đầu nhanh',steps:[
    'Vào tab <b>Nhắc việc</b> → bật <b>Thông báo điện thoại</b>.',
    'Vào tab <b>Công tác</b> → bấm <b>＋ Tạo lịch</b> để phân công.',
    'Đến giờ nhắc, trưởng ngành nhận thông báo trên điện thoại — không cần làm gì thêm.']},
  {icon:'🗓️',title:'Tạo lịch công tác',steps:[
    'Tab <b>Công tác</b> → <b>＋ Tạo lịch</b>.',
    'Chọn <b>công việc</b> (Vệ sinh, Bán kem, Trực văn phòng…).',
    'Chọn <b>ngày</b> và <b>giờ bắt đầu</b>. Giờ được điền sẵn theo gợi ý của Super Admin — ngành có thể đổi cho phù hợp.',
    'Chọn <b>người / lớp phụ trách</b>. Không chọn ai = cả ngành.',
    'Chọn các mốc <b>nhắc trước</b> (30 phút → 1 ngày), rồi bấm <b>Tạo lịch</b>.',
    'Muốn sửa hay xóa: bấm vào lịch trong tab Công tác.'],
   note:'Một số việc (như Bán kem, Trực văn phòng) cố định vào một ngày trong tuần — app tự chọn ngày theo tuần đang xem.'},
  {icon:'📋',title:'Sao chép lịch tuần trước',steps:[
    'Tab <b>Công tác</b> → chuyển tới tuần cần xếp lịch.',
    'Bấm <b>📋 Sao chép … lịch từ tuần trước</b>.',
    'Lịch trùng (cùng ngày, giờ, công việc) tự được bỏ qua. Sau đó chỉnh lại người phụ trách nếu cần.']},
  {icon:'🔔',title:'Nhắc việc & thông báo',steps:[
    'Thông báo gửi tới trưởng ngành của lịch và Super Admin, đúng theo các mốc <b>nhắc trước</b> đã chọn.',
    'Nếu mốc nhắc đã qua khi tạo lịch, form sẽ cảnh báo để bạn chọn mốc gần hơn.',
    'Mỗi thiết bị cần bật thông báo riêng (điện thoại, máy tính…).'],
   note:'<b>iPhone:</b> mở web bằng Safari → Chia sẻ → <b>Thêm vào Màn hình chính</b> → mở app từ biểu tượng đó → bật thông báo và bấm Cho phép. Cần iOS 16.4 trở lên.'},
  {icon:'📖',title:'Đọc sách',steps:[
    'Đọc sách xếp theo vòng xoay giữa các ngành vào Thứ 2, Thứ 3, Thứ 5 và Chủ Nhật.',
    'Tab <b>Lịch</b> để phân công người đọc; Trang chủ báo những ngày còn thiếu người.',
    'Super Admin chỉnh vòng xoay ở <b>Cá nhân → Cấu hình vòng đọc sách</b>.']},
  {icon:'✨',title:'Phân công nhanh bằng AI',steps:[
    'Bấm nút <b>✨ AI</b> ở giữa thanh dưới.',
    'Gõ câu tự nhiên, ví dụ: <i>“T2 Minh Thư, T3 Đức đọc sách”</i> hoặc <i>“Chủ nhật này ai bán kem?”</i>.',
    'AI hiện bản xem trước — chỉ lưu khi bạn bấm <b>xác nhận</b>.']},
  {icon:'📊',title:'Thống kê phân công',steps:[
    '<b>Cá nhân → Thống kê phân công</b>: xem mỗi người được phân công bao nhiêu lần trong tháng.',
    'Lọc theo ngành, theo công việc; xem ai chưa được phân công để chia việc đều hơn.']},
  {icon:'🔐',title:'Quyền trong app',steps:[
    '<b>Super Admin</b>: tạo/sửa lịch mọi ngành, cài giờ gợi ý, vòng đọc sách, tạo Admin ngành.',
    '<b>Admin ngành</b>: xem lịch của mọi ngành, nhưng chỉ tạo/sửa lịch của ngành mình.']},
]
</script>
<template><div class="page" v-if="state.data&&state.profile">
<div class="page-head"><div><div class="eyebrow">TRỢ GIÚP</div><h1>Gợi ý & Hướng dẫn</h1></div><button class="back" @click="router.back()">‹ Quay lại</button></div>
<h2 class="first">💡 Gợi ý cho bạn</h2>
<div v-if="tips.length" class="stack"><div v-for="t in tips" :key="t.text" class="tip"><span class="tip-icon">{{t.icon}}</span><p>{{t.text}}</p><button @click="router.push(t.to)">{{t.action}}</button></div></div>
<div v-else class="surface ok">✅ Mọi thứ đều ổn — không có gì cần xử lý.</div>
<h2>📘 Hướng dẫn sử dụng</h2>
<div class="stack"><details v-for="(g,i) in guide" :key="g.title" class="surface sec" :open="i===0"><summary><span>{{g.icon}} {{g.title}}</span><b>›</b></summary><ol><li v-for="s in g.steps" :key="s" v-html="s"></li></ol><p v-if="g.note" class="note" v-html="g.note"></p></details></div>
</div></template>
<style scoped>.back{border:1px solid #e2e8f0;background:#fff;border-radius:12px;padding:8px 12px;font-weight:700;color:#475569}.first{margin-top:4px}.tip{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:10px;background:#fff;border:1px solid #e7edf5;border-radius:15px;padding:11px 12px}.tip-icon{font-size:1.2rem}.tip p{margin:0;font-size:.85rem;color:#334155;line-height:1.4}.tip button{border:0;background:#eff6ff;color:#1d4ed8;border-radius:10px;padding:7px 10px;font-weight:800;font-size:.78rem;white-space:nowrap}.ok{color:#166534;font-weight:600;font-size:.9rem}.sec{padding:0}.sec summary{list-style:none;display:flex;justify-content:space-between;align-items:center;padding:14px 15px;font-weight:800;cursor:pointer}.sec summary::-webkit-details-marker{display:none}.sec summary b{color:#94a3b8;transition:transform .2s}.sec[open] summary b{transform:rotate(90deg)}.sec ol{margin:0;padding:0 16px 4px 34px;display:grid;gap:7px;font-size:.87rem;color:#334155;line-height:1.45}.note{margin:8px 15px 14px;background:#f8fafc;border-radius:11px;padding:9px 11px;font-size:.8rem;color:#475569;line-height:1.45}.sec ol:last-child{padding-bottom:14px}</style>

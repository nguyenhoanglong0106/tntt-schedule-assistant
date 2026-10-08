<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useApp } from '@/composables/useApp'
import { datesOfWeek, todayISO } from '@/utils/date'
import { pendingAttendance } from '@/utils/kpi'

const router=useRouter();const {state,refresh}=useApp()
onMounted(refresh)

const pushOn=(()=>{try{return localStorage.getItem('tntt-push-on')==='1'&&typeof Notification!=='undefined'&&Notification.permission==='granted'}catch{return false}})()

type Tip={icon:string;text:string;action:string;to:string}
// Suggestions computed from the user's own data; only what they can act on.
const tips=computed(():Tip[]=>{
  const d=state.data,p=state.profile;if(!d||!p)return []
  const mine=(branchId:string)=>p.role==='SUPER_ADMIN'||branchId===p.branchId
  const out:Tip[]=[]
  const toMark=pendingAttendance(d,p,todayISO()).length
  if(toMark)out.push({icon:'📋',text:`Có ${toMark} công việc đã diễn ra nhưng chưa điểm danh.`,action:'Điểm danh',to:'/reminders'})
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
    'Đến giờ nhắc, trưởng ngành nhận thông báo trên điện thoại — không cần làm gì thêm.',
    'Làm xong việc → vào <b>Nhắc việc</b> bấm <b>📋 Điểm danh</b> để ghi nhận ai có mặt.']},
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
  {icon:'🖼️',title:'Gửi lịch tuần thành ảnh (Zalo)',steps:[
    'Tab <b>Lịch</b> → chọn tuần → bấm <b>🖼️ Xuất ảnh</b> ở góc trên.',
    'Chọn <b>Cả Đoàn</b> hoặc <b>một ngành</b> — ảnh tự cập nhật.',
    'Bấm <b>📤 Gửi Zalo / Chia sẻ</b> → chọn Zalo → chọn nhóm. Trên máy tính: bấm <b>⬇️ Tải ảnh về</b> rồi gửi ảnh.'],
   note:'Ảnh có logo Đoàn, tuần đọc sách, giờ – công việc – ngành – người phụ trách của từng ngày. Lịch đã hủy không hiện trong ảnh.'},
  {icon:'🔔',title:'Nhắc việc & thông báo',steps:[
    'Thông báo gửi tới trưởng ngành của lịch và Super Admin, đúng theo các mốc <b>nhắc trước</b> đã chọn.',
    'Nếu mốc nhắc đã qua khi tạo lịch, form sẽ cảnh báo để bạn chọn mốc gần hơn.',
    'Mỗi thiết bị cần bật thông báo riêng (điện thoại, máy tính…).',
    '<b>21 giờ tối</b>, nếu việc trong ngày chưa được điểm danh, trưởng ngành nhận thông báo <i>“📋 Nhớ điểm danh nhé”</i>.'],
   note:'<b>iPhone:</b> mở web bằng Safari → Chia sẻ → <b>Thêm vào Màn hình chính</b> → mở app từ biểu tượng đó → bật thông báo và bấm Cho phép. Cần iOS 16.4 trở lên. Nếu biểu tượng app bị nền đen, hãy xóa app khỏi màn hình chính rồi thêm lại.'},
  {icon:'✅',title:'Điểm danh',steps:[
    'Sau giờ làm việc, công việc tự hiện trong khung <b>📋 Cần điểm danh</b> ở tab <b>Nhắc việc</b> và ở <b>Trang chủ</b>.',
    'Bấm <b>Điểm danh</b>: mọi người mặc định <b>✅ Có mặt</b>, chỉ cần đổi người <b>⏰ Trễ</b>, <b>🟡 Có phép</b> hoặc <b>❌ Vắng</b>.',
    'Có người đến làm thay? Chọn ở mục <b>🔄 Người làm thay</b> → <b>＋ Thêm</b>.',
    'Bấm <b>💾 Lưu điểm danh</b> — công việc chuyển sang “Hoàn thành”.',
    'Việc giao <b>cả lớp</b> hoặc <b>cả ngành</b>: điểm danh <b>từng người</b> (xếp theo lớp, có nút <b>Cả nhóm có mặt</b> và ô tìm tên).',
    'Điểm danh nhầm? Vào <b>Cá nhân → Điểm danh</b> → mục <b>Đã điểm danh</b> → bấm vào để sửa.',
    'Quên điểm danh buổi cũ? Mục <b>📅 Điểm danh bù buổi cũ</b> → chọn ngày → bấm vào buổi đó. Điểm tính vào đúng ngày của buổi.',
    'Mất sóng vẫn điểm danh được: app lưu tạm trên máy (nhãn <b>⏳ Chờ gửi</b>) và tự gửi khi có mạng lại.'],
   note:'Việc chưa tới giờ sẽ <b>chưa</b> hiện để điểm danh — ví dụ lịch bán kem Chủ nhật 06:00 chỉ điểm danh được từ 06:00 sáng Chủ nhật. Trưởng ngành điểm danh ngành mình; Ban Điều Hành điểm danh được mọi ngành.'},
  {icon:'🏆',title:'Bảng siêng năng',steps:[
    '<b>Cá nhân → 🏆 Bảng siêng năng</b>.',
    'Chọn thời gian: <b>Tháng này</b>, <b>Năm học</b> (01/09 → 31/08) hoặc <b>Năm nay</b>; chọn từng ngành hoặc cả Đoàn.',
    'Xem bục vinh danh 🥇🥈🥉, điểm, tỷ lệ chuyên cần và huy hiệu của từng người.',
    'Bấm vào tên để xem chi tiết từng buổi.'],
   note:'<b>Cách tính điểm:</b> ✅ Có mặt +10 · 🔄 Làm thay +12 · ⏰ Đi trễ +5 · 🟡 Vắng có phép 0 · ❌ Vắng không phép −5.<br><b>Chuyên cần</b> = số buổi có mặt hoặc đi trễ ÷ số buổi đã điểm danh. Việc giao cả lớp / cả ngành được tính điểm cho từng người khi đã điểm danh.'},
  {icon:'✨',title:'Phân công nhanh bằng AI',steps:[
    'Bấm nút <b>✨ AI</b> ở giữa thanh dưới.',
    'Gõ câu tự nhiên, ví dụ: <i>“T2 Minh Thư, T3 Đức đọc sách”</i> hoặc <i>“Chủ nhật này ai bán kem?”</i>.',
    'AI hiện bản xem trước — chỉ lưu khi bạn bấm <b>xác nhận</b>.',
    'Nếu AI báo <b>quá tải</b>, đợi vài giây rồi bấm <b>🔄 Thử lại</b> — không cần gõ lại câu hỏi.',
    'Bấm <b>＋ Trò chuyện mới</b> để bắt đầu lại từ đầu.']},
  {icon:'📊',title:'Thống kê & Excel cuối năm',steps:[
    '<b>Cá nhân → Thống kê phân công</b>: xem mỗi người được phân công bao nhiêu lần trong tháng.',
    'Lọc theo ngành, theo công việc; xem ai chưa được phân công để chia việc đều hơn.',
    'Chọn năm → bấm <b>📊 Xuất Excel cả năm</b> để tải file lưu trữ và đánh giá.'],
   note:'File Excel gồm 5 trang: <b>Xếp hạng siêng năng</b>, <b>Lịch công tác</b>, <b>Điểm danh</b>, <b>Theo người</b>, <b>Theo ngành</b>.'},
  {icon:'👥',title:'Thành viên & lớp',steps:[
    '<b>Cá nhân → Thành viên</b>: thêm thành viên (＋) và lớp.',
    'Bấm vào <b>tên thành viên</b> để sửa họ tên hoặc đổi lớp.',
    'Không xóa được người đang có lịch trong tuần — hãy xóa lịch của họ trước.']},
  {icon:'📁',title:'Họp tháng & tài liệu',steps:[
    '<b>Cá nhân → 📁 Họp tháng & tài liệu</b> (hoặc bấm thông báo / banner <b>Tài liệu mới</b> ở Trang chủ).',
    '<b>Ban Điều Hành</b>: bấm <b>＋ Tạo buổi họp</b> → mở buổi họp → <b>📷 Chụp ảnh</b> hoặc <b>📎 Thêm file</b> (Word, PDF, Excel, ảnh).',
    'Đăng xong bấm <b>🔔 Báo cho các trưởng ngành</b> để mọi người nhận thông báo.',
    'Trưởng ngành bấm vào ảnh để xem lớn, bấm vào file để mở; Ban Điều Hành thấy ai <b>đã xem</b> / <b>chưa xem</b>.']},
  {icon:'🔐',title:'Quyền trong app',steps:[
    '<b>Super Admin (Ban Điều Hành)</b>: tạo/sửa lịch và điểm danh mọi ngành, cài giờ gợi ý, vòng đọc sách, tạo Admin ngành.',
    '<b>Admin ngành</b>: xem lịch và bảng siêng năng của mọi ngành, nhưng chỉ tạo/sửa lịch và điểm danh ngành mình.']},
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

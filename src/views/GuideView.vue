<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useApp } from '@/composables/useApp'
import { datesOfWeek, todayISO } from '@/utils/date'
import { outboxIds } from '@/services/attendanceOutbox'
import { latestUnseenMeeting, recentMeetings } from '@/services/meetingService'
import { breakfastGlance } from '@/services/breakfastService'
import { deadlineDay, isOpen, upcomingBreakfast } from '@/utils/breakfast'
import { pendingAttendance, periodRange } from '@/utils/kpi'
import { isSecretary } from '@/utils/roles'
import type { Role } from '@/types'
import BranchBadge from '@/components/BranchBadge.vue'
import { secretaryInvite, secretaryLogins, type SecretaryLogin } from '@/services/accountService'

const router=useRouter();const {state,refresh,isSuper,readOnly}=useApp()
// Meeting and breakfast tips need the server; quietly skipped offline
const unseenMeeting=ref<{id:string;title:string}|null>(null);const latestMeetingDate=ref<string|null|undefined>(undefined)
const bfWeek=upcomingBreakfast(todayISO());const bf=ref<Awaited<ReturnType<typeof breakfastGlance>>|null>(null)
// Thư ký ngành logins for the leader to pass on (own branch; every branch for Ban điều hành); null until loaded
const logins=ref<SecretaryLogin[]|null>(null)
onMounted(()=>{
  refresh().then(()=>{if(state.profile&&!readOnly.value)secretaryLogins(state.data?.branches??[]).then(l=>logins.value=l).catch(()=>undefined)})
  latestUnseenMeeting().then(m=>unseenMeeting.value=m).catch(()=>undefined)
  recentMeetings(1).then(l=>latestMeetingDate.value=l[0]?.date??null).catch(()=>undefined)
  breakfastGlance(bfWeek).then(g=>bf.value=g).catch(()=>undefined)
})
const loginKey=(l:SecretaryLogin)=>`${l.branchId}:${l.username}`
const branchOf=(id:string)=>state.data?.branches.find(b=>b.id===id)
const shownPw=ref<string|null>(null);const copiedLogin=ref<string|null>(null)
async function copyInvite(l:SecretaryLogin){
  const t=secretaryInvite(l,branchOf(l.branchId)?.name??'',location.origin)
  try{await navigator.clipboard.writeText(t)}
  catch{const ta=document.createElement('textarea');ta.value=t;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove()}
  const k=loginKey(l);copiedLogin.value=k;setTimeout(()=>{if(copiedLogin.value===k)copiedLogin.value=null},2500)
}

const pushOn=(()=>{try{return localStorage.getItem('tntt-push-on')==='1'&&typeof Notification!=='undefined'&&Notification.permission==='granted'}catch{return false}})()

type Tip={icon:string;text:string;action:string;to:string}
// Suggestions computed from the user's own data; only what they can act on.
const tips=computed(():Tip[]=>{
  const d=state.data,p=state.profile;if(!d||!p)return []
  const mine=(branchId:string)=>p.role==='SUPER_ADMIN'||branchId===p.branchId
  const out:Tip[]=[]
  const toMark=pendingAttendance(d,p,todayISO()).length
  if(toMark)out.push({icon:'📋',text:`Có ${toMark} công việc đã diễn ra nhưng chưa điểm danh.`,action:'Điểm danh',to:'/reminders'})
  // Older than the 30-day list, but still in this school year: only reachable through "Điểm danh bù"
  const today=todayISO();const yearStart=periodRange('schoolYear',today).from
  const sinceStart=Math.round((Date.parse(today)-Date.parse(yearStart))/86400000)
  const older=sinceStart>30?pendingAttendance(d,p,today,sinceStart).length-toMark:0
  if(older>0)out.push({icon:'📅',text:`Còn ${older} buổi cũ (quá 30 ngày) chưa điểm danh trong năm học này.`,action:'Điểm danh bù',to:'/attendance'})
  if(outboxIds.value.length)out.push({icon:'⏳',text:`${outboxIds.value.length} buổi điểm danh lưu lúc mất mạng đang chờ gửi.`,action:'Xem',to:'/attendance'})
  if(unseenMeeting.value)out.push({icon:'📁',text:`Có tài liệu họp mới: ${unseenMeeting.value.title}.`,action:'Xem',to:'/meetings'})
  if(bf.value&&(bf.value.status?.status??'OPEN')==='OPEN'){
    const g=bf.value,dm=(x:string)=>`${x.slice(8,10)}/${x.slice(5,7)}`
    if(!g.menu){if(p.role==='SUPER_ADMIN')out.push({icon:'🍜',text:'Chưa có thực đơn ăn sáng Chủ nhật. Thêm món để các ngành chọn.',action:'Lập thực đơn',to:'/breakfast'})}
    else if(isOpen(bfWeek)){if(p.role==='BRANCH_ADMIN'&&p.branchId&&!g.votedBranchIds.includes(p.branchId))out.push({icon:'🍜',text:`Ngành chưa chọn món ăn sáng Chủ nhật ${dm(bfWeek)}. Hạn chót thứ 6 ${dm(deadlineDay(bfWeek))}, 23:59.`,action:'Chọn món',to:'/breakfast'})}
    else if(p.role==='SUPER_ADMIN')out.push({icon:'🍜',text:`Đã hết hạn chọn món ăn sáng Chủ nhật ${dm(bfWeek)}. Xem kết quả và chốt món để đặt.`,action:'Chốt món',to:'/breakfast'})
  }
  if(!pushOn)out.push({icon:'🔔',text:'Bạn chưa bật thông báo trên thiết bị này — sẽ không nhận được nhắc việc.',action:'Bật ngay',to:'/reminders'})
  const week=datesOfWeek(todayISO())
  if(!isSecretary(p)&&!d.schedules.some(s=>s.taskCode!=='READING'&&week.includes(s.date)&&mine(s.branchId)))out.push({icon:'📋',text:'Tuần này chưa có lịch công tác. Bạn có thể sao chép từ tuần trước.',action:'Mở Công tác',to:'/tasks'})
  if(p.role==='BRANCH_ADMIN'&&p.branchId){
    const month=todayISO().slice(0,7)
    const used=new Set(d.schedules.filter(s=>s.date.startsWith(month)).flatMap(s=>s.assignees.map(a=>a.memberId)))
    const idle=d.members.filter(m=>m.active&&m.branchId===p.branchId&&!used.has(m.id)).length
    if(idle)out.push({icon:'📊',text:`${idle} thành viên của ngành chưa được phân công tháng này.`,action:'Thống kê',to:'/stats'})
  }
  if(p.role==='SUPER_ADMIN'){
    const thisMonth=todayISO().slice(0,7),day=Number(todayISO().slice(8,10))
    // The 1st-of-month report is most useful in the first week, e.g. to bring to the monthly meeting
    if(day<=7){const last=new Date(Date.UTC(Number(thisMonth.slice(0,4)),Number(thisMonth.slice(5,7))-2,1));const ym=`${last.getUTCFullYear()}-${String(last.getUTCMonth()+1).padStart(2,'0')}`
      out.push({icon:'📊',text:`Báo cáo tháng ${last.getUTCMonth()+1}/${last.getUTCFullYear()} đã sẵn sàng để gửi Zalo hoặc đính kèm vào buổi họp.`,action:'Xem báo cáo',to:`/kpi?report=${ym}`})}
    if(latestMeetingDate.value!==undefined&&!latestMeetingDate.value?.startsWith(thisMonth))out.push({icon:'📁',text:'Tháng này chưa có buổi họp. Tạo buổi họp để đăng tài liệu và AI tóm tắt cho các trưởng ngành.',action:'Tạo buổi họp',to:'/meetings'})
    const missing=d.taskTypes.filter(t=>t.code!=='READING').flatMap(t=>d.branches.filter(b=>!d.taskTypeBranchTimes.some(x=>x.taskTypeId===t.id&&x.branchId===b.id))).length
    if(missing)out.push({icon:'⏰',text:`Còn ${missing} cặp công việc – ngành chưa có giờ gợi ý mặc định.`,action:'Cài giờ',to:'/branch-times'})
  }
  return out
})

type Section={icon:string;title:string;steps:string[];note?:string}
const IPHONE='<b>iPhone:</b> mở web bằng Safari → Chia sẻ → <b>Thêm vào MH chính</b> → mở app từ biểu tượng đó rồi mới bật thông báo (iOS 16.4 trở lên).<br>Mỗi máy chỉ nhận thông báo của <b>tài khoản bật thông báo gần nhất</b> trên máy đó; đăng xuất là máy thôi nhận.'
const AI_SECTION:Section={icon:'✨',title:'Hỏi AI',steps:[
  'Bấm <b>✨ AI</b> giữa thanh dưới, chọn một <b>gợi ý nhanh</b> hoặc gõ câu tự nhiên (<i>“Chủ nhật này ai bán kem?”</i>).',
  'AI trả lời lịch, siêng năng, ăn sáng và <b>soạn tin</b> để bấm 📋 Sao chép gửi Zalo.',
  'AI báo quá tải thì đợi vài giây rồi bấm <b>🔄 Thử lại</b>.']}
// Short, per-role guides; Ban điều hành can open the others to explain them, leaders the thư ký one
const GUIDES:Record<Role,{label:string;summary:string;sections:Section[]}>={
  SUPER_ADMIN:{label:'Ban điều hành',summary:'🔑 Toàn quyền: lịch và điểm danh mọi ngành, cài đặt, tài khoản, họp tháng, ăn sáng.',sections:[
    {icon:'🚀',title:'Bắt đầu',steps:[
      '<b>Nhắc việc</b> → bật <b>Thông báo điện thoại</b> trên từng máy.',
      'Cài sẵn <b>⏰ Giờ mặc định Ngành</b> và <b>📖 Vòng đọc sách</b> (trong Cá nhân).',
      'Tạo tài khoản ở <b>Cá nhân → ➕ Tạo tài khoản ngành</b>: <b>Admin ngành</b> cho trưởng ngành, <b>Thư ký ngành</b> để thành viên xem lịch.'],note:IPHONE},
    {icon:'🗓️',title:'Lịch & công tác',steps:[
      '<b>Công tác → ＋ Tạo lịch</b>: chọn ngành, công việc, ngày giờ, người phụ trách (không chọn = cả ngành), mốc nhắc.',
      'Bấm vào một lịch để <b>sửa / xóa</b>; <b>📋 Sao chép lịch tuần trước</b> cho nhanh.',
      '<b>Lịch → 🖼️ Xuất ảnh</b> để gửi lịch tuần vào Zalo.']},
    {icon:'✅',title:'Điểm danh & siêng năng',steps:[
      'Điểm danh được <b>mọi ngành</b> ở <b>Nhắc việc</b> hoặc <b>Cá nhân → Điểm danh</b> (có điểm danh bù buổi cũ).',
      '<b>🏆 Bảng siêng năng</b>: xếp hạng theo tháng / năm học; <b>📊 Báo cáo tháng</b> nhắc lúc 8:00 ngày 1.',
      '<b>Thống kê phân công → 📊 Xuất Excel cả năm</b> để lưu trữ.'],
     note:'<b>Điểm:</b> ✅ Có mặt +10 · 🔄 Làm thay +12 · ⏰ Trễ +5 · 🟡 Có phép 0 · ❌ Vắng −5.'},
    {icon:'📁',title:'Họp tháng',steps:[
      '<b>📁 Họp tháng → ＋ Tạo buổi họp</b> → <b>📷 Chụp ảnh</b> / <b>📎 Thêm file</b>.',
      '<b>✨ Tóm tắt bằng AI</b> rồi <b>🔔 Báo cho các trưởng ngành</b>; xem ai đã xem, ai chưa.']},
    {icon:'🍜',title:'Ăn sáng Chủ nhật',steps:[
      'Lập <b>🍽️ Thực đơn</b> (thêm, sửa, ẩn món); các ngành chọn tới <b>23:59 thứ 6</b>.',
      '<b>7:00 thứ 7</b> nhận kết quả → <b>✅ Chốt món & báo mọi người</b> rồi đặt đồ ăn.',
      'Ngành nhờ thì <b>chọn hộ</b>; lễ, trại thì bấm <b>😴 Tuần này nghỉ</b>.'],
     note:'Xếp hạng theo % ngành chọn, bằng nhau thì so điểm ưu tiên (① 3, ② 2, ③ 1), rồi món lâu chưa ăn.'},
    {icon:'⚙️',title:'Cài đặt',steps:[
      '<b>⏰ Giờ mặc định Ngành</b>: thêm / sửa / xóa công việc và giờ, ngày cố định của từng ngành.',
      '<b>📖 Vòng đọc sách</b>: tuần bắt đầu và ngành đọc đầu tiên.',
      'Mật khẩu thư ký ngành hiện ở trang này cho trưởng ngành ngành đó, nên <b>đừng dùng mật khẩu cá nhân</b>.']},
    AI_SECTION]},
  BRANCH_ADMIN:{label:'Trưởng ngành',summary:'🔑 Tạo / sửa lịch và điểm danh ngành mình, chọn món ăn sáng; xem lịch mọi ngành và tài liệu họp.',sections:[
    {icon:'🚀',title:'Bắt đầu',steps:[
      '<b>Nhắc việc</b> → bật <b>Thông báo điện thoại</b>.',
      'Gửi tài khoản thư ký cho thành viên: mục <b>👀 Tài khoản thư ký ngành</b> phía trên → <b>📋 Sao chép tin gửi thành viên</b> → dán vào nhóm Zalo ngành.'],note:IPHONE},
    {icon:'🗓️',title:'Lịch công tác & đọc sách',steps:[
      '<b>Công tác → ＋ Tạo lịch</b>: giờ điền sẵn, chọn người hoặc lớp (không chọn = cả ngành), chọn mốc nhắc.',
      'Bấm vào lịch để <b>sửa / xóa</b>; <b>📋 Sao chép lịch tuần trước</b> cho nhanh.',
      'Tuần ngành mình đọc sách: tab <b>Lịch</b> → bấm ô <b>📖 Đọc sách</b> để nhập người đọc.',
      '<b>Lịch → 🖼️ Xuất ảnh</b> để gửi lịch tuần vào Zalo.']},
    {icon:'✅',title:'Điểm danh',steps:[
      'Xong việc → <b>Nhắc việc → Điểm danh</b>: mặc định có mặt, chỉ đổi người trễ / vắng, thêm người làm thay → <b>Lưu</b>.',
      'Quên thì <b>21:00</b> app nhắc; sửa hoặc điểm danh bù ở <b>Cá nhân → Điểm danh</b>. Mất sóng vẫn lưu được.']},
    {icon:'🍜',title:'Ăn sáng Chủ nhật',steps:[
      'Chọn <b>2–3 món</b> theo thứ tự thích nhất và nhập <b>số người ăn</b> trước <b>23:59 thứ 6</b>.',
      'Chưa chọn thì được nhắc lúc 19:00 (T2–T5) và 8:00 thứ 6; Ban điều hành chốt món sẽ báo cho bạn.']},
    {icon:'📁',title:'Họp tháng & siêng năng',steps:[
      '<b>📁 Họp tháng</b>: xem tài liệu, ảnh biên bản và tóm tắt AI khi được báo.',
      '<b>🏆 Bảng siêng năng</b> và <b>📊 Thống kê phân công</b> để khen thưởng và chia việc đều.']},
    AI_SECTION]},
  BRANCH_SECRETARY:{label:'Thư ký',summary:'👀 Chỉ xem lịch và nhận thông báo của ngành; tài khoản dùng chung cho thành viên.',sections:[
    {icon:'🚀',title:'Bắt đầu',steps:[
      'Đăng nhập trên điện thoại của mình (nhiều máy cùng lúc được).',
      '<b>Nhắc việc</b> → bật <b>Thông báo điện thoại</b> để nhận nhắc lịch của ngành.'],note:IPHONE},
    {icon:'📅',title:'Xem lịch',steps:[
      'Tab <b>Lịch</b> (có đọc sách) và <b>Công tác</b>: mặc định ngành mình, bấm <b>Cả Đoàn</b> để xem các ngành khác.',
      '<b>Trang chủ</b>: lịch hôm nay; <b>Nhắc việc</b>: lịch sắp tới.',
      '<b>Cá nhân</b>: thành viên, bảng siêng năng, món ăn sáng Chủ nhật.']},
    {icon:'✨',title:'Hỏi AI',steps:[
      'Bấm <b>✨ AI</b> → chọn gợi ý như <i>“Hôm nay có gì?”</i>, <i>“Ai đọc sách?”</i> hoặc nhờ soạn tin gửi nhóm.']},
    {icon:'🙏',title:'Lưu ý',steps:[
      'Tài khoản <b>chỉ xem</b>: không sửa lịch, không điểm danh, không chọn món.',
      'Cần thay đổi gì thì nhờ <b>trưởng ngành</b>.']}]},
}
// Own role first; Ban điều hành can open every guide, a leader also the thư ký one (to explain it to members)
const roleTabs=computed<Role[]>(()=>state.profile?.role==='SUPER_ADMIN'?['SUPER_ADMIN','BRANCH_ADMIN','BRANCH_SECRETARY']:state.profile?.role==='BRANCH_ADMIN'?['BRANCH_ADMIN','BRANCH_SECRETARY']:['BRANCH_SECRETARY'])
const guideRole=ref<Role>('BRANCH_ADMIN')
watch(()=>state.profile?.role,r=>{if(r)guideRole.value=r},{immediate:true})
</script>
<template><div class="page" v-if="state.data&&state.profile">
<div class="page-head"><div><div class="eyebrow">TRỢ GIÚP</div><h1>Gợi ý & Hướng dẫn</h1></div><button class="back" @click="router.back()">‹ Quay lại</button></div>
<h2 class="first">💡 Gợi ý cho bạn</h2>
<div v-if="tips.length" class="stack"><div v-for="t in tips" :key="t.text" class="tip"><span class="tip-icon">{{t.icon}}</span><p>{{t.text}}</p><button @click="router.push(t.to)">{{t.action}}</button></div></div>
<div v-else class="surface ok">✅ Mọi thứ đều ổn — không có gì cần xử lý.</div>
<template v-if="logins">
<h2>👀 Tài khoản thư ký ngành</h2>
<details class="surface accts" :open="!isSuper"><summary><span>{{isSuper?`Tài khoản thư ký các ngành (${logins.length})`:'Gửi cho thành viên trong ngành'}}</span><b>›</b></summary>
  <p class="acct-intro">Thành viên đăng nhập tài khoản này để <b>xem lịch</b> công tác, đọc sách của ngành và <b>nhận thông báo nhắc việc</b>. Tài khoản chỉ xem, không sửa được gì.</p>
  <div v-for="l in logins" :key="loginKey(l)" class="acct">
    <BranchBadge small :branch="branchOf(l.branchId)"/>
    <div class="cred"><span>Tên đăng nhập</span><b>{{l.username}}</b></div>
    <div class="cred"><span>Mật khẩu</span><b>{{shownPw===loginKey(l)?l.password:'••••••••'}}</b><button class="eye" @click="shownPw=shownPw===loginKey(l)?null:loginKey(l)">{{shownPw===loginKey(l)?'Ẩn':'Hiện'}}</button></div>
    <button class="invite" :class="{done:copiedLogin===loginKey(l)}" @click="copyInvite(l)">{{copiedLogin===loginKey(l)?'✓ Đã sao chép, dán vào nhóm Zalo ngành':'📋 Sao chép tin gửi thành viên'}}</button>
  </div>
  <p v-if="!logins.length" class="acct-none">{{isSuper?'Chưa ngành nào có tài khoản thư ký. Tạo ở Cá nhân → ➕ Tạo tài khoản ngành → 👀 Thư ký ngành.':'Ngành chưa có tài khoản thư ký. Nhờ Ban Điều Hành tạo giúp.'}}</p>
</details>
</template>
<h2>📘 Hướng dẫn sử dụng</h2>
<div v-if="roleTabs.length>1" class="role-tabs" :style="{gridTemplateColumns:`repeat(${roleTabs.length},1fr)`}"><button v-for="r in roleTabs" :key="r" :class="{on:guideRole===r}" @click="guideRole=r">{{GUIDES[r].label}}</button></div>
<p class="role-sum">{{GUIDES[guideRole].summary}}</p>
<div class="stack"><details v-for="(g,i) in GUIDES[guideRole].sections" :key="guideRole+g.title" class="surface sec" :open="i===0"><summary><span>{{g.icon}} {{g.title}}</span><b>›</b></summary><ol><li v-for="s in g.steps" :key="s" v-html="s"></li></ol><p v-if="g.note" class="note" v-html="g.note"></p></details></div>
</div></template>
<style scoped>.back{border:1px solid #e2e8f0;background:#fff;border-radius:12px;padding:8px 12px;font-weight:700;color:#475569}.first{margin-top:4px}.tip{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:10px;background:#fff;border:1px solid #e7edf5;border-radius:15px;padding:11px 12px}.tip-icon{font-size:1.2rem}.tip p{margin:0;font-size:.85rem;color:#334155;line-height:1.4}.tip button{border:0;background:#eff6ff;color:#1d4ed8;border-radius:10px;padding:7px 10px;font-weight:800;font-size:.78rem;white-space:nowrap}.ok{color:#166534;font-weight:600;font-size:.9rem}.sec{padding:0}.sec summary{list-style:none;display:flex;justify-content:space-between;align-items:center;padding:14px 15px;font-weight:800;cursor:pointer}.sec summary::-webkit-details-marker{display:none}.sec summary b{color:#94a3b8;transition:transform .2s}.sec[open] summary b{transform:rotate(90deg)}.sec ol{margin:0;padding:0 16px 4px 34px;display:grid;gap:7px;font-size:.87rem;color:#334155;line-height:1.45}.note{margin:8px 15px 14px;background:#f8fafc;border-radius:11px;padding:9px 11px;font-size:.8rem;color:#475569;line-height:1.45}.sec ol:last-child{padding-bottom:14px}
.role-tabs{display:grid;gap:4px;background:#eef2f7;border-radius:12px;padding:3px;margin-bottom:8px}.role-tabs button{border:0;background:transparent;border-radius:10px;padding:8px 4px;font-weight:800;font-size:.8rem;color:#64748b}.role-tabs button.on{background:#fff;color:#0f172a;box-shadow:0 2px 8px rgba(15,23,42,.08)}.role-sum{margin:0 0 10px;font-size:.82rem;color:#334155;line-height:1.45;font-weight:600}
.accts{padding:0}.accts summary{list-style:none;display:flex;justify-content:space-between;align-items:center;padding:14px 15px;font-weight:800;cursor:pointer}.accts summary::-webkit-details-marker{display:none}.accts summary b{color:#94a3b8;transition:transform .2s}.accts[open] summary b{transform:rotate(90deg)}
.acct-intro{margin:0 15px 10px;font-size:.8rem;color:#475569;line-height:1.45}.acct-none{margin:0 15px 14px;font-size:.84rem;color:#64748b}
.acct{margin:0 15px 12px;border:1px solid #bbf7d0;background:#f0fdf4;border-radius:14px;padding:11px 12px;display:grid;gap:7px}
.cred{display:flex;align-items:center;gap:8px;font-size:.84rem;min-width:0}.cred span{flex:none;width:96px;color:#64748b;font-weight:700}.cred b{flex:1;min-width:0;overflow-wrap:anywhere;font-size:.95rem;color:#0f172a;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
.eye{flex:none;border:1px solid #bbf7d0;background:#fff;color:#166534;border-radius:9px;padding:5px 10px;font-weight:800;font-size:.76rem}
.invite{border:0;background:#16a34a;color:#fff;border-radius:11px;padding:10px;font-weight:800;font-size:.84rem}.invite.done{background:#15803d}</style>

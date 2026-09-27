<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import EmptyState from '@/components/EmptyState.vue'
import BranchBadge from '@/components/BranchBadge.vue'
import { useApp } from '@/composables/useApp'
import { markNotificationRead } from '@/services/dataService'
import { todayISO } from '@/utils/date'
import { registerPushSubscription, unregisterPushSubscription } from '@/utils/pushNotifications'
import { isSupabaseConfigured } from '@/lib/supabase'

type PushState='unavailable'|'unsupported'|'blocked'|'off'|'on'
const PUSH_FLAG='tntt-push-on'
const readFlag=()=>{try{return localStorage.getItem(PUSH_FLAG)==='1'}catch{return false}}
const writeFlag=(on:boolean)=>{try{on?localStorage.setItem(PUSH_FLAG,'1'):localStorage.removeItem(PUSH_FLAG)}catch{}}
const isIOS=/iPad|iPhone|iPod/.test(navigator.userAgent)
// Resolved synchronously so the card renders its real state immediately instead of flipping after network calls
function initialPushState():PushState{
  if(!isSupabaseConfigured||!import.meta.env.VITE_FIREBASE_API_KEY?.trim())return'unavailable'
  if(!('PushManager' in window)||typeof Notification==='undefined')return'unsupported'
  if(Notification.permission==='denied')return'blocked'
  return Notification.permission==='granted'&&readFlag()?'on':'off'
}
const pushState=ref<PushState>(initialPushState());const pushBusy=ref(false);const pushError=ref('')
const {state,refresh}=useApp()
onMounted(()=>{
  refresh()
  // keep the server copy of this device's token fresh; only surface a change if it actually fails
  if(pushState.value==='on')registerPushSubscription().then(ok=>{if(!ok){pushState.value=initialPushState()==='blocked'?'blocked':'off';writeFlag(false)}})
})
async function togglePush(){
  if(pushBusy.value)return
  pushBusy.value=true;pushError.value=''
  try{
    if(pushState.value==='on'){
      await unregisterPushSubscription()
      writeFlag(false);pushState.value='off'
    }else{
      const ok=await registerPushSubscription()
      if(ok){writeFlag(true);pushState.value='on'}
      else if(Notification.permission==='denied')pushState.value='blocked'
      else pushError.value='Chưa bật được thông báo. Vui lòng thử lại.'
    }
  }finally{pushBusy.value=false}
}
const pushStatus=computed(()=>pushBusy.value
  ?(pushState.value==='on'?'Đang tắt…':'Đang bật…')
  :pushState.value==='on'?'Đang bật · nhận nhắc việc kể cả khi đóng app'
  :'Đang tắt · bật để nhận nhắc việc trên điện thoại')
const upcoming=computed(()=>state.data?.schedules.filter(s=>s.date>=todayISO()&&s.status!=='COMPLETED'&&s.status!=='CANCELLED').sort((a,b)=>(a.date+(a.startTime||'')).localeCompare(b.date+(a.startTime||''))).slice(0,30)??[])
const unread=computed(()=>state.data?.notifications.filter(n=>!n.readAt)??[])
const label=(m:number)=>m===1440?'1 ngày':m===720?'12 giờ':m===180?'3 giờ':m===60?'1 giờ':`${m} phút`
async function read(id:string){await markNotificationRead(id);await refresh()}
</script>
<template><div class="page" v-if="state.data"><div class="eyebrow">NHẮC VIỆC</div><h1>Thông báo 🔔</h1>
<div class="push-card" :class="pushState" v-if="pushState!=='unavailable'">
  <template v-if="pushState==='on'||pushState==='off'">
    <label class="push-row">
      <div class="push-info"><strong>📲 Thông báo điện thoại</strong><small><span class="dot"></span>{{pushStatus}}</small></div>
      <button type="button" role="switch" class="switch" :aria-checked="pushState==='on'" :disabled="pushBusy" @click="togglePush"><span class="knob"></span></button>
    </label>
    <p v-if="pushError" class="push-error">{{pushError}}</p>
  </template>
  <div v-else-if="pushState==='blocked'" class="push-info"><strong>📲 Thông báo điện thoại · Đang bị chặn</strong><small>Trình duyệt đang chặn thông báo của trang này. Mở cài đặt trang (biểu tượng 🔒 cạnh địa chỉ) → Thông báo → Cho phép, rồi tải lại trang.</small></div>
  <div v-else-if="pushState==='unsupported'" class="push-info"><strong>📲 Thông báo điện thoại · Chưa hỗ trợ</strong><small>{{isIOS?'Trên iPhone/iPad: bấm Chia sẻ → “Thêm vào MH chính”, rồi mở app từ màn hình chính để bật thông báo.':'Trình duyệt này không hỗ trợ thông báo đẩy. Hãy dùng Chrome, Edge hoặc Firefox.'}}</small></div>
</div>
<div class="stack" v-if="unread.length"><button class="notice" v-for="n in unread" :key="n.id" @click="read(n.id)"><strong>{{n.title}}</strong><span>{{n.body}}</span><small>Nhấn để đọc</small></button></div><div v-else class="surface subtle">Không có thông báo mới.</div><h2>Lịch sắp tới</h2><div class="stack" v-if="upcoming.length"><article class="surface" v-for="s in upcoming" :key="s.id"><div class="row"><strong>{{s.taskIcon}} {{s.taskName}}</strong><BranchBadge :branch="state.data.branches.find(b=>b.id===s.branchId)"/></div><div class="subtle" style="margin-top:7px">{{s.date}} · {{s.startTime||'Chưa đặt giờ'}} · {{s.assignees.map(a=>a.label).join(', ')||'Chưa phân công'}}</div><div class="reminders" v-if="s.reminderOffsets.length"><span v-for="r in s.reminderOffsets" :key="r">⏰ {{label(r)}}</span></div></article></div><EmptyState v-else title="Chưa có lịch sắp tới"/></div></template>
<style scoped>.notice{border:1px solid #bfdbfe;background:#eff6ff;border-radius:15px;padding:12px;text-align:left;color:#1e3a8a}.notice strong,.notice span,.notice small{display:block}.notice span{margin-top:4px}.notice small{color:#64748b;margin-top:6px}.reminders{display:flex;gap:6px;flex-wrap:wrap;margin-top:9px}.reminders span{background:#f1f5f9;border-radius:999px;padding:6px 8px;font-size:.72rem;font-weight:700;color:#475569}.push-card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;padding:12px 14px;margin-bottom:12px;transition:background .2s,border-color .2s}.push-card.on{background:#ecfdf5;border-color:#a7f3d0}.push-card.blocked{background:#fff7ed;border-color:#fed7aa}.push-row{display:flex;align-items:center;justify-content:space-between;gap:12px;cursor:pointer}.push-info strong{display:block;font-size:.88rem}.push-info small{display:flex;align-items:flex-start;gap:6px;font-size:.76rem;color:#64748b;margin-top:4px;line-height:1.4}.dot{flex-shrink:0;width:8px;height:8px;margin-top:.3em;border-radius:50%;background:#94a3b8}.push-card.on .dot{background:#10b981}.push-card.on small{color:#047857;font-weight:600}.switch{flex-shrink:0;position:relative;width:52px;height:30px;border:0;border-radius:999px;background:#cbd5e1;padding:0;transition:background .2s}.switch[aria-checked="true"]{background:#10b981}.switch:disabled{opacity:.6}.switch:focus-visible{outline:3px solid #93c5fd;outline-offset:2px}.knob{position:absolute;top:3px;left:3px;width:24px;height:24px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.25);transition:transform .2s}.switch[aria-checked="true"] .knob{transform:translateX(22px)}.push-error{margin:8px 0 0;font-size:.76rem;color:#b91c1c}</style>

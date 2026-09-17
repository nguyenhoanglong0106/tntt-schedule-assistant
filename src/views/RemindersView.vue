<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import EmptyState from '@/components/EmptyState.vue'
import BranchBadge from '@/components/BranchBadge.vue'
import { useApp } from '@/composables/useApp'
import { markNotificationRead } from '@/services/dataService'
import { todayISO } from '@/utils/date'
import { isPushEnabled, registerPushSubscription, unregisterPushSubscription } from '@/utils/pushNotifications'
import { isSupabaseConfigured } from '@/lib/supabase'
const pushEnabled=ref(false);const pushBusy=ref(false);const pushSupported=ref(('PushManager' in window)&&isSupabaseConfigured);const pushError=ref('')
const {state,refresh}=useApp();onMounted(async()=>{await refresh();pushEnabled.value=await isPushEnabled()})
async function togglePush(){
  pushBusy.value=true;pushError.value=''
  if(!pushEnabled.value){
    const ok=await registerPushSubscription()
    pushEnabled.value=ok
    if(!ok){
      pushError.value='Không thể bật. Kiểm tra console (F12) để biết chi tiết lỗi.'
      alert(pushError.value)
    }
  } else {
    await unregisterPushSubscription()
    pushEnabled.value=false
  }
  pushBusy.value=false
}
const upcoming=computed(()=>state.data?.schedules.filter(s=>s.date>=todayISO()&&s.status!=='COMPLETED'&&s.status!=='CANCELLED').sort((a,b)=>(a.date+(a.startTime||'')).localeCompare(b.date+(a.startTime||''))).slice(0,30)??[])
const unread=computed(()=>state.data?.notifications.filter(n=>!n.readAt)??[])
const label=(m:number)=>m===1440?'1 ngày':m===720?'12 giờ':m===180?'3 giờ':m===60?'1 giờ':`${m} phút`
async function read(id:string){await markNotificationRead(id);await refresh()}
</script>
<template><div class="page" v-if="state.data"><div class="eyebrow">NHẮC VIỆC</div><h1>Thông báo 🔔</h1>
<div class="push-card" v-if="pushSupported">
  <div class="push-info"><strong>📲 Thông báo điện thoại</strong><small>{{pushEnabled?'Đang bật – bạn sẽ nhận thông báo dù app đang đóng':'Tắt – chỉ nhận thông báo khi mở app'}}</small></div>
  <button class="toggle-btn" :class="{on:pushEnabled}" :disabled="pushBusy" @click="togglePush">{{pushBusy?'...':pushEnabled?'Bật':'Tắt'}}</button>
</div>
<div class="stack" v-if="unread.length"><button class="notice" v-for="n in unread" :key="n.id" @click="read(n.id)"><strong>{{n.title}}</strong><span>{{n.body}}</span><small>Chạm để đánh dấu đã đọc</small></button></div><div v-else class="surface subtle">Không có thông báo mới.</div><h2>Lịch sắp tới</h2><div class="stack" v-if="upcoming.length"><article class="surface" v-for="s in upcoming" :key="s.id"><div class="row"><strong>{{s.taskIcon}} {{s.taskName}}</strong><BranchBadge :branch="state.data.branches.find(b=>b.id===s.branchId)"/></div><div class="subtle" style="margin-top:7px">{{s.date}} · {{s.startTime||'Chưa đặt giờ'}} · {{s.assignees.map(a=>a.label).join(', ')||'Chưa phân công'}}</div><div class="reminders" v-if="s.reminderOffsets.length"><span v-for="r in s.reminderOffsets" :key="r">⏰ {{label(r)}}</span></div></article></div><EmptyState v-else title="Chưa có lịch sắp tới"/></div></template>
<style scoped>.notice{border:1px solid #bfdbfe;background:#eff6ff;border-radius:15px;padding:12px;text-align:left;color:#1e3a8a}.notice strong,.notice span,.notice small{display:block}.notice span{margin-top:4px}.notice small{color:#64748b;margin-top:6px}.reminders{display:flex;gap:6px;flex-wrap:wrap;margin-top:9px}.reminders span{background:#f1f5f9;border-radius:999px;padding:6px 8px;font-size:.72rem;font-weight:700;color:#475569}.push-card{display:flex;align-items:center;justify-content:space-between;gap:10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;padding:12px 14px;margin-bottom:12px}.push-info strong{display:block;font-size:.88rem}.push-info small{display:block;font-size:.76rem;color:#64748b;margin-top:3px}.toggle-btn{flex-shrink:0;border:2px solid #cbd5e1;background:#f1f5f9;color:#475569;border-radius:999px;padding:8px 16px;font-weight:800;font-size:.82rem;transition:.2s}.toggle-btn.on{background:#2563eb;border-color:#2563eb;color:#fff}</style>

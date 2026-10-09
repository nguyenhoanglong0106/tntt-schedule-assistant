<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import BottomNav from '@/components/BottomNav.vue'
import SparkleLayer from '@/components/SparkleLayer.vue'
import { useApp } from '@/composables/useApp'
import { useUpdateChecker } from '@/composables/useUpdateChecker'
import { flushOutbox, outboxError, outboxIds } from '@/services/attendanceOutbox'
const route=useRoute();const{state,refresh}=useApp();const showNav=computed(()=>route.meta.hideNav!==true)
const{updateAvailable,updating,updateError,checkUpdate,applyUpdate}=useUpdateChecker()
const cancelUpdate=ref(false)
async function handleUpdate(){
  const ok=await applyUpdate()
  if(!ok)cancelUpdate.value=true
}
function retryUpdate(){cancelUpdate.value=false;applyUpdate()}
// Attendance marked without signal is sent as soon as the phone is back online
const online=ref(navigator.onLine);const sending=ref(false)
async function sync(){
  if(!outboxIds.value.length||!navigator.onLine||sending.value)return
  sending.value=true
  try{if(await flushOutbox())await refresh()}finally{sending.value=false}
}
function goOnline(){online.value=true;refresh();sync()}
function goOffline(){online.value=false}
function onVisible(){if(document.visibilityState==='visible')sync()}
let timer:ReturnType<typeof setInterval>|undefined
const savedAt=computed(()=>{if(!state.cachedAt)return'';const d=new Date(state.cachedAt);return`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')} ${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`})
onMounted(()=>{
  refresh();checkUpdate();sync()
  window.addEventListener('online',goOnline);window.addEventListener('offline',goOffline)
  document.addEventListener('visibilitychange',onVisible)
  // Weak signal can report "online" while requests still fail, so keep retrying while something waits
  timer=setInterval(sync,30_000)
  // Load the attendance screen now so it still opens later without signal
  import('@/views/AttendanceView.vue').catch(()=>undefined)
})
onBeforeUnmount(()=>{window.removeEventListener('online',goOnline);window.removeEventListener('offline',goOffline);document.removeEventListener('visibilitychange',onVisible);clearInterval(timer)})
</script>
<template><div class="app-shell"><SparkleLayer/>
<div v-if="outboxError" class="net-bar err"><span>⚠️ {{outboxError}}</span><button @click="outboxError=''">✕</button></div>
<div v-else-if="outboxIds.length" class="net-bar wait"><span>⏳ {{outboxIds.length}} buổi điểm danh đang chờ gửi{{online?'':' · sẽ tự gửi khi có mạng'}}</span><button v-if="online" :disabled="sending" @click="sync">{{sending?'Đang gửi…':'Gửi ngay'}}</button></div>
<div v-else-if="!online||state.offline" class="net-bar off"><span>📶 Đang mất mạng{{savedAt?` · dữ liệu lúc ${savedAt}`:''}}</span></div>
<main :class="{'with-nav':showNav,fill:route.meta.fill===true}"><RouterView/></main><BottomNav v-if="showNav"/>
<div v-if="updateAvailable&&!updating&&!cancelUpdate" class="update-banner" @click="handleUpdate">
  <span>✨ Có bản cập nhật mới</span>
  <button class="update-btn">Cập nhật</button>
</div>
<div v-if="updating" class="update-banner update-loading">
  <span>⏳ Đang cập nhật, vui lòng đợi...</span>
</div>
<div v-if="cancelUpdate" class="update-banner update-error">
  <span>❌ {{updateError}}</span>
  <button class="update-btn" @click.stop="retryUpdate">Thử lại</button>
  <button class="update-btn update-cancel" @click.stop="cancelUpdate=false">Hủy</button>
</div>
</div></template>
<style scoped>.app-shell main{flex:1}.net-bar{flex:none;display:flex;align-items:center;justify-content:space-between;gap:8px;margin:6px 10px 0;padding:7px 10px;border-radius:12px;font-size:.78rem;font-weight:800;line-height:1.3}.net-bar button{flex:none;border:0;border-radius:999px;padding:5px 11px;font-weight:800;font-size:.75rem;background:#fff}.net-bar button:disabled{opacity:.6}.net-bar.wait{background:#fff7ed;color:#9a3412;border:1px solid #fed7aa}.net-bar.wait button{background:#ea580c;color:#fff}.net-bar.off{background:#f1f5f9;color:#475569;border:1px solid #e2e8f0}.net-bar.err{background:#fef2f2;color:#b91c1c;border:1px solid #fecaca}.update-banner{position:fixed;bottom:calc(78px + env(safe-area-inset-bottom));max-width:calc(100vw - 24px);left:50%;transform:translateX(-50%);background:#1d4ed8;color:#fff;padding:12px 20px;border-radius:14px;display:flex;align-items:center;gap:12px;box-shadow:0 8px 24px rgba(29,78,216,.3);z-index:999;cursor:pointer;font-size:.85rem}.update-btn{background:#fff;color:#1d4ed8;border:0;border-radius:999px;padding:6px 14px;font-weight:800;font-size:.8rem;cursor:pointer}.update-loading{background:#64748b;cursor:default}.update-error{background:#dc2626;cursor:default}.update-cancel{background:rgba(255,255,255,.2);color:#fff}</style>
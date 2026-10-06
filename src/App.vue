<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import BottomNav from '@/components/BottomNav.vue'
import { useApp } from '@/composables/useApp'
import { useUpdateChecker } from '@/composables/useUpdateChecker'
const route=useRoute();const{refresh}=useApp();const showNav=computed(()=>route.meta.hideNav!==true)
const{updateAvailable,updating,updateError,checkUpdate,applyUpdate}=useUpdateChecker()
const cancelUpdate=ref(false)
async function handleUpdate(){
  const ok=await applyUpdate()
  if(!ok)cancelUpdate.value=true
}
function retryUpdate(){cancelUpdate.value=false;applyUpdate()}
onMounted(()=>{refresh();checkUpdate()})
</script>
<template><div class="app-shell"><main :class="{'with-nav':showNav,fill:route.meta.fill===true}"><RouterView/></main><BottomNav v-if="showNav"/>
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
<style scoped>.app-shell main{flex:1}.update-banner{position:fixed;bottom:calc(78px + env(safe-area-inset-bottom));max-width:calc(100vw - 24px);left:50%;transform:translateX(-50%);background:#1d4ed8;color:#fff;padding:12px 20px;border-radius:14px;display:flex;align-items:center;gap:12px;box-shadow:0 8px 24px rgba(29,78,216,.3);z-index:999;cursor:pointer;font-size:.85rem}.update-btn{background:#fff;color:#1d4ed8;border:0;border-radius:999px;padding:6px 14px;font-weight:800;font-size:.8rem;cursor:pointer}.update-loading{background:#64748b;cursor:default}.update-error{background:#dc2626;cursor:default}.update-cancel{background:rgba(255,255,255,.2);color:#fff}</style>
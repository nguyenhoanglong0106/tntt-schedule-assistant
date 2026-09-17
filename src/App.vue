<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import BottomNav from '@/components/BottomNav.vue'
import { useApp } from '@/composables/useApp'
import { useUpdateChecker } from '@/composables/useUpdateChecker'
const route=useRoute();const{refresh}=useApp();const showNav=computed(()=>route.meta.hideNav!==true)
const{updateAvailable,applyUpdate}=useUpdateChecker()
onMounted(refresh)
</script>
<template><div class="app-shell"><main :class="{'with-nav':showNav}"><RouterView/></main><BottomNav v-if="showNav"/>
<div v-if="updateAvailable" class="update-banner" @click="applyUpdate">
  <span>✨ Có bản cập nhật mới</span>
  <button class="update-btn">Cập nhật</button>
</div></div></template>
<style scoped>.app-shell{min-height:100vh;display:flex;flex-direction:column}.app-shell main{flex:1}.update-banner{position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#1d4ed8;color:#fff;padding:12px 20px;border-radius:14px;display:flex;align-items:center;gap:12px;box-shadow:0 8px 24px rgba(29,78,216,.3);z-index:999;cursor:pointer;font-size:.85rem}.update-btn{background:#fff;color:#1d4ed8;border:0;border-radius:999px;padding:6px 14px;font-weight:800;font-size:.8rem;cursor:pointer}</style>
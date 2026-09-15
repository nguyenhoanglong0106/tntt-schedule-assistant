<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getActivityLogs } from '@/services/dataService'
const router=useRouter();const logs=ref<any[]>([]);const loading=ref(true)
onMounted(async()=>{try{logs.value=await getActivityLogs()}finally{loading.value=false}})
</script>
<template><div class="page"><div class="page-head"><button class="icon-btn" @click="router.back()">‹</button><div style="flex:1"><div class="eyebrow">SUPER ADMIN</div><h1>Activity Log</h1></div></div><div v-if="loading" class="surface">Đang tải…</div><div v-else-if="!logs.length" class="surface subtle">Demo mode chưa có log server. Khi dùng Supabase, thay đổi lịch sẽ xuất hiện tại đây.</div><div v-else class="stack"><article class="surface" v-for="l in logs" :key="l.id"><div class="row"><strong>{{l.action}} · {{l.entity_type}}</strong><span class="pill">{{l.source}}</span></div><div class="subtle">{{new Date(l.created_at).toLocaleString('vi-VN')}}</div><details><summary>Xem dữ liệu</summary><pre>{{JSON.stringify({before:l.before_data,after:l.after_data},null,2)}}</pre></details></article></div></div></template>
<style scoped>details{margin-top:8px}summary{cursor:pointer;color:#475569;font-size:.82rem}pre{overflow:auto;background:#f8fafc;padding:10px;border-radius:10px;font-size:.72rem}</style>

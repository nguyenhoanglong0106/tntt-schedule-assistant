<script setup lang="ts">
import type { Branch, Schedule } from '@/types'
import BranchBadge from './BranchBadge.vue'
defineProps<{schedule:Schedule;branch?:Branch}>()
</script>
<template><article class="schedule-card" :style="{'--branch':branch?.colorHex||'#64748b'}"><div class="accent"></div><div class="card-main"><div class="card-top"><strong>{{schedule.taskIcon}} {{schedule.taskName}}</strong><BranchBadge :branch="branch"/></div><div class="meta"><span v-if="schedule.startTime">🕒 {{schedule.startTime}}</span><span>👤 {{schedule.assignees.map(a=>a.label).join(', ')||'Cả ngành'}}</span></div></div></article></template>
<style scoped>.schedule-card{display:flex;background:white;border:1px solid #e8edf4;border-radius:18px;overflow:hidden;box-shadow:0 5px 18px rgba(15,23,42,.05)}.accent{width:5px;background:var(--branch)}.card-main{padding:13px 14px;flex:1}.card-top{display:flex;gap:8px;align-items:center;justify-content:space-between}.meta{display:flex;flex-wrap:wrap;gap:8px 16px;color:#64748b;font-size:.87rem;margin-top:9px}</style>

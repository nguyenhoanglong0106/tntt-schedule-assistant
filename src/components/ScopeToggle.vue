<script setup lang="ts">
import type { Branch } from '@/types'
// Own branch / whole Đoàn switch for the thư ký ngành account
defineProps<{branch?:Branch}>()
const all=defineModel<boolean>({required:true})
</script>
<template><div v-if="branch" class="scope" :style="{'--c':branch.colorHex}"><button :class="{on:!all}" @click="all=false"><i></i>Ngành {{branch.name}}</button><button :class="{on:all}" @click="all=true">Cả Đoàn</button></div></template>
<style scoped>.scope{display:grid;grid-template-columns:1fr 1fr;gap:4px;background:#eef2f7;border-radius:12px;padding:3px;margin-bottom:10px}.scope button{display:flex;align-items:center;justify-content:center;gap:6px;border:0;background:transparent;border-radius:10px;padding:8px;font-weight:800;font-size:.84rem;color:#64748b}.scope button.on{background:#fff;color:#0f172a;box-shadow:0 2px 8px rgba(15,23,42,.08)}.scope i{width:8px;height:8px;border-radius:50%;background:var(--c)}</style>

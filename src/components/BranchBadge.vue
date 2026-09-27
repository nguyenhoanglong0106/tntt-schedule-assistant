<script setup lang="ts">
import type { Branch } from '@/types'
defineProps<{branch?:Branch; muted?:boolean; small?:boolean}>()
</script>
<template><span v-if="branch" class="branch-badge" :class="{muted,small}" :style="{'--branch':branch.colorHex}"><span class="dot"></span>{{branch.name}}</span></template>
<style scoped>.branch-badge{display:inline-flex;align-items:center;gap:.42rem;padding:.34rem .62rem;border-radius:999px;background:color-mix(in srgb,var(--branch) 14%,white);font-size:.78rem;font-weight:800;color:#334155;white-space:nowrap;flex-shrink:0}.dot{width:.62rem;height:.62rem;border-radius:50%;background:var(--branch)}.muted{opacity:.6}.small{gap:.3rem;padding:.16rem .45rem;font-size:.66rem;font-weight:700}.small .dot{width:.42rem;height:.42rem}</style>

<script setup lang="ts">
import { computed } from 'vue'
import type { Branch, Role } from '@/types'
import { branchInitials, ROLE_LABEL, textOn } from '@/utils/roles'
// Account avatar by level, nothing to upload, drawn like a badge (white inner ring, coloured outer ring):
// Ban điều hành = the Đoàn logo in gold; Trưởng ngành = branch colour with its initials and a gold cross on red, as on the
// logo's sail; Thư ký = white tinted with the branch colour and an eye (view only). Icons are SVG so they stay sharp.
const props=withDefaults(defineProps<{role:Role;branch?:Branch|null;size?:number}>(),{size:44})
const color=computed(()=>props.branch?.colorHex??'#64748b')
const kind=computed(()=>props.role==='SUPER_ADMIN'?'super':props.role==='BRANCH_SECRETARY'?'sec':'leader')
const title=computed(()=>`${ROLE_LABEL[props.role]}${props.branch?` · ${props.branch.name}`:''}`)
// Small avatars (lists) already have the role written next to them
const showBadge=computed(()=>kind.value!=='super'&&props.size>=32)
</script>
<template><span class="ua" :class="kind" :style="{'--c':color,'--t':textOn(color),'--s':`${size}px`}" :title="title" role="img" :aria-label="title">
  <img v-if="kind==='super'" src="/icon-192.png" alt="">
  <b v-else>{{branchInitials(branch?.name)}}</b>
  <i v-if="showBadge" class="badge" aria-hidden="true">
    <svg v-if="kind==='leader'" viewBox="0 0 24 24"><path d="M8.5 2.5h7l-2 8 8-2v7l-8-2 2 8h-7l2-8-8 2v-7l8 2z"/></svg>
    <svg v-else viewBox="0 0 24 24"><path d="M12 5.5c-5 0-8.6 3.9-9.8 6.5 1.2 2.6 4.8 6.5 9.8 6.5s8.6-3.9 9.8-6.5C20.6 9.4 17 5.5 12 5.5zm0 10.3a3.8 3.8 0 110-7.6 3.8 3.8 0 010 7.6z"/><circle cx="12" cy="12" r="1.7"/></svg>
  </i>
</span></template>
<style scoped>
.ua{position:relative;flex:none;display:inline-grid;place-items:center;width:var(--s);height:var(--s);border-radius:50%;font-size:calc(var(--s)*.36);line-height:1;
  box-shadow:0 0 0 2px #fff,0 0 0 3.5px var(--ring,var(--c)),0 4px 10px rgba(15,23,42,.16)}
.ua b{font-weight:800;letter-spacing:.02em}
.ua.super{--ring:#eab308;background:#fff}
.ua.super img{width:100%;height:100%;border-radius:50%;object-fit:cover}
.ua.leader{background:linear-gradient(145deg,color-mix(in srgb,var(--c) 72%,white),color-mix(in srgb,var(--c) 88%,black));color:var(--t)}
.ua.leader b{text-shadow:0 1px 2px rgba(0,0,0,.18)}
.ua.sec{--ring:color-mix(in srgb,var(--c) 65%,white);background:linear-gradient(145deg,#fff,color-mix(in srgb,var(--c) 18%,white));color:color-mix(in srgb,var(--c) 70%,black)}
.badge{position:absolute;right:-4px;bottom:-4px;width:calc(var(--s)*.42);height:calc(var(--s)*.42);border-radius:50%;display:grid;place-items:center;box-shadow:0 0 0 2px #fff,0 2px 4px rgba(15,23,42,.25)}
.badge svg{width:64%;height:64%}
.leader .badge{background:#dc2626}.leader .badge svg{fill:#facc15}
.sec .badge{background:color-mix(in srgb,var(--c) 85%,black)}.sec .badge svg{fill:#fff}
</style>

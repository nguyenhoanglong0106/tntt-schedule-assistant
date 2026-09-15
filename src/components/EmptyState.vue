<script setup lang="ts">defineProps<{icon?:string;title:string;text?:string}>()</script>
<template><div class="empty"><div class="icon">{{icon||'🌱'}}</div><strong>{{title}}</strong><p v-if="text">{{text}}</p></div></template>
<style scoped>.empty{text-align:center;padding:30px 18px;color:#64748b}.icon{font-size:2rem;margin-bottom:8px}.empty strong{display:block;color:#334155}.empty p{margin:5px 0 0;font-size:.86rem}</style>

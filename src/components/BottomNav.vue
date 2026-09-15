<script setup lang="ts">
import { useRoute } from 'vue-router'
const route=useRoute()
const items=[['/','🏠','Trang chủ'],['/calendar','📅','Lịch'],['/tasks','🧰','Công tác'],['/ai','✨','AI'],['/reminders','🔔','Nhắc việc'],['/profile','👤','Cá nhân']]
</script>
<template><nav class="bottom-nav"><RouterLink v-for="i in items" :key="i[0]" :to="i[0]" :class="{active:route.path===i[0],ai:i[0]==='/ai'}"><span>{{i[1]}}</span><small>{{i[2]}}</small></RouterLink></nav></template>

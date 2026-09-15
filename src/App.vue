<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import BottomNav from '@/components/BottomNav.vue'
import { useApp } from '@/composables/useApp'
const route=useRoute();const {refresh}=useApp();const showNav=computed(()=>route.meta.hideNav!==true)
onMounted(refresh)
</script>
<template><div class="app-shell"><main :class="{'with-nav':showNav}"><RouterView/></main><BottomNav v-if="showNav"/></div></template>

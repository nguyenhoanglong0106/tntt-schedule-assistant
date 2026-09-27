<script setup lang="ts">
// 24h time picker: <input type="time"> follows the device locale and may show AM/PM.
import { computed } from 'vue'
const model=defineModel<string|null>({default:''})
const pad=(n:number)=>String(n).padStart(2,'0')
const hours=Array.from({length:24},(_,i)=>pad(i))
const hour=computed({get:()=>model.value?.slice(0,2)??'',set:h=>{model.value=`${h}:${minute.value||'00'}`}})
const minute=computed({get:()=>model.value?.slice(3,5)??'',set:m=>{model.value=`${hour.value||'00'}:${m}`}})
// 5-minute steps, keeping an existing off-step value selectable
const minutes=computed(()=>{const list=Array.from({length:12},(_,i)=>pad(i*5));if(minute.value&&!list.includes(minute.value))list.push(minute.value);return list.sort()})
</script>
<template><div class="t24"><select v-model="hour" aria-label="Giờ"><option value="" disabled>--</option><option v-for="h in hours" :key="h" :value="h">{{h}}</option></select><b>:</b><select v-model="minute" aria-label="Phút"><option value="" disabled>--</option><option v-for="m in minutes" :key="m" :value="m">{{m}}</option></select></div></template>
<style scoped>.t24{display:flex;align-items:center;gap:4px}.t24 select{flex:1;min-width:0;box-sizing:border-box;border:1px solid #dbe3ee;border-radius:11px;padding:9px 6px;font:inherit;background:#fff;text-align:center}.t24 b{color:#64748b}</style>

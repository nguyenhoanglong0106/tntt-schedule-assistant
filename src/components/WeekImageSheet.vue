<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { AppData, Profile } from '@/types'
import { renderWeekImage } from '@/utils/weekImage'
const props=defineProps<{data:AppData;profile:Profile;weekStart:string}>()
const emit=defineEmits<{close:[]}>()
// Branch heads usually share their own branch; Ban Điều Hành the whole Đoàn
const branchId=ref<string|null>(props.profile.role==='BRANCH_ADMIN'?props.profile.branchId:null)
const url=ref('');const file=ref<File|null>(null);const busy=ref(false);const error=ref('');const done=ref('')
const fileName=computed(()=>`lich-tuan-${props.weekStart}.png`)
// Share needs the file ready beforehand: iOS drops the tap's permission if we render after the tap
const canShare=computed(()=>!!file.value&&typeof navigator.canShare==='function'&&navigator.canShare({files:[file.value]}))
async function build(){
  busy.value=true;error.value='';done.value=''
  try{
    const blob=await renderWeekImage({data:props.data,weekStart:props.weekStart,branchId:branchId.value})
    if(url.value)URL.revokeObjectURL(url.value)
    url.value=URL.createObjectURL(blob);file.value=new File([blob],fileName.value,{type:'image/png'})
  }catch(e:any){error.value=e?.message??'Không tạo được ảnh'}
  finally{busy.value=false}
}
watch(branchId,build,{immediate:true})
onBeforeUnmount(()=>{if(url.value)URL.revokeObjectURL(url.value)})
async function share(){
  if(!file.value)return
  try{await navigator.share({files:[file.value],title:'Lịch công tác tuần'})}
  catch(e:any){if(e?.name!=='AbortError')download()}
}
function download(){
  const a=document.createElement('a');a.href=url.value;a.download=fileName.value;document.body.appendChild(a);a.click();a.remove()
  done.value='Đã tải ảnh về máy. Mở Zalo và gửi ảnh từ thư viện.'
}
</script>
<template><Teleport to="body"><div class="overlay sheet-overlay" @click.self="emit('close')"><section class="sheet">
<div class="head"><strong>🖼️ Ảnh lịch tuần</strong><button class="x" @click="emit('close')">✕</button></div>
<div class="filters"><button :class="{on:!branchId}" @click="branchId=null">Cả Đoàn</button><button v-for="b in data.branches" :key="b.id" :class="{on:branchId===b.id}" :style="{'--c':b.colorHex}" @click="branchId=b.id">{{b.name}}</button></div>
<div class="preview"><div v-if="busy&&!url" class="loading">Đang tạo ảnh…</div><p v-else-if="error" class="err">{{error}}</p><img v-else :src="url" :class="{dim:busy}" alt="Ảnh lịch tuần"></div>
<p v-if="done" class="done">{{done}}</p>
<div class="actions"><button v-if="canShare" class="primary-btn" :disabled="busy" @click="share">📤 Gửi Zalo / Chia sẻ</button><button :class="canShare?'secondary-btn':'primary-btn'" :disabled="busy||!url" @click="download">⬇️ Tải ảnh về</button></div>
</section></div></Teleport></template>
<style scoped>
.sheet{width:100%;max-width:560px;max-height:100%;background:#fff;border-radius:22px 22px 0 0;padding:14px 14px calc(14px + env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:10px}
.head{display:flex;justify-content:space-between;align-items:center}.x{border:0;background:#f1f5f9;width:34px;height:34px;border-radius:50%}
.filters{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;flex:none}.filters::-webkit-scrollbar{display:none}
.filters button{white-space:nowrap;border:1px solid #e2e8f0;background:#fff;border-radius:999px;padding:6px 11px;font-size:.78rem;font-weight:700;color:#475569}
.filters button.on{background:var(--c,#1d4ed8);border-color:var(--c,#1d4ed8);color:#fff}
.preview{flex:1;min-height:0;overflow:auto;background:#f1f5f9;border-radius:14px;display:flex;justify-content:center}
.preview img{width:100%;height:auto;display:block;align-self:flex-start;transition:opacity .2s}.preview img.dim{opacity:.5}
.loading,.err{padding:40px 10px;color:#64748b;font-weight:700}.err{color:#b91c1c}
.done{margin:0;font-size:.8rem;color:#047857;text-align:center}
.actions{display:grid;gap:8px;flex:none}.actions button:disabled{opacity:.6}
</style>

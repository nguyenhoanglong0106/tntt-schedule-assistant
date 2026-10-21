<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { installLink } from '@/composables/useInstallApp'
import { qrModules, qrPath, renderInstallQrImage } from '@/utils/installQr'
const emit=defineEmits<{close:[]}>()
const FILE_NAME='ma-qr-cai-app-tntt.png'
const link=installLink();const modules=qrModules(link);const size=modules.length+8;const path=qrPath(modules)
const url=ref('');const file=ref<File|null>(null);const busy=ref(true);const error=ref('');const done=ref('')
// Share needs the file ready beforehand: iOS drops the tap's permission if we render after the tap
const canShare=computed(()=>!!file.value&&typeof navigator.canShare==='function'&&navigator.canShare({files:[file.value]}))
onMounted(async()=>{
  try{const blob=await renderInstallQrImage(link);url.value=URL.createObjectURL(blob);file.value=new File([blob],FILE_NAME,{type:'image/png'})}
  catch(e:any){error.value=e?.message??'Không tạo được ảnh'}
  finally{busy.value=false}
})
onBeforeUnmount(()=>{if(url.value)URL.revokeObjectURL(url.value)})
async function share(){
  if(!file.value)return
  try{await navigator.share({files:[file.value],title:'Mã QR cài app TNTT Lịch'})}
  catch(e:any){if(e?.name!=='AbortError')download()}
}
function download(){
  const a=document.createElement('a');a.href=url.value;a.download=FILE_NAME;document.body.appendChild(a);a.click();a.remove()
  done.value='Đã tải ảnh về máy. Gửi vào nhóm Zalo hoặc in ra để thành viên quét.'
}
</script>
<template><Teleport to="body"><div class="overlay sheet-overlay" @click.self="emit('close')"><section class="sheet">
<div class="head"><strong>🔳 Mã QR tải app</strong><button class="x" @click="emit('close')">✕</button></div>
<p class="lead">Đưa thành viên quét bằng <b>Camera</b> điện thoại: link mở ra trang cài app kèm hướng dẫn từng bước.</p>
<div class="qr"><svg :viewBox="`-4 -4 ${size} ${size}`" shape-rendering="crispEdges" role="img" aria-label="Mã QR cài app TNTT Lịch"><rect x="-4" y="-4" :width="size" :height="size" fill="#fff"/><path :d="path" fill="#0f172a"/></svg></div>
<p class="link">{{link.replace(/^https?:\/\//,'')}}</p>
<p v-if="error" class="err">{{error}}</p><p v-else-if="done" class="done">{{done}}</p>
<div class="actions"><button v-if="canShare" class="primary-btn" @click="share">📤 Gửi ảnh QR qua Zalo</button><button :class="canShare?'secondary-btn':'primary-btn'" :disabled="busy||!url" @click="download">⬇️ Tải ảnh QR về máy</button></div>
</section></div></Teleport></template>
<style scoped>
.sheet{width:100%;max-width:560px;max-height:100%;overflow-y:auto;background:#fff;border-radius:22px 22px 0 0;padding:14px 14px calc(14px + env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:10px}.sheet>*{flex:none}
.head{display:flex;justify-content:space-between;align-items:center}.x{border:0;background:#f1f5f9;width:34px;height:34px;border-radius:50%}
.lead{margin:0;font-size:.84rem;color:#64748b;line-height:1.45}
.qr{align-self:center;width:min(300px,100%,52vh);aspect-ratio:1;border:1px solid #e2e8f0;border-radius:20px;padding:8px;background:#fff;box-shadow:0 8px 24px rgba(15,23,42,.08)}.qr svg{display:block;width:100%;height:100%}
.link{margin:0;text-align:center;font-size:.8rem;font-weight:700;color:#1d4ed8;overflow-wrap:anywhere}
.done{margin:0;font-size:.8rem;color:#047857;text-align:center}.err{margin:0;font-size:.8rem;color:#b91c1c;text-align:center}
.actions{display:grid;gap:8px}.actions button:disabled{opacity:.6}
</style>

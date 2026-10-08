<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { recentMeetings, uploadMeetingFile } from '@/services/meetingService'
import type { AppData, Profile } from '@/types'
import { todayISO } from '@/utils/date'
import { computeMonthReport, renderMonthReport } from '@/utils/monthReport'
const props=defineProps<{data:AppData;profile:Profile;month?:string}>()
const emit=defineEmits<{close:[]}>()
const today=todayISO()
// The report is about a finished month, so start on last month unless one was asked for (from the 1st-of-month notice)
const shift=(m:string,d:number)=>{const t=new Date(Date.UTC(Number(m.slice(0,4)),Number(m.slice(5,7))-1+d,1));return`${t.getUTCFullYear()}-${String(t.getUTCMonth()+1).padStart(2,'0')}`}
const month=ref(props.month&&/^\d{4}-\d{2}$/.test(props.month)?props.month:shift(today.slice(0,7),-1))
const report=computed(()=>computeMonthReport(props.data,month.value,today))
const url=ref('');const file=ref<File|null>(null);const busy=ref(false);const error=ref('');const done=ref('')
const fileName=computed(()=>`bao-cao-thang-${month.value}.png`)
const canShare=computed(()=>!!file.value&&typeof navigator.canShare==='function'&&navigator.canShare({files:[file.value]}))
async function build(){
  busy.value=true;error.value='';done.value=''
  try{
    const blob=await renderMonthReport(report.value)
    if(url.value)URL.revokeObjectURL(url.value)
    url.value=URL.createObjectURL(blob);file.value=new File([blob],fileName.value,{type:'image/png'})
  }catch(e:any){error.value=e?.message??'Không tạo được ảnh'}
  finally{busy.value=false}
}
watch(month,build,{immediate:true})
onBeforeUnmount(()=>{if(url.value)URL.revokeObjectURL(url.value)})
async function share(){
  if(!file.value)return
  try{await navigator.share({files:[file.value],title:`Báo cáo ${report.value.label}`})}
  catch(e:any){if(e?.name!=='AbortError')download()}
}
function download(){
  const a=document.createElement('a');a.href=url.value;a.download=fileName.value;document.body.appendChild(a);a.click();a.remove()
  done.value='Đã tải ảnh về máy. Mở Zalo và gửi ảnh từ thư viện.'
}
// Ban điều hành can drop the report straight into a monthly meeting's documents
const isSuper=props.profile.role==='SUPER_ADMIN'
const meetings=ref<{id:string;title:string;date:string}[]>([]);const meetingId=ref('');const attaching=ref(false)
onMounted(async()=>{if(!isSuper)return;try{meetings.value=await recentMeetings();meetingId.value=meetings.value[0]?.id??''}catch{/* offline: just no attach option */}})
async function attach(){
  if(!file.value||!meetingId.value)return
  attaching.value=true;error.value='';done.value=''
  try{await uploadMeetingFile(meetingId.value,file.value);done.value=`Đã đính kèm vào "${meetings.value.find(m=>m.id===meetingId.value)?.title}".`}
  catch(e:any){error.value=e?.message??'Không đính kèm được'}
  finally{attaching.value=false}
}
</script>
<template><Teleport to="body"><div class="overlay sheet-overlay" @click.self="emit('close')"><section class="sheet">
<div class="head"><strong>📊 Báo cáo tháng</strong><button class="x" @click="emit('close')">✕</button></div>
<div class="months"><button @click="month=shift(month,-1)">‹</button><strong>{{report.label}}</strong><button :disabled="month>=today.slice(0,7)" @click="month=shift(month,1)">›</button></div>
<p class="note">ℹ️ Gồm số buổi, tỷ lệ điểm danh, chuyên cần từng ngành, top siêng năng và những người vắng nhiều (vắng ≥2 lần, hoặc vắng + phép ≥3 lần).<template v-if="month===today.slice(0,7)"> Tháng này chưa kết thúc nên số liệu chưa đủ.</template></p>
<div class="preview"><div v-if="busy&&!url" class="loading">Đang tạo ảnh…</div><p v-else-if="error&&!url" class="err">{{error}}</p><img v-else :src="url" :class="{dim:busy}" :alt="`Báo cáo ${report.label}`"></div>
<p v-if="done" class="done">{{done}}</p><p v-if="error&&url" class="err small">{{error}}</p>
<div class="actions">
  <button v-if="canShare" class="primary-btn" :disabled="busy" @click="share">📤 Gửi Zalo / Chia sẻ</button>
  <button :class="canShare?'secondary-btn':'primary-btn'" :disabled="busy||!url" @click="download">⬇️ Tải ảnh về</button>
  <div v-if="isSuper&&meetings.length" class="attach"><select v-model="meetingId"><option v-for="m in meetings" :key="m.id" :value="m.id">📁 {{m.title}}</option></select><button :disabled="busy||attaching||!file" @click="attach">{{attaching?'Đang gửi…':'📎 Đính kèm'}}</button></div>
</div>
</section></div></Teleport></template>
<style scoped>
.sheet{width:100%;max-width:560px;max-height:100%;background:#fff;border-radius:22px 22px 0 0;padding:14px 14px calc(14px + env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:10px}
.head{display:flex;justify-content:space-between;align-items:center}.x{border:0;background:#f1f5f9;width:34px;height:34px;border-radius:50%}
.months{flex:none;display:flex;align-items:center;justify-content:space-between;gap:10px;background:#f8fafc;border-radius:14px;padding:6px}
.months strong{font-size:.98rem}.months button{width:40px;height:36px;border:0;border-radius:10px;background:#fff;font-size:1.2rem;font-weight:900;color:#1d4ed8;box-shadow:0 2px 8px rgba(15,23,42,.06)}.months button:disabled{opacity:.35}
.note{flex:none;margin:0;background:#eff6ff;border:1px solid #dbeafe;color:#1e3a8a;border-radius:12px;padding:8px 10px;font-size:.74rem;line-height:1.45;font-weight:600}
.preview{flex:1;min-height:0;overflow:auto;background:#f1f5f9;border-radius:14px;display:flex;justify-content:center}
.preview img{width:100%;height:auto;display:block;align-self:flex-start;transition:opacity .2s}.preview img.dim{opacity:.5}
.loading,.err{padding:40px 10px;color:#64748b;font-weight:700}.err{color:#b91c1c}.err.small{padding:0;margin:0;font-size:.8rem;text-align:center}
.done{margin:0;font-size:.8rem;color:#047857;text-align:center}
.actions{display:grid;gap:8px;flex:none}.actions button:disabled{opacity:.6}
.attach{display:grid;grid-template-columns:1fr auto;gap:6px}.attach select{min-width:0;border:1px solid #dbe3ee;border-radius:12px;padding:9px;font-size:16px;background:#fff}
.attach button{border:0;background:#4f46e5;color:#fff;border-radius:12px;padding:0 12px;font-weight:800}
</style>

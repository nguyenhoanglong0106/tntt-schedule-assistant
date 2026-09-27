<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import ConfirmActionSheet from '@/components/ConfirmActionSheet.vue'
import { useAiChat } from '@/composables/useAiChat'
import { useApp } from '@/composables/useApp'
import { confirmAiAction, sendAiMessage } from '@/services/aiService'
import type { PendingAction } from '@/types'
import { startOfWeek, weekLabel, todayISO } from '@/utils/date'
const {state,refresh}=useApp();const {messages,reset,history}=useAiChat()
const text=ref('');const busy=ref(false);const pending=ref<PendingAction|null>(null);const listening=ref(false);const copied=ref<number|null>(null);const chat=ref<HTMLElement|null>(null)
onMounted(async()=>{await refresh();scrollDown()})
const scrollDown=()=>nextTick(()=>chat.value?.scrollTo({top:chat.value.scrollHeight}))
watch(()=>messages.value.length,scrollDown)

const suggestions=computed(()=>{
  const branch=state.profile?.role==='BRANCH_ADMIN'?' của ngành mình':''
  return [
    {label:'📋 Soạn tin tuần này',q:`Soạn tin nhắn lịch tuần này${branch} để gửi nhóm`},
    {label:'⚖️ Gợi ý người vệ sinh',q:'Gợi ý người làm vệ sinh tuần sau cho công bằng'},
    {label:'📖 Ai đọc sách?',q:'Tuần này ngành nào đọc sách, ai đọc ngày nào?'},
    {label:'🍦 Ai bán kem?',q:'Chủ nhật này ai bán kem, mấy giờ?'},
  ]
})

async function send(q=text.value.trim()){
  if(!q||busy.value||!state.data||!state.profile)return
  const past=history()
  messages.value.push({from:'user',text:q});text.value='';busy.value=true
  try{
    const r=await sendAiMessage(q,state.data,state.profile,past)
    if(r.kind==='pending'){
      pending.value=r.action
      messages.value.push({from:'ai',text:'Tôi đã hiểu yêu cầu. Vui lòng kiểm tra bản xem trước và xác nhận.',ctx:`[Bản xem trước, chờ xác nhận] ${r.action.previewTitle}\n${r.action.previewLines.join('\n')}`})
    }else messages.value.push({from:'ai',text:r.text,share:r.kind==='share'})
  }catch(e:any){messages.value.push({from:'ai',text:`⚠️ ${e?.message??'Không xử lý được yêu cầu'}`})}
  finally{busy.value=false}
}
async function confirm(){if(!pending.value||!state.data)return;busy.value=true;try{const r=await confirmAiAction(pending.value.id,state.data);messages.value.push({from:'ai',text:`✅ ${r.message}`});pending.value=null;await refresh()}catch(e:any){messages.value.push({from:'ai',text:`Không thể lưu: ${e?.message??'Lỗi xác nhận'}`})}finally{busy.value=false}}
function cancel(){pending.value=null;messages.value.push({from:'ai',text:'Đã hủy, chưa lưu thay đổi nào.'})}
async function copy(i:number,t:string){
  try{await navigator.clipboard.writeText(t)}
  catch{const ta=document.createElement('textarea');ta.value=t;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove()}
  copied.value=i;setTimeout(()=>{if(copied.value===i)copied.value=null},2000)
}
function newChat(){if(busy.value)return;pending.value=null;reset()}
function mic(){const SR=(window as any).SpeechRecognition||(window as any).webkitSpeechRecognition;if(!SR){messages.value.push({from:'ai',text:'Trình duyệt này chưa hỗ trợ nhập giọng nói. Bạn có thể nhập bằng bàn phím.'});return}const r=new SR();r.lang='vi-VN';r.interimResults=false;r.onstart=()=>listening.value=true;r.onend=()=>listening.value=false;r.onresult=(e:any)=>{text.value=e.results[0][0].transcript};r.start()}
</script>
<template><div class="ai-page" v-if="state.data&&state.profile"><header><div><div class="eyebrow">TRỢ LÝ TNTT</div><h1>✨ AI Phân công</h1><small>Tuần {{weekLabel(startOfWeek(todayISO()))}}</small></div><div class="head-actions"><div class="safety">✓ Luôn hỏi xác nhận</div><button v-if="messages.length>1" class="new-chat" @click="newChat">＋ Cuộc trò chuyện mới</button></div></header><main ref="chat" class="chat"><div v-for="(m,i) in messages" :key="i" class="bubble" :class="m.from"><span v-if="m.from==='ai'">✨</span><div :class="{share:m.share}">{{m.text}}<button v-if="m.share" class="copy" @click="copy(i,m.text)">{{copied===i?'✓ Đã sao chép':'📋 Sao chép'}}</button></div></div><div v-if="busy" class="bubble ai">✨ <div>Đang xử lý…</div></div></main><footer><div class="suggestions"><button v-for="s in suggestions" :key="s.label" :disabled="busy" @click="send(s.q)">{{s.label}}</button></div><div class="composer"><button class="mic" :class="{on:listening}" @click="mic">🎤</button><textarea v-model="text" rows="1" placeholder="Hỏi hoặc nhờ phân công…" @keydown.enter.exact.prevent="send()"></textarea><button class="send" :disabled="busy" @click="send()">➤</button></div></footer><ConfirmActionSheet v-if="pending" :action="pending" @cancel="cancel" @confirm="confirm"/></div></template>
<style scoped>.ai-page{min-height:calc(100vh - 78px);max-width:760px;margin:auto;display:flex;flex-direction:column;background:#f8fafc}.ai-page header{padding:18px 15px 12px;background:white;border-bottom:1px solid #e8edf4;display:flex;justify-content:space-between;align-items:center;gap:10px}.ai-page h1{font-size:1.35rem;margin:2px 0}.ai-page header small{color:#64748b}.head-actions{display:flex;flex-direction:column;align-items:flex-end;gap:6px}.safety{font-size:.72rem;background:#ecfdf5;color:#047857;padding:7px 9px;border-radius:999px;font-weight:800;white-space:nowrap}.new-chat{border:1px solid #e2e8f0;background:#fff;color:#475569;border-radius:999px;padding:5px 9px;font-size:.7rem;font-weight:700;white-space:nowrap}.chat{flex:1;padding:14px;display:flex;flex-direction:column;gap:10px;overflow:auto}.bubble{max-width:88%;display:flex;gap:7px;white-space:pre-line;line-height:1.42}.bubble>div{padding:11px 13px;border-radius:17px}.bubble.ai{align-self:flex-start}.bubble.ai>div{background:white;border:1px solid #e2e8f0}.bubble.ai>div.share{background:#f0fdf4;border-color:#bbf7d0}.copy{display:block;margin-top:9px;border:0;background:#16a34a;color:#fff;border-radius:10px;padding:7px 11px;font-weight:800;font-size:.8rem}.bubble.user{align-self:flex-end}.bubble.user>div{background:#1d4ed8;color:white}.ai-page footer{position:sticky;bottom:72px;background:#fff;border-top:1px solid #e2e8f0;padding:9px 10px calc(9px + env(safe-area-inset-bottom))}.suggestions{display:flex;gap:7px;overflow:auto;padding-bottom:8px;scrollbar-width:none}.suggestions::-webkit-scrollbar{display:none}.suggestions button{white-space:nowrap;border:1px solid #dbeafe;background:#eff6ff;color:#1e40af;border-radius:999px;padding:7px 9px;font-size:.74rem;font-weight:700}.suggestions button:disabled{opacity:.5}.composer{display:grid;grid-template-columns:42px 1fr 42px;gap:7px;align-items:end}.composer textarea{resize:none;border:1px solid #dbe3ee;border-radius:15px;padding:11px;min-height:44px;max-height:100px}.mic,.send{border:0;width:42px;height:42px;border-radius:50%}.mic{background:#f1f5f9}.mic.on{background:#fee2e2}.send{background:#1d4ed8;color:#fff}.send:disabled{opacity:.6}</style>

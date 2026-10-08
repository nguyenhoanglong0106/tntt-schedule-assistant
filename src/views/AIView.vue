<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import ConfirmActionSheet from '@/components/ConfirmActionSheet.vue'
import { useAiChat, type ChatMessage } from '@/composables/useAiChat'
import { useApp } from '@/composables/useApp'
import { confirmAiAction, sendAiMessage } from '@/services/aiService'
import type { PendingAction } from '@/types'
import { startOfWeek, weekLabel, todayISO } from '@/utils/date'
const {state,refresh}=useApp();const {messages,reset,history}=useAiChat()
const text=ref('');const busy=ref(false);const pending=ref<PendingAction|null>(null);const listening=ref(false);const copied=ref<number|null>(null);const chat=ref<HTMLElement|null>(null);const input=ref<HTMLTextAreaElement|null>(null)
const scrollDown=(smooth=true)=>nextTick(()=>chat.value?.scrollTo({top:chat.value.scrollHeight,behavior:smooth?'smooth':'auto'}))
onMounted(async()=>{scrollDown(false);await refresh();scrollDown(false)})
// The chat only renders once data has loaded, so also scroll when it first appears
watch(chat,el=>{if(el)scrollDown(false)})
watch([()=>messages.value.length,busy],()=>scrollDown())

const add=(m:ChatMessage)=>messages.value.push({...m,at:Date.now()})
const time=(at?:number)=>at?new Date(at).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit',hour12:false}):''
// Group consecutive messages from the same side, like messaging apps: avatar and time only on the last one
const lastOfGroup=(i:number)=>messages.value[i+1]?.from!==messages.value[i].from

const suggestions=computed(()=>{
  const branch=state.profile?.role==='BRANCH_ADMIN'?' của ngành mình':''
  return [
    {label:'📋 Soạn tin tuần này',q:`Soạn tin nhắn lịch tuần này${branch} để gửi nhóm`},
    // These use the attendance / meeting figures the app sends along (aiInsights.ts)
    {label:'🏆 Ai siêng năng nhất?',q:`Tháng này ai siêng năng nhất${branch}? Soạn tin khen ngắn để gửi nhóm`},
    {label:'🙋 Ai hay vắng?',q:`Năm học này ai vắng nhiều${branch}? Gợi ý cách hỏi han nhẹ nhàng`},
    {label:'📁 Việc cần làm sau họp',q:'Buổi họp gần nhất có những việc cần làm gì, ai phụ trách, hạn khi nào?'},
    {label:'📊 Tổng kết tháng trước',q:'Tóm tắt chuyên cần tháng trước của từng ngành, ngành nào cần quan tâm?'},
    {label:'📋 Buổi chưa điểm danh',q:'Còn những buổi nào chưa điểm danh?'},
    {label:'⚖️ Gợi ý người vệ sinh',q:'Gợi ý người làm vệ sinh tuần sau cho công bằng'},
    {label:'📖 Ai đọc sách?',q:'Tuần này ngành nào đọc sách, ai đọc ngày nào?'},
    {label:'🍦 Ai bán kem?',q:'Chủ nhật này ai bán kem, mấy giờ?'},
  ]
})

function autoGrow(){const el=input.value;if(!el)return;el.style.height='auto';el.style.height=`${Math.min(el.scrollHeight,110)}px`}
watch(text,()=>nextTick(autoGrow))

async function send(q=text.value.trim()){
  if(!q||busy.value||!state.data||!state.profile)return
  const past=history()
  add({from:'user',text:q});text.value='';busy.value=true
  try{
    const r=await sendAiMessage(q,state.data,state.profile,past)
    if(r.kind==='pending'){
      pending.value=r.action
      add({from:'ai',text:'Tôi đã hiểu yêu cầu. Vui lòng kiểm tra bản xem trước và xác nhận.',ctx:`[Bản xem trước, chờ xác nhận] ${r.action.previewTitle}\n${r.action.previewLines.join('\n')}`})
    }else add({from:'ai',text:r.text,share:r.kind==='share',retry:r.kind==='clarify'&&r.retry?q:undefined})
  }catch(e:any){add({from:'ai',text:`⚠️ ${e?.message??'Không xử lý được yêu cầu'}`,retry:q})}
  finally{busy.value=false}
}
// Drop the failed exchange and ask again, so the error turn never reaches the AI as history
function retry(i:number){const q=messages.value[i]?.retry;if(!q||busy.value)return;const u=messages.value[i-1]?.from==='user'?i-1:i;messages.value.splice(u,i-u+1);send(q)}
async function confirm(){if(!pending.value||!state.data)return;busy.value=true;try{const r=await confirmAiAction(pending.value.id,state.data);add({from:'ai',text:`✅ ${r.message}`});pending.value=null;await refresh()}catch(e:any){add({from:'ai',text:`Không thể lưu: ${e?.message??'Lỗi xác nhận'}`})}finally{busy.value=false}}
function cancel(){pending.value=null;add({from:'ai',text:'Đã hủy, chưa lưu thay đổi nào.'})}
async function copy(i:number,t:string){
  try{await navigator.clipboard.writeText(t)}
  catch{const ta=document.createElement('textarea');ta.value=t;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove()}
  copied.value=i;setTimeout(()=>{if(copied.value===i)copied.value=null},2000)
}
function newChat(){if(busy.value)return;pending.value=null;reset()}
function mic(){const SR=(window as any).SpeechRecognition||(window as any).webkitSpeechRecognition;if(!SR){add({from:'ai',text:'Trình duyệt này chưa hỗ trợ nhập giọng nói. Bạn có thể nhập bằng bàn phím.'});return}const r=new SR();r.lang='vi-VN';r.interimResults=false;r.onstart=()=>listening.value=true;r.onend=()=>listening.value=false;r.onresult=(e:any)=>{text.value=e.results[0][0].transcript};r.start()}
</script>
<template><div class="ai-page" v-if="state.data&&state.profile">
<header><div class="who"><img class="avatar big" src="/ai-avatar.svg" alt="AI"><div><h1>AI Phân công</h1><small><span class="dot"></span>{{busy?'Đang trả lời…':'Trợ lý TNTT · Tuần '+weekLabel(startOfWeek(todayISO()))}}</small></div></div><div class="head-actions"><div class="safety">✓ Luôn hỏi xác nhận</div><button v-if="messages.length>1" class="new-chat" @click="newChat">＋ Trò chuyện mới</button></div></header>
<main ref="chat" class="chat"><div class="thread">
  <div v-for="(m,i) in messages" :key="i" class="msg" :class="[m.from,{last:lastOfGroup(i)}]">
    <img v-if="m.from==='ai'" class="avatar" :class="{hide:!lastOfGroup(i)}" src="/ai-avatar.svg" alt="">
    <div class="col"><div class="bubble" :class="{share:m.share}">{{m.text}}<button v-if="m.share" class="copy" @click="copy(i,m.text)">{{copied===i?'✓ Đã sao chép':'📋 Sao chép'}}</button><button v-if="m.retry&&i===messages.length-1" class="retry" :disabled="busy" @click="retry(i)">🔄 Thử lại</button></div><small v-if="lastOfGroup(i)&&m.at" class="time">{{time(m.at)}}</small></div>
  </div>
  <div v-if="busy" class="msg ai last"><img class="avatar" src="/ai-avatar.svg" alt=""><div class="col"><div class="bubble typing"><i></i><i></i><i></i></div></div></div>
</div></main>
<footer><div class="suggestions"><button v-for="s in suggestions" :key="s.label" :disabled="busy" @click="send(s.q)">{{s.label}}</button></div><div class="composer"><button class="mic" :class="{on:listening}" @click="mic">🎤</button><textarea ref="input" v-model="text" rows="1" placeholder="Nhập tin nhắn…" @keydown.enter.exact.prevent="send()"></textarea><button class="send" :disabled="busy||!text.trim()" @click="send()">➤</button></div></footer>
<ConfirmActionSheet v-if="pending" :action="pending" @cancel="cancel" @confirm="confirm"/></div></template>
<style scoped>
.ai-page{flex:1;min-height:0;width:100%;max-width:760px;margin:0 auto;display:flex;flex-direction:column;background:#f1f5f9}
.ai-page header{flex:none;padding:12px 14px;background:#fff;border-bottom:1px solid #e8edf4;display:flex;justify-content:space-between;align-items:center;gap:10px}
.who{display:flex;align-items:center;gap:10px;min-width:0;flex:1}.who>div{min-width:0}.ai-page h1{font-size:1.08rem;margin:0;white-space:nowrap}.ai-page header small{color:#64748b;font-size:.74rem;display:flex;align-items:center;gap:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dot{width:7px;height:7px;border-radius:50%;background:#22c55e;flex:none}
.head-actions{display:flex;flex-direction:column;align-items:flex-end;gap:5px;flex:none}
/* Small phones: the confirm sheet already guarantees "luôn hỏi xác nhận", so drop the pill for room */
@media(max-width:380px){.safety{display:none}.ai-page header{padding:10px 12px}.avatar.big{width:36px;height:36px}}.safety{font-size:.68rem;background:#ecfdf5;color:#047857;padding:5px 8px;border-radius:999px;font-weight:800;white-space:nowrap}.new-chat{border:1px solid #e2e8f0;background:#fff;color:#475569;border-radius:999px;padding:4px 9px;font-size:.68rem;font-weight:700;white-space:nowrap}
.avatar{width:30px;height:30px;flex:none;border-radius:50%;align-self:flex-end;filter:drop-shadow(0 2px 4px rgba(15,23,42,.15))}.avatar.big{width:42px;height:42px;align-self:center}.avatar.hide{visibility:hidden}
.chat{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:14px 12px 8px}
.thread{min-height:100%;display:flex;flex-direction:column;justify-content:flex-end;gap:3px}
.msg{display:flex;gap:7px;max-width:86%}.msg.last{margin-bottom:9px}.msg.ai{align-self:flex-start}.msg.user{align-self:flex-end;justify-content:flex-end}
.col{display:flex;flex-direction:column;min-width:0}.msg.user .col{align-items:flex-end}
.bubble{padding:9px 13px;border-radius:18px;white-space:pre-line;line-height:1.42;overflow-wrap:anywhere;font-size:.93rem}
.msg.ai .bubble{background:#fff;color:#0f172a;box-shadow:0 1px 2px rgba(15,23,42,.08)}.msg.ai.last .bubble{border-bottom-left-radius:5px}
.msg.user .bubble{background:#1d4ed8;color:#fff}.msg.user.last .bubble{border-bottom-right-radius:5px}
.bubble.share{background:#f0fdf4!important;border:1px solid #bbf7d0}
.time{font-size:.66rem;color:#94a3b8;margin:3px 6px 0}
.retry{display:block;margin-top:8px;border:0;background:#1d4ed8;color:#fff;border-radius:10px;padding:7px 12px;font-weight:800;font-size:.8rem}.retry:disabled{opacity:.5}
.copy{display:block;margin-top:9px;border:0;background:#16a34a;color:#fff;border-radius:10px;padding:7px 11px;font-weight:800;font-size:.8rem}
.typing{display:flex;gap:4px;padding:13px 14px}.typing i{width:7px;height:7px;border-radius:50%;background:#94a3b8;animation:blink 1.2s infinite}.typing i:nth-child(2){animation-delay:.2s}.typing i:nth-child(3){animation-delay:.4s}
@keyframes blink{0%,60%,100%{opacity:.3;transform:translateY(0)}30%{opacity:1;transform:translateY(-3px)}}
.ai-page footer{flex:none;background:#fff;border-top:1px solid #e2e8f0;padding:8px 10px}
.suggestions{display:flex;gap:7px;overflow:auto;padding-bottom:8px;scrollbar-width:none}.suggestions::-webkit-scrollbar{display:none}.suggestions button{white-space:nowrap;border:1px solid #dbeafe;background:#eff6ff;color:#1e40af;border-radius:999px;padding:6px 9px;font-size:.72rem;font-weight:700}.suggestions button:disabled{opacity:.5}
.composer{display:grid;grid-template-columns:40px 1fr 40px;gap:7px;align-items:end}.composer textarea{resize:none;border:1px solid #dbe3ee;background:#f8fafc;border-radius:20px;padding:10px 14px;min-height:40px;max-height:110px;line-height:1.35;font-size:16px;outline:none}.composer textarea:focus{border-color:#93c5fd;background:#fff}
.mic,.send{border:0;width:40px;height:40px;border-radius:50%}.mic{background:#f1f5f9}.mic.on{background:#fee2e2}.send{background:#1d4ed8;color:#fff}.send:disabled{opacity:.45}
</style>

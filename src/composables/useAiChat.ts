import { ref, watch } from 'vue'

// ctx: what the AI sees for this turn in later requests (e.g. the preview it proposed), when it differs from the bubble text
export type ChatMessage = { from:'user'|'ai'; text:string; ctx?:string; share?:boolean }

const KEY='tntt-ai-chat-v1'
const GREETING:ChatMessage={from:'ai',text:'Chào bạn 👋 Hãy nói việc cần phân công, hỏi về lịch, hoặc nhờ tôi soạn tin nhắn gửi nhóm.'}
const load=():ChatMessage[]=>{try{const raw=sessionStorage.getItem(KEY);if(raw)return JSON.parse(raw)}catch{}return [GREETING]}

// Module-level so the conversation survives switching tabs; sessionStorage so it survives a reload
const messages=ref<ChatMessage[]>(load())
watch(messages,v=>{try{sessionStorage.setItem(KEY,JSON.stringify(v.slice(-40)))}catch{}},{deep:true})

export function useAiChat(){
  const reset=()=>{messages.value=[GREETING]}
  // Turns sent to the server as conversation history (greeting excluded)
  const history=()=>messages.value.slice(1).map(m=>({from:m.from,text:m.ctx??m.text}))
  return {messages,reset,history}
}

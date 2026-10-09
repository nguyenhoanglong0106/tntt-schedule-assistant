<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useApp } from '@/composables/useApp'
import { isNetworkError } from '@/services/attendanceOutbox'
import { deleteMeeting, deleteMeetingFile, listMeetings, markMeetingViewed, MAX_FILE_MB, notifyMeeting, saveMeeting, summarizeMeeting, uploadMeetingFile } from '@/services/meetingService'
import type { Meeting, MeetingFile } from '@/types'
import { todayISO, weekdayLabel } from '@/utils/date'
const router=useRouter();const {state,refresh,isSuper,readOnly}=useApp()
const meetings=ref<Meeting[]>([]);const loading=ref(true);const loadError=ref('');const toast=ref('')
const openId=ref<string|null>(null)
async function load(){
  loading.value=true;loadError.value=''
  try{meetings.value=await listMeetings(isSuper.value)}
  catch(e:any){loadError.value=isNetworkError(e)?'Không có mạng. Cần có mạng để xem tài liệu họp.':(e?.message??'Không tải được danh sách họp')}
  finally{loading.value=false}
}
// Opening a meeting counts as "đã xem" for Ban điều hành's read list
function toggle(m:Meeting){
  openId.value=openId.value===m.id?null:m.id
  if(openId.value&&!m.viewedByMe){m.viewedByMe=true;markMeetingViewed(m.id).catch(()=>undefined)}
}
onMounted(async()=>{
  if(!state.profile)await refresh()
  // Leaders' documents, not for the shared thư ký ngành login
  if(readOnly.value){router.replace('/profile');return}
  await load()
  const latest=meetings.value[0];if(latest)toggle(latest)
})
function say(msg:string){toast.value=msg;setTimeout(()=>{if(toast.value===msg)toast.value=''},3500)}

const fmtDate=(d:string)=>`${weekdayLabel(d)} ${d.slice(8,10)}/${d.slice(5,7)}/${d.slice(0,4)}`
const fmtTime=(iso:string)=>{const d=new Date(iso);return`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')} ${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`}
const isImage=(f:MeetingFile)=>!!f.mime?.startsWith('image/')
const images=(m:Meeting)=>m.files.filter(isImage)
const docs=(m:Meeting)=>m.files.filter(f=>!isImage(f))
function icon(f:MeetingFile){const n=f.name.toLowerCase();return /\.docx?$/.test(n)?'📝':/\.pdf$/.test(n)?'📕':/\.xlsx?$/.test(n)?'📊':/\.pptx?$/.test(n)?'📽️':'📄'}
const size=(b:number|null)=>b==null?'':b<1024*1024?`${Math.max(1,Math.round(b/1024))} KB`:`${(b/1024/1024).toFixed(1)} MB`
const seen=(m:Meeting)=>m.viewers?.filter(v=>v.viewedAt)??[]
const unseen=(m:Meeting)=>m.viewers?.filter(v=>!v.viewedAt)??[]

// ── Ban điều hành: create / edit ─────────────────────────────────────────────
const editing=ref<{id?:string;title:string;date:string;notes:string}|null>(null)
const busy=ref(false);const formError=ref('')
function newMeeting(){const t=todayISO();editing.value={title:`Họp tháng ${Number(t.slice(5,7))}/${t.slice(0,4)}`,date:t,notes:''};formError.value=''}
function edit(m:Meeting){editing.value={id:m.id,title:m.title,date:m.date,notes:m.notes??''};formError.value=''}
async function submit(){
  const f=editing.value;if(!f)return
  if(!f.title.trim()||!f.date){formError.value='Cần nhập tên và ngày họp.';return}
  busy.value=true;formError.value=''
  try{
    const id=await saveMeeting({id:f.id,title:f.title.trim(),date:f.date,notes:f.notes.trim()||null})
    // The author has obviously seen it; don't flag it "Mới" for them
    await markMeetingViewed(id).catch(()=>undefined)
    editing.value=null;await load();openId.value=id
  }
  catch(e:any){formError.value=e?.message??'Không lưu được'}
  finally{busy.value=false}
}
async function remove(m:Meeting){
  if(!confirm(`Xoá "${m.title}" và ${m.files.length} tài liệu? Không thể hoàn tác.`))return
  try{await deleteMeeting(m);await load();say('Đã xoá buổi họp')}catch(e:any){say(e?.message??'Không xoá được')}
}

// ── Ban điều hành: files ────────────────────────────────────────────────────
const uploading=ref<{meetingId:string;done:number;total:number}|null>(null)
async function upload(m:Meeting,ev:Event){
  const input=ev.target as HTMLInputElement;const files=[...(input.files??[])];input.value=''
  if(!files.length)return
  uploading.value={meetingId:m.id,done:0,total:files.length};const errors:string[]=[]
  for(const f of files){
    try{await uploadMeetingFile(m.id,f)}catch(e:any){errors.push(isNetworkError(e)?`"${f.name}": mất mạng`:(e?.message??f.name))}
    uploading.value={...uploading.value!,done:uploading.value!.done+1}
  }
  uploading.value=null;await load();openId.value=m.id
  say(errors.length?`⚠️ Không tải lên được: ${errors.join('; ')}`:`Đã thêm ${files.length} tài liệu. Nhớ bấm "Báo cho các trưởng ngành" khi đăng xong.`)
}
async function removeFile(f:MeetingFile){
  if(!confirm(`Xoá "${f.name}"?`))return
  try{await deleteMeetingFile(f);await load();openId.value=f.meetingId}catch(e:any){say(e?.message??'Không xoá được')}
}
const notifying=ref('')
async function notify(m:Meeting){
  if(!confirm(m.notifiedAt?`Đã báo lúc ${fmtTime(m.notifiedAt)}. Báo lại cho tất cả trưởng ngành?`:'Gửi thông báo cho tất cả trưởng ngành?'))return
  notifying.value=m.id
  try{const n=await notifyMeeting(m.id);await load();openId.value=m.id;say(n?`Đã báo cho ${n} người`:'Đã ghi nhận thông báo')}
  catch(e:any){say(e?.message??'Không gửi được thông báo')}
  finally{notifying.value=''}
}

// ── Ban điều hành: AI summary ────────────────────────────────────────────────
const summarizing=ref('')
async function summarize(m:Meeting){
  summarizing.value=m.id
  try{await summarizeMeeting(m.id);await load();openId.value=m.id;say('Đã tóm tắt xong')}
  catch(e:any){say(isNetworkError(e)?'Mất mạng, chưa tóm tắt được':(e?.message??'AI chưa tóm tắt được'))}
  finally{summarizing.value=''}
}

// ── Photo viewer ────────────────────────────────────────────────────────────
const viewer=ref<{list:MeetingFile[];i:number}|null>(null)
const shown=computed(()=>viewer.value?viewer.value.list[viewer.value.i]:null)
function step(d:number){if(!viewer.value)return;const n=viewer.value.list.length;viewer.value.i=(viewer.value.i+d+n)%n}
</script>
<template><div class="page">
<div class="page-head"><div><div class="eyebrow">BAN ĐIỀU HÀNH</div><h1>📁 Họp tháng</h1></div><button class="back" @click="router.back()">‹ Quay lại</button></div>
<p class="note">ℹ️ <template v-if="isSuper">Tạo buổi họp, đính kèm file Word/PDF hoặc chụp ảnh nội dung, rồi bấm <b>"Báo cho các trưởng ngành"</b> để mọi người nhận thông báo. Bạn xem được ai đã mở, ai chưa.</template><template v-else>Nội dung và tài liệu các buổi họp tháng do Ban điều hành đăng. Bấm vào ảnh để xem lớn, bấm vào file để mở.</template></p>
<button v-if="isSuper" class="primary-btn add" @click="newMeeting">＋ Tạo buổi họp</button>
<p v-if="loading&&!meetings.length" class="subtle center">Đang tải…</p>
<p v-else-if="loadError" class="warning">{{loadError}} <button class="link" @click="load">Thử lại</button></p>
<p v-else-if="!meetings.length" class="subtle center">Chưa có buổi họp nào{{isSuper?'. Bấm "Tạo buổi họp" để bắt đầu.':'.'}}</p>
<div class="stack">
<article v-for="m in meetings" :key="m.id" class="meeting" :class="{open:openId===m.id}">
  <button class="m-head" @click="toggle(m)">
    <div class="m-title"><strong>{{m.title}}</strong><span v-if="!m.viewedByMe" class="new">Mới</span></div>
    <div class="m-meta">🗓 {{fmtDate(m.date)}} · {{m.files.length}} tài liệu<template v-if="m.viewers?.length"> · 👁 {{seen(m).length}}/{{m.viewers.length}}</template></div>
    <b class="chev">{{openId===m.id?'▴':'▾'}}</b>
  </button>
  <div v-if="openId===m.id" class="m-body">
    <p v-if="m.notes" class="notes">{{m.notes}}</p>
    <div v-if="m.summary" class="ai-sum">
      <div class="ai-head">✨ Tóm tắt bởi AI<small v-if="m.summarizedAt"> · {{fmtTime(m.summarizedAt)}}</small></div>
      <ul><li v-for="(p,i) in m.summary.points" :key="i">{{p}}</li></ul>
      <template v-if="m.summary.actions.length"><div class="ai-sub">✅ Việc cần làm</div>
      <ul class="acts"><li v-for="(a,i) in m.summary.actions" :key="i"><b>{{a.task}}</b><span v-if="a.owner||a.due" class="who"> · {{[a.owner,a.due&&`hạn ${a.due}`].filter(Boolean).join(' · ')}}</span></li></ul></template>
      <p class="ai-note">AI có thể đọc sai chữ viết tay. Khi cần chính xác, hãy xem tài liệu gốc bên dưới.</p>
    </div>
    <div v-if="images(m).length" class="thumbs"><button v-for="(f,i) in images(m)" :key="f.id" class="thumb" @click="viewer={list:images(m),i}"><img v-if="f.url" :src="f.url" :alt="f.name" loading="lazy"/><span v-else>🖼️</span><span v-if="isSuper" class="rm" role="button" @click.stop="removeFile(f)">✕</span></button></div>
    <div v-if="docs(m).length" class="docs"><div v-for="f in docs(m)" :key="f.id" class="doc"><a :href="f.url??undefined" target="_blank" rel="noopener" :class="{off:!f.url}"><span class="ic">{{icon(f)}}</span><span class="dn"><b>{{f.name}}</b><small>{{size(f.size)}} · bấm để mở</small></span></a><button v-if="isSuper" class="rm-doc" @click="removeFile(f)">✕</button></div></div>
    <p v-if="!m.files.length" class="subtle">Chưa có tài liệu.</p>
    <template v-if="isSuper">
      <div class="upload">
        <label class="up-btn"><input type="file" accept="image/*" capture="environment" @change="upload(m,$event)"/>📷 Chụp ảnh</label>
        <label class="up-btn"><input type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx" @change="upload(m,$event)"/>📎 Thêm file</label>
      </div>
      <p v-if="uploading?.meetingId===m.id" class="progress">⏳ Đang tải lên {{uploading.done+1}}/{{uploading.total}}…</p>
      <p class="hint">Word, PDF, Excel, PowerPoint hoặc ảnh, tối đa {{MAX_FILE_MB}} MB/file. Ảnh được tự thu nhỏ cho nhẹ.</p>
      <button class="ai-btn" :disabled="summarizing===m.id||!!uploading||(!m.files.length&&!m.notes)" @click="summarize(m)">{{summarizing===m.id?'✨ AI đang đọc tài liệu… (khoảng 10–30 giây)':m.summary?'✨ Tóm tắt lại bằng AI':'✨ Tóm tắt bằng AI'}}</button>
      <p v-if="m.summary?.skipped?.length" class="hint">AI chưa đọc được: {{m.summary.skipped.join(', ')}} (AI đọc được ảnh, PDF và Word).</p>
      <button class="notify" :disabled="notifying===m.id||!!uploading" @click="notify(m)">{{notifying===m.id?'Đang gửi…':'🔔 Báo cho các trưởng ngành'}}</button>
      <p v-if="m.notifiedAt" class="hint center">Đã báo lúc {{fmtTime(m.notifiedAt)}}</p>
      <div v-if="m.viewers?.length" class="viewers">
        <div><b>👁 Đã xem ({{seen(m).length}}):</b> {{seen(m).map(v=>v.name).join(', ')||'chưa có ai'}}</div>
        <div v-if="unseen(m).length" class="not-yet"><b>Chưa xem ({{unseen(m).length}}):</b> {{unseen(m).map(v=>v.name).join(', ')}}</div>
      </div>
      <div class="admin-row"><button @click="edit(m)">✏️ Sửa</button><button class="danger" @click="remove(m)">🗑 Xoá buổi họp</button></div>
    </template>
  </div>
</article>
</div>
<div v-if="toast" class="toast">{{toast}}</div>

<Teleport to="body"><div v-if="editing" class="overlay sheet-overlay" @click.self="editing=null"><section class="sheet">
  <div class="s-head"><strong>{{editing.id?'✏️ Sửa buổi họp':'📁 Tạo buổi họp'}}</strong><button class="x" @click="editing=null">✕</button></div>
  <div class="s-body">
    <label>Tên buổi họp<input v-model="editing.title" placeholder="Họp tháng 10/2026"/></label>
    <label>Ngày họp<input v-model="editing.date" type="date"/></label>
    <label>Nội dung chính <small>(không bắt buộc)</small><textarea v-model="editing.notes" rows="4" placeholder="Các ý chính, việc cần chuẩn bị…"></textarea></label>
    <p class="hint">Lưu xong, bạn đính kèm file hoặc chụp ảnh ngay trong buổi họp đó.</p>
    <p v-if="formError" class="err">{{formError}}</p>
  </div>
  <div class="s-foot"><button class="primary-btn" :disabled="busy" @click="submit">{{busy?'Đang lưu…':'💾 Lưu'}}</button></div>
</section></div></Teleport>

<Teleport to="body"><div v-if="viewer&&shown" class="photo" @click.self="viewer=null">
  <button class="p-close" @click="viewer=null">✕</button>
  <img v-if="shown.url" :src="shown.url" :alt="shown.name"/>
  <div class="p-bar">
    <button v-if="viewer.list.length>1" @click="step(-1)">‹</button>
    <span>{{viewer.i+1}}/{{viewer.list.length}}</span>
    <a v-if="shown.url" :href="shown.url" target="_blank" rel="noopener">🔍 Phóng to / lưu</a>
    <button v-if="viewer.list.length>1" @click="step(1)">›</button>
  </div>
</div></Teleport>
</div></template>
<style scoped>
.back{border:0;background:#fff;border-radius:12px;padding:9px 11px;font-weight:800;color:#475569;box-shadow:0 4px 14px rgba(15,23,42,.06)}
.note{margin:0 0 12px;background:#eff6ff;border:1px solid #dbeafe;color:#1e3a8a;border-radius:12px;padding:8px 10px;font-size:.78rem;line-height:1.45;font-weight:600}
.add{width:100%;margin-bottom:12px;padding:12px}
.center{text-align:center}.link{border:0;background:none;color:#1d4ed8;font-weight:800;text-decoration:underline;padding:0}
.meeting{background:#fff;border:1px solid #e7edf5;border-radius:16px;overflow:hidden}.meeting.open{border-color:#c7d2fe;box-shadow:0 6px 18px rgba(29,78,216,.08)}
.m-head{width:100%;border:0;background:none;text-align:left;padding:12px 38px 12px 14px;position:relative;display:grid;gap:4px;color:#0f172a}
.m-title{display:flex;align-items:center;gap:8px;min-width:0}.m-title strong{font-size:.98rem;overflow-wrap:anywhere}
.new{flex:none;background:#dc2626;color:#fff;border-radius:999px;padding:1px 8px;font-size:.68rem;font-weight:900}
.m-meta{font-size:.78rem;color:#64748b;font-weight:700}.chev{position:absolute;right:14px;top:50%;transform:translateY(-50%);color:#94a3b8}
.m-body{padding:0 14px 14px;display:grid;gap:10px}
.ai-sum{background:linear-gradient(135deg,#f5f3ff,#eff6ff);border:1px solid #ddd6fe;border-radius:14px;padding:11px 12px;display:grid;gap:6px;font-size:.86rem;line-height:1.5;color:#1e293b}.ai-head{font-weight:900;color:#5b21b6}.ai-head small{color:#7c3aed;font-weight:700}.ai-sum ul{margin:0;padding-left:18px;display:grid;gap:3px}.ai-sub{font-weight:900;color:#15803d;margin-top:4px}.acts .who{color:#64748b;font-weight:600}.ai-note{margin:2px 0 0;font-size:.72rem;color:#64748b}
.ai-btn{border:0;background:linear-gradient(135deg,#7c3aed,#4f46e5);color:#fff;border-radius:12px;padding:12px;font-weight:900}.ai-btn:disabled{opacity:.6}
.notes{margin:0;white-space:pre-wrap;font-size:.88rem;line-height:1.5;color:#334155;background:#f8fafc;border-radius:12px;padding:10px}
.thumbs{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
.thumb{position:relative;aspect-ratio:1;border:0;padding:0;border-radius:10px;overflow:hidden;background:#f1f5f9;display:grid;place-items:center;font-size:1.4rem}
.thumb img{width:100%;height:100%;object-fit:cover;display:block}
.thumb .rm{position:absolute;top:4px;right:4px;width:24px;height:24px;border-radius:50%;background:rgba(15,23,42,.6);color:#fff;font-size:.72rem;display:grid;place-items:center}
.docs{display:grid;gap:6px}.doc{display:flex;align-items:center;gap:6px}
.doc a{flex:1;min-width:0;display:flex;align-items:center;gap:10px;text-decoration:none;color:#0f172a;border:1px solid #e2e8f0;border-radius:12px;padding:9px 10px;background:#fff}.doc a.off{opacity:.5;pointer-events:none}
.ic{font-size:1.4rem;flex:none}.dn{display:grid;min-width:0}.dn b{font-size:.86rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dn small{font-size:.72rem;color:#64748b;font-weight:600}
.rm-doc{flex:none;border:0;background:#fef2f2;color:#b91c1c;border-radius:10px;width:34px;height:34px}
.upload{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.up-btn{display:flex;align-items:center;justify-content:center;gap:6px;border:1px dashed #93c5fd;background:#eff6ff;color:#1d4ed8;border-radius:12px;padding:11px 6px;font-weight:800;font-size:.86rem;cursor:pointer}
.up-btn input{display:none}
.progress{margin:0;font-weight:800;color:#1d4ed8;font-size:.84rem}.hint{margin:0;font-size:.74rem;color:#64748b}
.notify{border:0;background:#ea580c;color:#fff;border-radius:12px;padding:12px;font-weight:900}.notify:disabled{opacity:.6}
.viewers{background:#f8fafc;border-radius:12px;padding:10px;font-size:.8rem;line-height:1.5;color:#334155;display:grid;gap:4px}.not-yet{color:#b45309}
.admin-row{display:grid;grid-template-columns:1fr 1fr;gap:8px}.admin-row button{border:1px solid #e2e8f0;background:#fff;border-radius:12px;padding:10px;font-weight:800;color:#475569}.admin-row .danger{color:#b91c1c;border-color:#fecaca;background:#fef2f2}
.toast{position:fixed;left:12px;right:12px;bottom:calc(var(--nav-h) + 12px);background:#0f172a;color:#fff;border-radius:14px;padding:12px 14px;font-size:.84rem;font-weight:700;z-index:60;box-shadow:0 10px 30px rgba(15,23,42,.3);max-width:560px;margin:0 auto}
/* Save pinned at the bottom of the sheet */
.sheet{width:100%;max-width:560px;max-height:100%;background:#fff;border-radius:22px 22px 0 0;display:flex;flex-direction:column;overflow:hidden}
.s-head{flex:none;display:flex;justify-content:space-between;align-items:center;padding:14px 14px 4px}.x{border:0;background:#f1f5f9;width:34px;height:34px;border-radius:50%}
.s-body{flex:1;min-height:0;overflow-y:auto;padding:8px 14px;display:grid;gap:12px}
.s-body label{display:grid;gap:6px;font-size:.82rem;font-weight:800;color:#475569}.s-body label small{font-weight:600;color:#94a3b8}
.s-body input,.s-body textarea{width:100%;min-width:0;border:1px solid #dbe3ee;border-radius:12px;padding:10px 12px;font-size:16px;background:#fff;color:#0f172a;font-weight:500;-webkit-appearance:none;appearance:none}
.s-body input[type=date]{min-height:44px}.s-body textarea{resize:vertical}
.err{margin:0;color:#b91c1c;font-weight:700;font-size:.82rem}
.s-foot{flex:none;padding:10px 14px calc(12px + env(safe-area-inset-bottom));border-top:1px solid #eef2f7}.s-foot .primary-btn{width:100%;padding:13px}
.photo{position:fixed;inset:0;z-index:110;background:rgba(2,6,23,.95);display:flex;align-items:center;justify-content:center;padding:calc(env(safe-area-inset-top) + 52px) 8px calc(env(safe-area-inset-bottom) + 64px)}
.photo img{max-width:100%;max-height:100%;object-fit:contain;border-radius:6px}
.p-close{position:absolute;top:calc(env(safe-area-inset-top) + 10px);right:12px;width:38px;height:38px;border-radius:50%;border:0;background:rgba(255,255,255,.15);color:#fff;font-size:1rem}
.p-bar{position:absolute;left:0;right:0;bottom:calc(env(safe-area-inset-bottom) + 12px);display:flex;justify-content:center;align-items:center;gap:14px;color:#fff;font-weight:800;font-size:.86rem}
.p-bar button{width:42px;height:42px;border-radius:50%;border:0;background:rgba(255,255,255,.15);color:#fff;font-size:1.3rem}
.p-bar a{color:#fff;background:rgba(255,255,255,.15);border-radius:999px;padding:8px 12px;text-decoration:none}
</style>

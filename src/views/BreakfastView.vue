<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BranchBadge from '@/components/BranchBadge.vue'
import { useApp } from '@/composables/useApp'
import { isNetworkError } from '@/services/attendanceOutbox'
import { loadBreakfast, notifyBreakfast, saveBallot, saveMenuItem, setBreakfastWeek, setMenuItemActive, type BreakfastData } from '@/services/breakfastService'
import type { BreakfastItem } from '@/types'
import { BREAKFAST_TIME, deadlineDay, isOpen, MAX_PICKS, minPicks, RANK_POINTS, tallyBreakfast, timeLeft, upcomingBreakfast } from '@/utils/breakfast'
import { addDays, todayISO } from '@/utils/date'
const router=useRouter();const route=useRoute();const {state,refresh,isSuper}=useApp()
const today=todayISO();const upcoming=upcomingBreakfast(today)
// ?week= from a link; any day maps to the Sunday of its week
const q=typeof route.query.week==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(route.query.week)?route.query.week:null
const week=ref(q?upcomingBreakfast(addDays(q,-1)):upcoming)
const data=ref<BreakfastData|null>(null);const loading=ref(true);const loadError=ref('');const toast=ref('')
// Keeps the countdown and the deadline lock current while the page stays open
const now=ref(Date.now());const tick=setInterval(()=>now.value=Date.now(),30_000);onUnmounted(()=>clearInterval(tick))
async function load(){
  loading.value=true;loadError.value=''
  try{data.value=await loadBreakfast(week.value)}
  catch(e:any){loadError.value=isNetworkError(e)?'Không có mạng. Cần có mạng để xem và chọn món.':(e?.message??'Không tải được dữ liệu ăn sáng')}
  finally{loading.value=false}
}
onMounted(async()=>{if(!state.profile)await refresh();await load()})
function say(msg:string){toast.value=msg;setTimeout(()=>{if(toast.value===msg)toast.value=''},3500)}
const errMsg=(e:any,fallback:string)=>isNetworkError(e)?'Mất mạng, thử lại khi có sóng nhé':(e?.message??fallback)

// ── Week ────────────────────────────────────────────────────────────────────
const maxWeek=addDays(upcoming,28)
function shiftWeek(d:number){const w=addDays(week.value,7*d);if(w>maxWeek)return;week.value=w;router.replace({query:w===upcoming?{}:{week:w}});load()}
const dm=(d:string)=>`${d.slice(8,10)}/${d.slice(5,7)}`
const weekTag=computed(()=>week.value===upcoming?(new Date(`${today}T12:00:00+07:00`).getDay()===0?'Chủ nhật tới':'Chủ nhật này'):week.value===today?'Hôm nay':week.value<today?'Đã qua':'Tuần sau nữa')
const status=computed(()=>data.value?.status?.status??'OPEN')
// A Sunday that has gone by is history: shown, not changed
const past=computed(()=>week.value<today)
const open=computed(()=>isOpen(week.value,now.value))
const branches=computed(()=>state.data?.branches??[])
const branchOf=(id:string)=>branches.value.find(b=>b.id===id)
const itemName=(id:string)=>data.value?.items.find(i=>i.id===id)?.name??'(món đã xoá)'
const ballotOf=(branchId:string)=>data.value?.ballots.find(b=>b.branchId===branchId)
const activeItems=computed(()=>data.value?.items.filter(i=>i.active)??[])
const tally=computed(()=>data.value?tallyBreakfast(data.value.items,data.value.ballots,data.value.lastServed):null)
const missing=computed(()=>branches.value.filter(b=>!ballotOf(b.id)))
const finalNames=computed(()=>(data.value?.status?.finalItemIds??[]).map(itemName))
const circled=(n:number)=>['①','②','③'][n-1]??String(n)

// ── Ballot: leaders edit their own branch; Ban điều hành picks which branch to fill in for ──
const ballotBranch=ref<string|null>(null)
const picks=ref<string[]>([]);const headcount=ref<number|''>('')
const saved=computed(()=>ballotBranch.value?ballotOf(ballotBranch.value):undefined)
function resetPicks(){
  picks.value=saved.value?[...saved.value.itemIds]:[]
  // A new ballot starts from the branch's last headcount
  headcount.value=saved.value?.headcount??(ballotBranch.value?data.value?.lastHeadcount[ballotBranch.value]:undefined)??''
}
watch([data,()=>state.profile],()=>{
  // Wait for the ballots, or every branch looks unchosen
  if(!state.profile||!data.value)return
  // Thư ký ngành only follows the result; its branch leader chooses
  if(!isSuper.value)ballotBranch.value=state.profile.role==='BRANCH_ADMIN'?state.profile.branchId:null
  else if(!ballotBranch.value)ballotBranch.value=missing.value[0]?.id??branches.value[0]?.id??null
  resetPicks()
},{immediate:true})
watch(ballotBranch,resetPicks)
const need=computed(()=>minPicks(activeItems.value.length))
const canEdit=computed(()=>!!ballotBranch.value&&status.value!=='SKIPPED'&&(isSuper.value||(open.value&&status.value!=='ORDERED')))
// Hidden dishes still in a saved ballot stay listed so they can be unticked
const choices=computed(()=>(data.value?.items??[]).filter(i=>i.active||picks.value.includes(i.id)))
const hc=computed(()=>headcount.value===''||headcount.value==null?null:Math.max(0,Math.round(Number(headcount.value))))
const dirty=computed(()=>picks.value.join()!==(saved.value?.itemIds??[]).join()||hc.value!==(saved.value?.headcount??null))
// Leaders give a headcount so Ban điều hành orders enough; Ban điều hành filling in may not know it
const valid=computed(()=>picks.value.length>=need.value&&picks.value.length<=MAX_PICKS&&(isSuper.value||hc.value!=null))
const saveHint=computed(()=>picks.value.length<need.value?`Chọn thêm ${need.value-picks.value.length} món`:!isSuper.value&&hc.value==null?'Nhập số người ăn':'')
function pick(id:string){
  if(!canEdit.value)return
  const i=picks.value.indexOf(id)
  if(i>=0){picks.value.splice(i,1);return}
  if(picks.value.length>=MAX_PICKS){say(`Tối đa ${MAX_PICKS} món. Bấm vào món đã chọn để bỏ bớt.`);return}
  picks.value.push(id)
}
const saving=ref(false)
async function save(){
  const b=ballotBranch.value;if(!b||!valid.value)return
  saving.value=true
  try{await saveBallot(week.value,b,picks.value,hc.value);await load();say(`✅ Đã lưu lựa chọn của ngành ${branchOf(b)?.name??''}`)}
  catch(e:any){say(errMsg(e,'Không lưu được'))}
  finally{saving.value=false}
}
async function clearBallot(){
  const b=ballotBranch.value;if(!b||!confirm(`Xoá lựa chọn của ngành ${branchOf(b)?.name??''}?`))return
  try{await saveBallot(week.value,b,[],null);await load();say('Đã xoá lựa chọn')}catch(e:any){say(errMsg(e,'Không xoá được'))}
}
const fmtTime=(iso:string)=>{const d=new Date(iso);return`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')} ${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`}

// ── Ban điều hành: chốt món / nghỉ / mở lại ─────────────────────────────────
const weekSheet=ref<{mode:'ORDERED'|'SKIPPED';ids:string[];note:string}|null>(null);const busy=ref(false)
function openOrder(){
  const cur=data.value?.status;const top=tally.value?.rows.find(r=>r.count)
  weekSheet.value=cur?.status==='ORDERED'
    ?{mode:'ORDERED',ids:[...cur.finalItemIds],note:cur.note??''}
    :{mode:'ORDERED',ids:top?[top.item.id]:[],note:tally.value?.headcount?`Tổng ${tally.value.headcount} suất.`:''}
}
function openSkip(){weekSheet.value={mode:'SKIPPED',ids:[],note:data.value?.status?.status==='SKIPPED'?data.value.status.note??'':''}}
function toggleFinal(id:string){const s=weekSheet.value!;const i=s.ids.indexOf(id);if(i>=0)s.ids.splice(i,1);else s.ids.push(id)}
// Dishes in tally order, so the most wanted are on top when choosing what to order
const orderChoices=computed(()=>tally.value?.rows.map(r=>r.item)??[])
async function submitWeek(){
  const s=weekSheet.value;if(!s||(s.mode==='ORDERED'&&!s.ids.length))return
  busy.value=true
  try{
    await setBreakfastWeek(week.value,s.mode,s.ids,s.note.trim()||null)
    weekSheet.value=null
    let sent:number|null=null
    try{sent=await notifyBreakfast(week.value)}catch(e:any){say(`Đã lưu nhưng chưa gửi được thông báo: ${errMsg(e,'lỗi')}`)}
    await load()
    if(sent!=null)say(s.mode==='ORDERED'?`✅ Đã chốt món${sent?` và báo cho ${sent} người`:''}`:`Đã báo nghỉ ăn sáng${sent?` cho ${sent} người`:''}`)
  }catch(e:any){say(errMsg(e,'Không lưu được'))}
  finally{busy.value=false}
}
async function reopen(){
  if(!confirm(status.value==='SKIPPED'?'Chủ nhật này có ăn sáng lại? Các ngành sẽ chọn món được (nếu còn hạn).':'Mở lại để các ngành sửa lựa chọn? Món đã chốt sẽ bị bỏ.'))return
  try{await setBreakfastWeek(week.value,'OPEN');await load();say('Đã mở lại')}catch(e:any){say(errMsg(e,'Không mở lại được'))}
}

// ── Ban điều hành: thực đơn ─────────────────────────────────────────────────
const menuEdit=ref<{id?:string;name:string;note:string}|null>(null);const menuError=ref('')
function addDish(){menuEdit.value={name:'',note:''};menuError.value=''}
function editDish(it:BreakfastItem){menuEdit.value={id:it.id,name:it.name,note:it.note??''};menuError.value=''}
async function submitDish(){
  const f=menuEdit.value;if(!f)return
  const name=f.name.trim();if(!name){menuError.value='Cần nhập tên món.';return}
  if(data.value?.items.some(i=>i.id!==f.id&&i.name.trim().toLowerCase()===name.toLowerCase())){menuError.value='Món này đã có trong thực đơn (có thể đang ẩn).';return}
  busy.value=true;menuError.value=''
  try{await saveMenuItem({id:f.id,name,note:f.note.trim()||null});menuEdit.value=null;await load()}
  catch(e:any){menuError.value=errMsg(e,'Không lưu được')}
  finally{busy.value=false}
}
async function toggleDish(it:BreakfastItem){
  if(it.active&&!confirm(`Ẩn "${it.name}" khỏi thực đơn? Các tuần trước vẫn giữ tên món. Có thể hiện lại sau.`))return
  try{await setMenuItemActive(it.id,!it.active);await load()}catch(e:any){say(errMsg(e,'Không đổi được'))}
}
const hiddenItems=computed(()=>data.value?.items.filter(i=>!i.active)??[])
</script>
<template><div class="page">
<div class="page-head"><div><div class="eyebrow">CHỦ NHẬT · {{BREAKFAST_TIME}}</div><h1>🍜 Ăn sáng</h1></div><button class="back" @click="router.back()">‹ Quay lại</button></div>

<div class="week-nav">
  <button class="icon-btn" aria-label="Tuần trước" @click="shiftWeek(-1)">‹</button>
  <div class="wk"><strong>Chủ nhật {{dm(week)}}/{{week.slice(0,4)}}</strong><small>{{weekTag}} · {{BREAKFAST_TIME}}</small></div>
  <button class="icon-btn" aria-label="Tuần sau" :disabled="addDays(week,7)>maxWeek" @click="shiftWeek(1)">›</button>
</div>

<p v-if="loading&&!data" class="subtle center">Đang tải…</p>
<p v-else-if="loadError" class="warning">{{loadError}} <button class="link" @click="load">Thử lại</button></p>
<template v-else-if="data">
  <!-- What is happening with this Sunday -->
  <div v-if="status==='SKIPPED'" class="state off"><b>😴 Chủ nhật này nghỉ ăn sáng</b><span v-if="data.status?.note">{{data.status.note}}</span></div>
  <div v-else-if="status==='ORDERED'" class="state done"><b>✅ Đã chốt: {{finalNames.join(', ')}}</b><span>Ăn sáng lúc {{BREAKFAST_TIME}} Chủ nhật {{dm(week)}}.<template v-if="data.status?.note"> {{data.status.note}}</template></span></div>
  <div v-else-if="!activeItems.length" class="state wait"><b>🍽️ Chưa có thực đơn</b><span>{{isSuper?'Thêm món ở mục Thực đơn bên dưới để các ngành chọn.':'Ban điều hành chưa lập thực đơn.'}}</span></div>
  <div v-else-if="past" class="state off"><b>📜 Chủ nhật đã qua</b><span>Tuần này không chốt món trên app.</span></div>
  <div v-else-if="open" class="state open"><b>⏳ Hạn chót: thứ 6 {{dm(deadlineDay(week))}}, 23:59</b><span>{{timeLeft(week,now)}} · đã chọn {{tally?.voters??0}}/{{branches.length}} ngành</span></div>
  <div v-else class="state wait"><b>🔒 Đã hết hạn chọn món</b><span>{{isSuper?'Xem kết quả bên dưới rồi bấm "Chốt món".':'Ban điều hành đang chốt món dựa trên kết quả.'}}</span></div>

  <!-- Ballot -->
  <section v-if="activeItems.length&&status!=='SKIPPED'&&ballotBranch&&!past" class="surface card">
    <h2 class="card-title">🗳️ {{isSuper?'Chọn hộ ngành':`Ngành ${branchOf(ballotBranch)?.name??''} chọn món`}}</h2>
    <div v-if="isSuper" class="br-pick"><button v-for="b in branches" :key="b.id" :class="{on:ballotBranch===b.id}" :style="{'--c':b.colorHex}" @click="ballotBranch=b.id"><i></i>{{b.name}}<span v-if="ballotOf(b.id)" class="tick">✓</span></button></div>
    <p class="hint">{{canEdit?`Bấm chọn ${need===MAX_PICKS?MAX_PICKS:`${need}–${MAX_PICKS}`} món theo thứ tự thích nhất: món bấm trước được ưu tiên hơn (① 3 điểm, ② 2, ③ 1).`:status==='ORDERED'?'Ban điều hành đã chốt món, không sửa được nữa.':'Đã qua hạn chót, không sửa được nữa. Cần đổi thì liên hệ Ban điều hành.'}}</p>
    <div class="dishes">
      <button v-for="it in choices" :key="it.id" class="dish" :class="{on:picks.includes(it.id),ro:!canEdit}" @click="pick(it.id)">
        <span class="rank">{{picks.includes(it.id)?picks.indexOf(it.id)+1:''}}</span>
        <span class="dn"><b>{{it.name}}<small v-if="!it.active"> (đã ẩn)</small></b><small v-if="it.note">{{it.note}}</small></span>
      </button>
    </div>
    <label class="hc">Số người ăn của ngành<input v-model="headcount" type="number" inputmode="numeric" min="0" max="500" placeholder="VD: 12" :disabled="!canEdit"/></label>
    <template v-if="canEdit">
      <button class="primary-btn save" :disabled="saving||!valid||!dirty" @click="save">{{saving?'Đang lưu…':saved?'💾 Lưu thay đổi':'💾 Lưu lựa chọn'}}</button>
      <p v-if="saveHint&&dirty" class="hint center">{{saveHint}}</p>
    </template>
    <p v-if="saved" class="meta">Đã lưu {{fmtTime(saved.updatedAt)}}<template v-if="saved.updatedBy"> bởi {{saved.updatedBy}}</template><template v-if="canEdit"> · <button class="link" @click="clearBallot">Xoá lựa chọn</button></template></p>
  </section>

  <!-- Results -->
  <section v-if="tally&&status!=='SKIPPED'&&(tally.voters||activeItems.length)" class="surface card">
    <h2 class="card-title">📊 Kết quả<small>{{tally.voters}}/{{branches.length}} ngành đã chọn<template v-if="tally.headcount"> · {{tally.headcount}} suất</template></small></h2>
    <p v-if="!tally.voters" class="subtle">Chưa ngành nào chọn món.</p>
    <div v-else class="results">
      <div v-for="(r,i) in tally.rows" :key="r.item.id" class="res" :class="{top:i===0&&r.count,zero:!r.count,final:data.status?.finalItemIds.includes(r.item.id)}">
        <span class="rk">{{r.count?i+1:'–'}}</span>
        <div class="res-main">
          <div class="res-line"><b>{{r.item.name}}<small v-if="!r.item.active"> (đã ẩn)</small><span v-if="status==='ORDERED'&&data.status?.finalItemIds.includes(r.item.id)" class="chip">Đã chốt</span></b><span class="pct">{{r.percent}}%</span></div>
          <div class="bar"><i :style="{width:`${r.percent}%`}"></i></div>
          <template v-if="r.count">
            <div class="res-meta">{{r.count}} ngành · {{r.points}} điểm<template v-if="r.tied"> · <span class="tie">hoà, xếp món lâu chưa ăn lên trước</span></template></div>
            <div class="who"><span v-for="p in r.picks" :key="p.branchId" :style="{'--c':branchOf(p.branchId)?.colorHex??'#94a3b8'}"><i></i>{{branchOf(p.branchId)?.name}} {{circled(p.rank)}}</span></div>
          </template>
        </div>
      </div>
    </div>
    <p v-if="missing.length&&tally.voters" class="miss">Chưa chọn: <b>{{missing.map(b=>b.name).join(', ')}}</b></p>
    <details class="how"><summary>Cách tính</summary><p><b>%</b> = số ngành chọn món ÷ số ngành đã chọn. Xếp theo % trước; nếu bằng nhau thì so <b>điểm ưu tiên</b> (① {{RANK_POINTS[0]}} điểm, ② {{RANK_POINTS[1]}}, ③ {{RANK_POINTS[2]}}); vẫn bằng thì món <b>lâu chưa ăn</b> nhất đứng trước.</p></details>
  </section>

  <!-- Every branch at a glance: what it picked and how many will eat -->
  <section v-if="activeItems.length&&status!=='SKIPPED'" class="surface card">
    <h2 class="card-title">👥 Từng ngành</h2>
    <div class="branches">
      <div v-for="b in branches" :key="b.id" class="br-row">
        <BranchBadge small :branch="b"/>
        <span v-if="ballotOf(b.id)" class="br-picks"><span v-for="(id,i) in ballotOf(b.id)!.itemIds" :key="id">{{circled(i+1)}} {{itemName(id)}}</span></span>
        <span v-else class="br-miss">Chưa chọn</span>
        <span v-if="ballotOf(b.id)?.headcount!=null" class="br-hc">{{ballotOf(b.id)!.headcount}} người</span>
      </div>
    </div>
  </section>

  <!-- Ban điều hành: decide the week -->
  <div v-if="isSuper&&!past" class="admin">
    <template v-if="status==='SKIPPED'"><button class="secondary-btn" @click="reopen">↩️ Có ăn sáng lại</button></template>
    <template v-else>
      <button v-if="activeItems.length" class="primary-btn order" @click="openOrder">{{status==='ORDERED'?'✏️ Sửa món đã chốt':'✅ Chốt món & báo mọi người'}}</button>
      <div class="admin-row">
        <button v-if="status==='ORDERED'" @click="reopen">↩️ Mở lại</button>
        <button @click="openSkip">😴 Tuần này nghỉ</button>
      </div>
      <p v-if="data.status?.notifiedAt&&status==='ORDERED'" class="hint center">Đã báo lúc {{fmtTime(data.status.notifiedAt)}}</p>
    </template>
  </div>

  <!-- Ban điều hành: the menu -->
  <details v-if="isSuper" class="surface card menu" :open="!activeItems.length">
    <summary><span>🍽️ Thực đơn <small>({{activeItems.length}} món)</small></span><b>›</b></summary>
    <div class="menu-list">
      <div v-for="it in activeItems" :key="it.id" class="m-row"><span class="dn"><b>{{it.name}}</b><small v-if="it.note">{{it.note}}</small></span><button @click="editDish(it)">✏️</button><button class="hide" @click="toggleDish(it)">Ẩn</button></div>
      <p v-if="!activeItems.length" class="subtle">Chưa có món nào.</p>
      <template v-if="hiddenItems.length"><div class="m-sub">Đã ẩn</div>
      <div v-for="it in hiddenItems" :key="it.id" class="m-row off"><span class="dn"><b>{{it.name}}</b></span><button @click="editDish(it)">✏️</button><button @click="toggleDish(it)">Hiện</button></div></template>
    </div>
    <button class="secondary-btn add" @click="addDish">＋ Thêm món</button>
    <p class="hint">Nên có từ 4–8 món. Món chỉ bị ẩn chứ không xoá, để lịch sử các tuần trước vẫn đúng.</p>
  </details>
</template>
<div v-if="toast" class="toast">{{toast}}</div>

<Teleport to="body"><div v-if="weekSheet" class="overlay sheet-overlay" @click.self="weekSheet=null"><section class="sheet">
  <div class="s-head"><strong>{{weekSheet.mode==='ORDERED'?`✅ Chốt món CN ${dm(week)}`:`😴 Nghỉ ăn sáng CN ${dm(week)}`}}</strong><button class="x" @click="weekSheet=null">✕</button></div>
  <div class="s-body">
    <template v-if="weekSheet.mode==='ORDERED'">
      <p class="hint">Chọn món sẽ đặt (thường là món đứng đầu; có thể chọn thêm món thứ hai).</p>
      <div class="dishes">
        <button v-for="it in orderChoices" :key="it.id" class="dish" :class="{on:weekSheet.ids.includes(it.id)}" @click="toggleFinal(it.id)">
          <span class="rank">{{weekSheet.ids.includes(it.id)?'✓':''}}</span>
          <span class="dn"><b>{{it.name}}</b><small>{{tally?.rows.find(r=>r.item.id===it.id)?.percent??0}}% · {{tally?.rows.find(r=>r.item.id===it.id)?.count??0}} ngành</small></span>
        </button>
      </div>
    </template>
    <label>{{weekSheet.mode==='ORDERED'?'Ghi chú cho mọi người':'Lý do'}} <small>(không bắt buộc)</small><textarea v-model="weekSheet.note" rows="3" :placeholder="weekSheet.mode==='ORDERED'?'Tổng 42 suất, ăn tại hội trường…':'Lễ, đi trại…'"></textarea></label>
    <p class="hint">Bấm lưu là gửi thông báo cho tất cả trưởng ngành.</p>
  </div>
  <div class="s-foot"><button class="primary-btn" :disabled="busy||(weekSheet.mode==='ORDERED'&&!weekSheet.ids.length)" @click="submitWeek">{{busy?'Đang lưu…':weekSheet.mode==='ORDERED'?'✅ Chốt & báo mọi người':'😴 Báo nghỉ'}}</button></div>
</section></div></Teleport>

<Teleport to="body"><div v-if="menuEdit" class="overlay sheet-overlay" @click.self="menuEdit=null"><section class="sheet">
  <div class="s-head"><strong>{{menuEdit.id?'✏️ Sửa món':'🍽️ Thêm món'}}</strong><button class="x" @click="menuEdit=null">✕</button></div>
  <div class="s-body">
    <label>Tên món<input v-model="menuEdit.name" placeholder="Phở bò" maxlength="60"/></label>
    <label>Ghi chú <small>(không bắt buộc)</small><input v-model="menuEdit.note" placeholder="Quán cô Ba, 35k/tô" maxlength="120"/></label>
    <p v-if="menuError" class="err">{{menuError}}</p>
  </div>
  <div class="s-foot"><button class="primary-btn" :disabled="busy" @click="submitDish">{{busy?'Đang lưu…':'💾 Lưu'}}</button></div>
</section></div></Teleport>
</div></template>
<style scoped>
.back{border:0;background:#fff;border-radius:12px;padding:9px 11px;font-weight:800;color:#475569;box-shadow:0 4px 14px rgba(15,23,42,.06)}
.center{text-align:center}.link{border:0;background:none;color:#1d4ed8;font-weight:800;text-decoration:underline;padding:0;font-size:inherit}
.week-nav{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:10px;margin-bottom:12px}.week-nav .icon-btn{font-size:1.2rem}.week-nav .icon-btn:disabled{opacity:.35}
.wk{text-align:center;display:grid;gap:1px;min-width:0}.wk strong{font-size:1rem}.wk small{color:#64748b;font-weight:700;font-size:.76rem}
.state{display:grid;gap:3px;border-radius:15px;padding:11px 13px;margin-bottom:12px;font-size:.84rem;line-height:1.4;border:1px solid}.state b{font-size:.92rem}
.state.open{background:#eff6ff;border-color:#bfdbfe;color:#1e3a8a}.state.done{background:#ecfdf5;border-color:#a7f3d0;color:#065f46}.state.wait{background:#fff7ed;border-color:#fed7aa;color:#9a3412}.state.off{background:#f1f5f9;border-color:#e2e8f0;color:#475569}
.card{padding:13px;margin-bottom:12px}.card-title{margin:0 0 8px!important;font-size:1rem!important;display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:2px 8px}.card-title small{font-size:.76rem;color:#64748b;font-weight:700}
.hint{margin:0 0 8px;font-size:.76rem;color:#64748b;line-height:1.45}
.br-pick{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px}.br-pick button{display:inline-flex;align-items:center;gap:5px;border:1px solid #e2e8f0;background:#fff;border-radius:999px;padding:6px 10px;font-weight:800;font-size:.8rem;color:#334155}.br-pick i{width:8px;height:8px;border-radius:50%;background:var(--c)}.br-pick button.on{border-color:var(--c);background:color-mix(in srgb,var(--c) 16%,white)}.tick{color:#16a34a;font-weight:900}
.dishes{display:grid;gap:7px}
.dish{display:flex;align-items:center;gap:10px;width:100%;border:1.5px solid #e2e8f0;background:#fff;border-radius:13px;padding:10px 11px;text-align:left;color:#0f172a;min-height:48px}
.dish.on{border-color:#1d4ed8;background:#eff6ff}.dish.ro{cursor:default}.dish.ro:not(.on){opacity:.6}
.rank{flex:none;width:28px;height:28px;border-radius:50%;border:2px solid #cbd5e1;display:grid;place-items:center;font-size:.9rem;font-weight:900;color:#fff;line-height:1}
.dish.on .rank{background:#1d4ed8;border-color:#1d4ed8}
.dn{display:grid;min-width:0;flex:1}.dn b{font-size:.92rem;overflow-wrap:anywhere}.dn small{font-size:.74rem;color:#64748b;font-weight:600}.dn b small{color:#b45309}
.hc{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:10px;font-size:.84rem;font-weight:800;color:#475569}
.hc input{width:96px;flex:none;border:1px solid #dbe3ee;border-radius:12px;padding:9px 10px;font-size:16px;text-align:center;font-weight:800;color:#0f172a;background:#fff}.hc input:disabled{background:#f8fafc;color:#64748b}
.save{width:100%;margin-top:12px;padding:12px}.save:disabled{opacity:.55}
.save+.hint{margin-top:6px}
.meta{margin:8px 0 0;font-size:.74rem;color:#64748b;text-align:center}
.results{display:grid;gap:10px}
.res{display:grid;grid-template-columns:22px 1fr;gap:8px;align-items:start}
.rk{width:22px;height:22px;border-radius:50%;background:#f1f5f9;color:#475569;display:grid;place-items:center;font-size:.72rem;font-weight:900;margin-top:1px}
.res.top .rk{background:#f59e0b;color:#fff}
.res-main{min-width:0;display:grid;gap:4px}
.res-line{display:flex;justify-content:space-between;align-items:baseline;gap:8px}.res-line b{font-size:.9rem;min-width:0;overflow-wrap:anywhere}.res-line b small{color:#b45309;font-weight:700}
.pct{flex:none;font-weight:900;font-size:.95rem;color:#1d4ed8}.res.zero .pct,.res.zero b{color:#94a3b8}
.chip{display:inline-block;margin-left:6px;background:#16a34a;color:#fff;border-radius:999px;padding:1px 7px;font-size:.66rem;font-weight:900;vertical-align:middle}
.bar{height:8px;border-radius:999px;background:#eef2f7;overflow:hidden}.bar i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#60a5fa,#1d4ed8)}
.res.top .bar i{background:linear-gradient(90deg,#fbbf24,#f59e0b)}
.res-meta{font-size:.74rem;color:#64748b;font-weight:700}.tie{color:#b45309}
.who{display:flex;flex-wrap:wrap;gap:4px}.who span{display:inline-flex;align-items:center;gap:4px;background:color-mix(in srgb,var(--c) 13%,white);border-radius:999px;padding:2px 7px;font-size:.7rem;font-weight:800;color:#334155}.who i{width:6px;height:6px;border-radius:50%;background:var(--c)}
.miss{margin:10px 0 0;font-size:.8rem;color:#b45309}
.how{margin-top:10px;font-size:.76rem;color:#64748b}.how summary{cursor:pointer;font-weight:800;color:#475569}.how p{margin:6px 0 0;line-height:1.5}
.branches{display:grid;gap:8px}
.br-row{display:flex;flex-wrap:wrap;align-items:center;gap:4px 8px;font-size:.8rem;padding-bottom:8px;border-bottom:1px solid #f1f5f9}.br-row:last-child{border-bottom:0;padding-bottom:0}
.br-picks{flex:1;min-width:0;display:flex;flex-wrap:wrap;gap:1px 10px;color:#334155;font-weight:600}.br-miss{flex:1;color:#b45309;font-weight:700}
.br-hc{flex:none;margin-left:auto;background:#f1f5f9;border-radius:999px;padding:2px 8px;font-weight:800;color:#475569;font-size:.74rem}
.admin{display:grid;gap:8px;margin-bottom:12px}.admin .order{padding:13px;background:#16a34a}.admin .secondary-btn{padding:12px}
.admin-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px}.admin-row button{border:1px solid #e2e8f0;background:#fff;border-radius:12px;padding:10px;font-weight:800;color:#475569}
.menu{padding:0}.menu summary{list-style:none;display:flex;justify-content:space-between;align-items:center;padding:13px;font-weight:800;cursor:pointer}.menu summary::-webkit-details-marker{display:none}.menu summary small{color:#64748b;font-weight:700}.menu summary b{color:#94a3b8;transition:transform .2s}.menu[open] summary b{transform:rotate(90deg)}
.menu-list{display:grid;gap:6px;padding:0 13px}.menu .add{margin:10px 13px 8px;width:calc(100% - 26px)}.menu>.hint{padding:0 13px 12px;margin:0}
.m-row{display:flex;align-items:center;gap:6px;border:1px solid #eef2f7;border-radius:12px;padding:8px 8px 8px 11px}.m-row.off{opacity:.6}
.m-row button{flex:none;border:0;background:#f1f5f9;border-radius:10px;min-width:38px;height:36px;padding:0 9px;font-weight:800;color:#475569;font-size:.8rem}.m-row .hide{color:#b91c1c;background:#fef2f2}
.m-sub{font-size:.74rem;font-weight:900;color:#94a3b8;margin-top:6px}
.toast{position:fixed;left:12px;right:12px;bottom:calc(var(--nav-h) + 12px);background:#0f172a;color:#fff;border-radius:14px;padding:12px 14px;font-size:.84rem;font-weight:700;z-index:60;box-shadow:0 10px 30px rgba(15,23,42,.3);max-width:560px;margin:0 auto}
.sheet{width:100%;max-width:560px;max-height:100%;background:#fff;border-radius:22px 22px 0 0;display:flex;flex-direction:column;overflow:hidden}
.s-head{flex:none;display:flex;justify-content:space-between;align-items:center;gap:8px;padding:14px 14px 4px}.x{flex:none;border:0;background:#f1f5f9;width:34px;height:34px;border-radius:50%}
.s-body{flex:1;min-height:0;overflow-y:auto;padding:8px 14px;display:grid;gap:12px;align-content:start}
.s-body label{display:grid;gap:6px;font-size:.82rem;font-weight:800;color:#475569}.s-body label small{font-weight:600;color:#94a3b8}
.s-body input,.s-body textarea{width:100%;min-width:0;border:1px solid #dbe3ee;border-radius:12px;padding:10px 12px;font-size:16px;background:#fff;color:#0f172a;font-weight:500;-webkit-appearance:none;appearance:none}.s-body textarea{resize:vertical}

.err{margin:0;color:#b91c1c;font-weight:700;font-size:.82rem}
.s-foot{flex:none;padding:10px 14px calc(12px + env(safe-area-inset-bottom));border-top:1px solid #eef2f7}.s-foot .primary-btn{width:100%;padding:13px}.s-foot .primary-btn:disabled{opacity:.55}
</style>

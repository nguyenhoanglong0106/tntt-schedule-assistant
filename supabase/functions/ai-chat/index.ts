import { corsHeaders, json } from '../_shared/cors.ts'
import { userClient } from '../_shared/clients.ts'

function extractText(response:any):string{
  for(const cand of response.candidates??[])for(const p of cand.content?.parts??[])if(typeof p.text==='string')return p.text
  return ''
}
function stripJson(text:string){return text.trim().replace(/^```json\s*/i,'').replace(/```$/,'').trim()}
function decodeUserId(req:Request):string|null{
  try{
    const token=(req.headers.get('Authorization')??'').replace(/^Bearer\s+/i,'')
    const payload=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')))
    return typeof payload.sub==='string'?payload.sub:null
  }catch{return null}
}

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders})
  try{
    const db=userClient(req);const uid=decodeUserId(req)
    if(!uid)throw new Error('UNAUTHORIZED')
    const body=await req.json();const message=String(body.message??'').trim();const weekStart=String(body.week_start??'')
    // Recent turns so follow-ups like "đổi sang T4" resolve; Gemini needs the first turn to be the user's
    const history=(Array.isArray(body.history)?body.history:[]).slice(-10).map((h:any)=>({role:h?.from==='user'?'user':'model',parts:[{text:String(h?.text??'').slice(0,1500)}]})).filter((h:any)=>h.parts[0].text)
    while(history.length&&history[0].role!=='user')history.shift()
    const historyFrom=new Date(new Date(`${weekStart}T00:00:00+07:00`).getTime()-60*86400000).toISOString().slice(0,10)
    if(!message)return json({kind:'clarify',text:'Vui lòng nhập nội dung cần hỏi hoặc phân công.'},400)
    // auth verification runs alongside the context queries instead of blocking them first, since RLS already scopes every query to the caller's verified JWT
    const [authR,profileR,branchesR,tasksR,membersR,classesR,schedulesR,rotationR,timesR,pastR]=await Promise.all([
      db.auth.getUser(),
      db.from('profiles').select('id,full_name,role,branch_id').eq('id',uid).single(),
      db.from('branches').select('id,code,name,color_hex,rotation_index').order('rotation_index'),
      db.from('task_types').select('id,code,name').eq('active',true),
      db.from('members').select('id,branch_id,full_name').eq('active',true),
      db.from('classes').select('id,branch_id,name').eq('active',true),
      db.from('schedules').select('id,task_type_id,branch_id,scheduled_date,start_time,status,task_types(code,name),assignment_assignees(assignee_type,member_id,class_id,members(full_name),classes(name))').gte('scheduled_date',weekStart).lte('scheduled_date',new Date(new Date(`${weekStart}T00:00:00+07:00`).getTime()+20*86400000).toISOString().slice(0,10)),
      db.from('reading_rotation_config').select('start_date,start_branch_id').eq('singleton_key',1).maybeSingle(),
      db.from('task_type_branch_times').select('task_type_id,branch_id,start_time,fixed_day_of_week'),
      db.from('schedules').select('scheduled_date,status,task_types(code),assignment_assignees(member_id)').gte('scheduled_date',historyFrom).lt('scheduled_date',weekStart),
    ])
    if(authR.error||!authR.data.user)throw new Error('UNAUTHORIZED')
    const user=authR.data.user
    if(profileR.error)throw profileR.error
    // Per member & task: times assigned in the 60 days before this week (a member not listed = 0 lần)
    const counts=new Map<string,{member_id:string;task:string;count:number;last_date:string}>()
    for(const sc of (pastR.data??[]) as any[]){
      if(sc.status==='CANCELLED')continue
      for(const a of sc.assignment_assignees??[]){
        if(!a.member_id)continue
        const k=`${a.member_id}|${sc.task_types?.code}`
        const c=counts.get(k)??{member_id:a.member_id,task:sc.task_types?.code,count:0,last_date:''}
        c.count++;if(sc.scheduled_date>c.last_date)c.last_date=sc.scheduled_date
        counts.set(k,c)
      }
    }
    const context={profile:profileR.data,branches:branchesR.data??[],task_types:tasksR.data??[],members:membersR.data??[],classes:classesR.data??[],schedules:schedulesR.data??[],reading_rotation:rotationR.data,branch_default_times:timesR.data??[],assignment_history_60d:[...counts.values()],week_start:weekStart,today:new Date(Date.now()+7*3600000).toISOString().slice(0,10),timezone:'Asia/Ho_Chi_Minh'}
    // Attendance/diligence and meetings as the app computes them (same figures as its KPI screen); capped so an oversized body cannot blow up the prompt
    if(body.insights&&typeof body.insights==='object'&&JSON.stringify(body.insights).length<120_000)(context as any).insights=body.insights
    const instructions=`Bạn là trợ lý phân công TNTT. Chỉ dùng dữ liệu CONTEXT, không bịa. Hiểu tiếng Việt tự nhiên.\n
QUYỀN: SUPER_ADMIN sửa mọi ngành. BRANCH_ADMIN được đọc toàn bộ nhưng chỉ tạo/sửa/xóa lịch branch_id của mình. BRANCH_SECRETARY (thư ký ngành, tài khoản dùng chung cho thành viên) CHỈ XEM: không bao giờ trả kind=action, được nhờ thay đổi thì trả answer bảo nhờ trưởng ngành; mặc định nói về ngành branch_id của mình như BRANCH_ADMIN.\n
ĐỌC SÁCH: lịch rotation xác định Ngành theo tuần; nếu tạo/sửa READING phải dùng đúng Ngành của tuần.\n
AN TOÀN: KHÔNG được tự ghi DB. Nếu user yêu cầu thay đổi, trả kind=action để hệ thống tạo preview chờ xác nhận. Nếu tên người/lớp mơ hồ hoặc thiếu dữ kiện quan trọng, trả kind=clarify.\n
Chỉ trả JSON hợp lệ, không markdown. Một trong 3 dạng:\n
{"kind":"answer","text":"..."}\n
{"kind":"clarify","text":"..."}\n
{"kind":"share","text":"..."}  (tin nhắn để người dùng sao chép gửi nhóm Zalo/Messenger)\n
{"kind":"action","intent":"...","preview_title":"...","preview_lines":["..."],"operations":[...]}\n
Operation được phép:\n
CREATE_SCHEDULE: {"op":"CREATE_SCHEDULE","task_type_id":"uuid","branch_id":"uuid","date":"YYYY-MM-DD","start_time":"HH:MM hoặc rỗng","assignees":[{"type":"MEMBER|CLASS","id":"uuid"}],"reminders":[180]}\n
UPDATE_SCHEDULE: giống CREATE nhưng thêm schedule_id và phải gửi trạng thái đích đầy đủ.\n
DELETE_SCHEDULE: {"op":"DELETE_SCHEDULE","schedule_id":"uuid"}\n
UPDATE_READING_ROTATION chỉ SUPER_ADMIN: {"op":"UPDATE_READING_ROTATION","start_date":"YYYY-MM-DD","start_branch_id":"uuid"}.\n
Khi user hỏi lịch, trả answer từ schedules/context. Khi thay đổi nhiều mục, gom vào một action để user xác nhận một lần.\n
HỘI THOẠI: các lượt trước là lịch sử; dùng để hiểu câu nối tiếp (vd "đổi sang T4", "thêm Đức nữa", "xóa cái đó") và tham chiếu đúng lịch vừa nói tới trong schedules.\n
GIỜ: lịch có start_time rỗng thì giờ thực tế lấy từ branch_default_times (khớp task_type_id + branch_id). Khi trả lời luôn dùng giờ thực tế, dạng 24h HH:MM. Khi tạo lịch mà user không nói giờ thì để start_time rỗng.\n
SOẠN TIN: khi user muốn soạn/tạo tin nhắn hoặc thông báo để gửi nhóm, trả kind=share. Văn bản thuần (không markdown, không **), gọn, có emoji; nhóm theo ngày dạng "Thứ 2 (28/09)"; mỗi dòng: giờ – công việc – người (không có người thì ghi "cả ngành"). BRANCH_ADMIN mặc định chỉ lấy lịch ngành mình trừ khi user nói khác. Không bịa lịch; không có lịch thì trả answer nói rõ.\n
CÔNG BẰNG: khi user nhờ xếp/gợi ý người mà không nêu tên, chọn members của đúng ngành có số lần ít nhất trong assignment_history_60d cho công việc đó (không có trong danh sách = 0 lần); hòa thì ưu tiên last_date cũ nhất; không xếp một người 2 lần trong cùng tuần nếu còn người khác. Ghi lý do trong preview_lines, vd "Hoàng – 0 lần trong 60 ngày".

ĐIỂM DANH & SIÊNG NĂNG: dùng CONTEXT.insights (attendance_this_month, attendance_school_year, last_month_report, unmarked_sessions; cách tính ở insights.scoring) để trả lời ai siêng năng, ai vắng nhiều, tỷ lệ chuyên cần, buổi nào chưa điểm danh. Nêu số liệu cụ thể (vd "vắng 3 buổi, chuyên cần 62%"). Nói về người vắng nhiều thì nhẹ nhàng, gợi ý hỏi han quan tâm chứ không phê bình. BRANCH_ADMIN mặc định nói về ngành mình trừ khi user hỏi khác. Không có insights thì nói chưa có dữ liệu điểm danh. Tin khen/tổng kết để gửi nhóm thì trả kind=share.

HỌP THÁNG: CONTEXT.insights.meetings là các buổi họp gần nhất (ghi chú, summary.points, summary.actions gồm task/owner/due, tên file). Trả lời nội dung họp, việc cần làm, ai phụ trách, hạn chót; có thể soạn tin nhắc việc sau họp (kind=share). Không bịa nội dung không có trong đó.

ĂN SÁNG: CONTEXT.insights.breakfast là bữa ăn sáng chung Chủ nhật tới lúc 08:00 (sunday, deadline = thứ 6 23:59, choosing_open, status OPEN/ORDERED/SKIPPED, ordered_dishes khi đã chốt, results xếp theo percent = số ngành chọn ÷ số ngành đã chọn rồi points (ưu tiên 1 = 3 điểm, 2 = 2, 3 = 1), not_chosen, headcount_total/headcount_by_branch = số suất). Trả lời CN này ăn gì, món nào đang dẫn, ngành nào chưa chọn, tổng bao nhiêu suất; có thể soạn tin nhắc các ngành chọn món hoặc báo món đã chốt (kind=share). status=SKIPPED nghĩa là tuần đó nghỉ ăn sáng.

CHỈ ĐỌC: không có operation sửa điểm danh, họp hay chọn món ăn sáng; nếu user muốn sửa, hướng dẫn vào trang Điểm danh, Họp tháng hoặc Cá nhân → 🍜 Ăn sáng Chủ nhật.`
    const apiKey=Deno.env.get('GEMINI_API_KEY')
    if(!apiKey)return json({kind:'clarify',text:'AI chưa được cấu hình. Vui lòng liên hệ admin để thiết lập GEMINI_API_KEY.'})
    // Google retires/restricts model ids over time, so fall back to the next model on 404 or persistent overload.
    // Each model has its own quota, and the -latest aliases keep working when a pinned id is retired.
    const models=[...new Set([Deno.env.get('GEMINI_MODEL')?.trim(),'gemini-3.5-flash-lite','gemini-3.1-flash-lite','gemini-flash-lite-latest','gemini-flash-latest'].filter(Boolean) as string[])]
    const payload=JSON.stringify({
      systemInstruction:{parts:[{text:instructions}]},
      contents:[...history,{role:'user',parts:[{text:`CONTEXT:\n${JSON.stringify(context)}\n\nUSER:\n${message}`}]}],
      generationConfig:{responseMimeType:'application/json'}
    })
    const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms))
    // Exponential backoff with jitter; honour Retry-After when Google sends one
    const backoff=(attempt:number,res?:Response)=>{const ra=Number(res?.headers.get('retry-after'));return Number.isFinite(ra)&&ra>0?Math.min(ra*1000,4000):800*2**(attempt-1)+Math.random()*400}
    const deadline=Date.now()+30_000
    let aiResponse:Response|undefined
    let lastStatus=0
    outer:for(const model of models){
      for(let attempt=1;attempt<=3&&Date.now()<deadline;attempt++){
        let res:Response
        try{
          res=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,{
            method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':apiKey},body:payload
          })
        }catch{lastStatus=0;await sleep(backoff(attempt));continue}
        if(res.ok){aiResponse=res;break outer}
        lastStatus=res.status
        console.error(`[ai-chat] ${model} -> ${lastStatus}`,(await res.text()).slice(0,300))
        if(lastStatus===404)continue outer
        // 429 = this model's quota is used up, so retrying it is pointless; another model has its own quota
        if(lastStatus===429)continue outer
        if(lastStatus!==503&&lastStatus!==500)break outer
        if(attempt<3)await sleep(backoff(attempt,res))
      }
    }
    if(!aiResponse){
      const hint=lastStatus===0?'Lỗi kết nối AI.':lastStatus===503||lastStatus===500||lastStatus===429?'AI đang quá tải.':`AI API lỗi (${lastStatus}).`
      return json({kind:'clarify',text:`${hint} Bấm "Thử lại" sau ít giây nhé.`,retry:true})
    }
    const raw=await aiResponse.json()
    const text=extractText(raw)
    if(!text)return json({kind:'clarify',text:'AI không trả lời được. Hãy nói rõ hơn.'})
    let parsed
    try{parsed=JSON.parse(stripJson(text))}catch{return json({kind:'clarify',text:'AI trả về định dạng không hợp lệ. Vui lòng thử lại.'})}
    if(parsed.kind==='answer'||parsed.kind==='clarify'||parsed.kind==='share')return json({kind:parsed.kind,text:String(parsed.text??'')})
    // Thư ký ngành is read-only; the database refuses its changes anyway, so never show it a confirm button
    if(profileR.data?.role==='BRANCH_SECRETARY')return json({kind:'answer',text:'Tài khoản thư ký ngành chỉ xem được lịch, không thay đổi được. Hãy nhờ trưởng ngành nhé.'})
    if(parsed.kind!=='action'||!Array.isArray(parsed.operations)||!parsed.operations.length)return json({kind:'clarify',text:'Tôi chưa tạo được thao tác an toàn. Vui lòng nói rõ hơn.'})
    const profile=profileR.data;const branchIds=new Set((branchesR.data??[]).map((x:any)=>x.id));const taskIds=new Set((tasksR.data??[]).map((x:any)=>x.id));const memberMap=new Map((membersR.data??[]).map((x:any)=>[x.id,x]));const classMap=new Map((classesR.data??[]).map((x:any)=>[x.id,x]));
    for(const op of parsed.operations){
      if(op.op==='CREATE_SCHEDULE'||op.op==='UPDATE_SCHEDULE'){
        if(!branchIds.has(op.branch_id)||!taskIds.has(op.task_type_id))throw new Error('AI returned invalid branch/task')
        if(profile.role==='BRANCH_ADMIN'&&op.branch_id!==profile.branch_id)return json({kind:'answer',text:'Bạn có thể xem lịch Ngành khác nhưng chỉ được chỉnh sửa dữ liệu của Ngành mình.'})
        for(const a of op.assignees??[]){const entity:any=a.type==='MEMBER'?memberMap.get(a.id):classMap.get(a.id);if(!entity||entity.branch_id!==op.branch_id)throw new Error('AI returned invalid assignee')}
      }
      if(!['CREATE_SCHEDULE','UPDATE_SCHEDULE','DELETE_SCHEDULE','UPDATE_READING_ROTATION'].includes(op.op))return json({kind:'clarify',text:'Tôi chưa hỗ trợ thao tác này.'})
      if(op.op==='UPDATE_READING_ROTATION'&&profile.role!=='SUPER_ADMIN')return json({kind:'answer',text:'Chỉ Super Admin được thay đổi vòng đọc sách.'})
    }
    const id=crypto.randomUUID();const{error}=await db.from('ai_pending_actions').insert({id,user_id:user.id,intent:String(parsed.intent||'AI_ACTION'),payload:{operations:parsed.operations},preview_data:{title:String(parsed.preview_title||'Xác nhận thay đổi'),lines:Array.isArray(parsed.preview_lines)?parsed.preview_lines:[]},status:'PENDING',expires_at:new Date(Date.now()+15*60_000).toISOString()});if(error)throw error
    return json({kind:'pending',action:{id,intent:String(parsed.intent||'AI_ACTION'),payload:{operations:parsed.operations},previewTitle:String(parsed.preview_title||'Xác nhận thay đổi'),previewLines:Array.isArray(parsed.preview_lines)?parsed.preview_lines:[],status:'PENDING'}})
  }catch(e:any){const status=e?.message==='UNAUTHORIZED'?401:500;return json({error:e?.message??'Unknown error'},status)}
})

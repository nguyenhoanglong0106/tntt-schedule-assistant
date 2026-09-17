import { corsHeaders, json } from '../_shared/cors.ts'
import { requireUser } from '../_shared/clients.ts'

function extractText(response:any):string{
  for(const cand of response.candidates??[])for(const p of cand.content?.parts??[])if(typeof p.text==='string')return p.text
  return ''
}
function stripJson(text:string){return text.trim().replace(/^```json\s*/i,'').replace(/```$/,'').trim()}

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders})
  try{
    const{db,user}=await requireUser(req);const body=await req.json();const message=String(body.message??'').trim();const weekStart=String(body.week_start??'')
    if(!message)return json({kind:'clarify',text:'Vui lòng nhập nội dung cần hỏi hoặc phân công.'},400)
    const [profileR,branchesR,tasksR,membersR,classesR,schedulesR,rotationR]=await Promise.all([
      db.from('profiles').select('id,full_name,role,branch_id').eq('id',user.id).single(),
      db.from('branches').select('id,code,name,color_hex,rotation_index').order('rotation_index'),
      db.from('task_types').select('id,code,name').eq('active',true),
      db.from('members').select('id,branch_id,full_name').eq('active',true),
      db.from('classes').select('id,branch_id,name').eq('active',true),
      db.from('schedules').select('id,task_type_id,branch_id,scheduled_date,start_time,end_time,status,task_types(code,name),assignment_assignees(assignee_type,member_id,class_id,members(full_name),classes(name))').gte('scheduled_date',weekStart).lte('scheduled_date',new Date(new Date(`${weekStart}T00:00:00+07:00`).getTime()+20*86400000).toISOString().slice(0,10)),
      db.from('reading_rotation_config').select('start_date,start_branch_id').eq('singleton_key',1).maybeSingle(),
    ])
    if(profileR.error)throw profileR.error
    const context={profile:profileR.data,branches:branchesR.data??[],task_types:tasksR.data??[],members:membersR.data??[],classes:classesR.data??[],schedules:schedulesR.data??[],reading_rotation:rotationR.data,week_start:weekStart,timezone:'Asia/Ho_Chi_Minh'}
    const instructions=`Bạn là trợ lý phân công TNTT. Chỉ dùng dữ liệu CONTEXT, không bịa. Hiểu tiếng Việt tự nhiên.\n
QUYỀN: SUPER_ADMIN sửa mọi ngành. BRANCH_ADMIN được đọc toàn bộ nhưng chỉ tạo/sửa/xóa lịch branch_id của mình.\n
ĐỌC SÁCH: lịch rotation xác định Ngành theo tuần; nếu tạo/sửa READING phải dùng đúng Ngành của tuần.\n
AN TOÀN: KHÔNG được tự ghi DB. Nếu user yêu cầu thay đổi, trả kind=action để hệ thống tạo preview chờ xác nhận. Nếu tên người/lớp mơ hồ hoặc thiếu dữ kiện quan trọng, trả kind=clarify.\n
Chỉ trả JSON hợp lệ, không markdown. Một trong 3 dạng:\n
{"kind":"answer","text":"..."}\n
{"kind":"clarify","text":"..."}\n
{"kind":"action","intent":"...","preview_title":"...","preview_lines":["..."],"operations":[...]}\n
Operation được phép:\n
CREATE_SCHEDULE: {"op":"CREATE_SCHEDULE","task_type_id":"uuid","branch_id":"uuid","date":"YYYY-MM-DD","start_time":"HH:MM hoặc rỗng","end_time":"HH:MM hoặc rỗng","assignees":[{"type":"MEMBER|CLASS","id":"uuid"}],"reminders":[180]}\n
UPDATE_SCHEDULE: giống CREATE nhưng thêm schedule_id và phải gửi trạng thái đích đầy đủ.\n
DELETE_SCHEDULE: {"op":"DELETE_SCHEDULE","schedule_id":"uuid"}\n
MARK_COMPLETED: {"op":"MARK_COMPLETED","schedule_id":"uuid"}\n
UPDATE_READING_ROTATION chỉ SUPER_ADMIN: {"op":"UPDATE_READING_ROTATION","start_date":"YYYY-MM-DD","start_branch_id":"uuid"}.\n
Khi user hỏi lịch, trả answer từ schedules/context. Khi thay đổi nhiều mục, gom vào một action để user xác nhận một lần.`
    const apiKey=Deno.env.get('GEMINI_API_KEY');if(!apiKey)return json({kind:'clarify',text:'AI chưa được cấu hình. Vui lòng liên hệ admin để thiết lập GEMINI_API_KEY.'})
    const model=Deno.env.get('GEMINI_MODEL')||'gemini-2.5-flash'
    let ai;try{ai=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({systemInstruction:{parts:[{text:instructions}]},contents:[{role:'user',parts:[{text:`CONTEXT:\n${JSON.stringify(context)}\n\nUSER:\n${message}`}]}],generationConfig:{responseMimeType:'application/json'}})}})catch(e:any){return json({kind:'clarify',text:'Lỗi kết nối AI. Vui lòng thử lại sau.'})}
    if(!ai.ok){const errBody=await ai.text();return json({kind:'clarify',text:`AI API lỗi (${ai.status}). Vui lòng thử lại sau.`})}
    const raw=await ai.json();const text=extractText(raw);if(!text)return json({kind:'clarify',text:'AI không trả lời được. Hãy nói rõ hơn.'})
    let parsed;try{parsed=JSON.parse(stripJson(text))}catch{return json({kind:'clarify',text:'AI trả về định dạng không hợp lệ. Vui lòng thử lại.'})
    }
    if(parsed.kind==='answer'||parsed.kind==='clarify')return json(parsed)
    if(parsed.kind!=='action'||!Array.isArray(parsed.operations)||!parsed.operations.length)return json({kind:'clarify',text:'Tôi chưa tạo được thao tác an toàn. Vui lòng nói rõ hơn.'})
    const profile=profileR.data;const branchIds=new Set((branchesR.data??[]).map((x:any)=>x.id));const taskIds=new Set((tasksR.data??[]).map((x:any)=>x.id));const memberMap=new Map((membersR.data??[]).map((x:any)=>[x.id,x]));const classMap=new Map((classesR.data??[]).map((x:any)=>[x.id,x]));
    for(const op of parsed.operations){
      if(op.op==='CREATE_SCHEDULE'||op.op==='UPDATE_SCHEDULE'){
        if(!branchIds.has(op.branch_id)||!taskIds.has(op.task_type_id))throw new Error('AI returned invalid branch/task')
        if(profile.role==='BRANCH_ADMIN'&&op.branch_id!==profile.branch_id)return json({kind:'answer',text:'Bạn có thể xem lịch Ngành khác nhưng chỉ được chỉnh sửa dữ liệu của Ngành mình.'})
        for(const a of op.assignees??[]){const entity:any=a.type==='MEMBER'?memberMap.get(a.id):classMap.get(a.id);if(!entity||entity.branch_id!==op.branch_id)throw new Error('AI returned invalid assignee')}
      }
      if(op.op==='UPDATE_READING_ROTATION'&&profile.role!=='SUPER_ADMIN')return json({kind:'answer',text:'Chỉ Super Admin được thay đổi vòng đọc sách.'})
    }
    const id=crypto.randomUUID();const{error}=await db.from('ai_pending_actions').insert({id,user_id:user.id,intent:String(parsed.intent||'AI_ACTION'),payload:{operations:parsed.operations},preview_data:{title:String(parsed.preview_title||'Xác nhận thay đổi'),lines:Array.isArray(parsed.preview_lines)?parsed.preview_lines:[]},status:'PENDING',expires_at:new Date(Date.now()+15*60_000).toISOString()});if(error)throw error
    return json({kind:'pending',action:{id,intent:String(parsed.intent||'AI_ACTION'),payload:{operations:parsed.operations},previewTitle:String(parsed.preview_title||'Xác nhận thay đổi'),previewLines:Array.isArray(parsed.preview_lines)?parsed.preview_lines:[],status:'PENDING'}})
  }catch(e:any){const status=e?.message==='UNAUTHORIZED'?401:500;return json({error:e?.message??'Unknown error'},status)}
})

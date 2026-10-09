import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import { getCurrentProfile } from '@/services/dataService'
import type { Branch } from '@/types'

export interface SecretaryLogin { branchId: string; username: string; password: string }

/** Thư ký ngành logins the user may see: their own branch's for a leader, every branch's for Ban điều hành (RLS) */
export async function secretaryLogins(branches: Branch[]): Promise<SecretaryLogin[]> {
  if (!isSupabaseConfigured || !supabase) {
    // Demo: a made-up login per branch, so the card can be tried
    const p = await getCurrentProfile()
    if (p?.role === 'BRANCH_SECRETARY') return []
    return branches.filter(b => p?.role === 'SUPER_ADMIN' || b.id === p?.branchId)
      .map(b => ({ branchId: b.id, username: `thuky.${b.code.toLowerCase()}`, password: 'demo1234' }))
  }
  const { data, error } = await supabase.from('secretary_logins').select('branch_id,username,password').order('created_at')
  if (error) throw error
  return (data ?? []).map(r => ({ branchId: r.branch_id, username: r.username, password: r.password }))
}

/** Message a leader pastes into the branch's Zalo group */
export function secretaryInvite(login: SecretaryLogin, branchName: string, appUrl: string): string {
  return [
    `📅 Tài khoản xem lịch Ngành ${branchName} (TNTT)`,
    `🌐 Mở app: ${appUrl}`,
    `👤 Tên đăng nhập: ${login.username}`,
    `🔑 Mật khẩu: ${login.password}`,
    '',
    'Đăng nhập xong vào tab "Nhắc việc" → bật "Thông báo điện thoại" để nhận nhắc lịch của ngành.',
    'iPhone: mở link bằng Safari → Chia sẻ → "Thêm vào MH chính", rồi mở app từ màn hình chính để bật thông báo.',
    'Tài khoản chỉ để xem lịch, không sửa được gì.',
  ].join('\n')
}

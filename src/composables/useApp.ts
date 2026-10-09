import { computed, reactive } from 'vue'
import { isSupabaseConfigured } from '@/lib/supabase'
import { loadAppData, getCurrentProfile } from '@/services/dataService'
import { applyOutbox, isNetworkError } from '@/services/attendanceOutbox'
import type { AppData, Profile } from '@/types'
import { isSecretary } from '@/utils/roles'

// The last loaded data, so the app opens and attendance can be marked without signal
const CACHE_KEY = 'tntt-data-cache-v1'
type Cache = { profile: Profile; data: AppData; at: string }
function readCache(): Cache | null {
  if (!isSupabaseConfigured) return null
  try { const c = JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null'); return c?.profile && c?.data ? c : null } catch { return null }
}
function writeCache(profile: Profile | null, data: AppData) {
  if (!isSupabaseConfigured || !profile) return
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ profile, data, at: new Date().toISOString() })) } catch { /* full/blocked: just no offline copy */ }
}
export function clearAppCache() { try { localStorage.removeItem(CACHE_KEY) } catch { /* nothing cached */ } }

const cached = readCache()
const state = reactive<{data:AppData|null;profile:Profile|null;loading:boolean;error:string|null;offline:boolean;cachedAt:string|null}>({
  data: cached ? applyOutbox(cached.data) : null, profile: cached?.profile ?? null, loading: false, error: null, offline: false, cachedAt: cached?.at ?? null,
})
export function useApp(){
  const refresh=async()=>{
    state.loading=true;state.error=null
    try{
      const profile=await getCurrentProfile();const data=await loadAppData()
      state.profile=profile;state.data=applyOutbox(data);state.offline=false;state.cachedAt=null
      writeCache(profile,data)
    }catch(e:any){
      // Without signal keep showing the last loaded data instead of an error
      if(isNetworkError(e)&&state.data){state.offline=true;state.cachedAt??=readCache()?.at??null}
      else state.error=e?.message??'Không tải được dữ liệu'
    }finally{state.loading=false}
  }
  /** Re-applies waiting offline saves after one is queued, without a network round trip */
  const applyPending=()=>{if(state.data)state.data=applyOutbox(state.data)}
  return {state,refresh,applyPending,isSuper:computed(()=>state.profile?.role==='SUPER_ADMIN'),readOnly:computed(()=>isSecretary(state.profile))}
}

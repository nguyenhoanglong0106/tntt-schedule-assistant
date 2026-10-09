import { ref } from 'vue'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import { clearAppCache } from '@/composables/useApp'
const busy=ref(false); const error=ref<string|null>(null)
export function useAuth(){
  const signIn=async(email:string,password:string)=>{ if(!supabase)return;busy.value=true;error.value=null;const r=await supabase.auth.signInWithPassword({email,password});busy.value=false;if(r.error){error.value=r.error.message;throw r.error}}
  const signUp=async(email:string,password:string)=>{if(!supabase)return null;busy.value=true;error.value=null;const r=await supabase.auth.signUp({email,password});busy.value=false;if(r.error){error.value=r.error.message;throw r.error}return r.data}
  const signOut=async()=>{
    clearAppCache()
    if(supabase){
      // This phone stops getting the account's reminders (needs the session, so before signing out); the next account turns them on itself
      await import('@/utils/pushNotifications').then(m=>m.unregisterPushSubscription()).catch(()=>undefined)
      try{localStorage.removeItem('tntt-push-on')}catch{/* storage blocked */}
      await supabase.auth.signOut()
    }
  }
  return {busy,error,signIn,signUp,signOut,demoMode:!isSupabaseConfigured}
}

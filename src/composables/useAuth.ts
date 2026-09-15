import { ref } from 'vue'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
const busy=ref(false); const error=ref<string|null>(null)
export function useAuth(){
  const signIn=async(email:string,password:string)=>{ if(!supabase)return;busy.value=true;error.value=null;const r=await supabase.auth.signInWithPassword({email,password});busy.value=false;if(r.error){error.value=r.error.message;throw r.error}}
  const signUp=async(email:string,password:string)=>{if(!supabase)return null;busy.value=true;error.value=null;const r=await supabase.auth.signUp({email,password});busy.value=false;if(r.error){error.value=r.error.message;throw r.error}return r.data}
  const signOut=async()=>{if(supabase)await supabase.auth.signOut()}
  return {busy,error,signIn,signUp,signOut,demoMode:!isSupabaseConfigured}
}

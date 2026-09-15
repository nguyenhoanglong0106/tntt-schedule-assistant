import { computed, reactive } from 'vue'
import { loadAppData, getCurrentProfile } from '@/services/dataService'
import type { AppData, Profile } from '@/types'

const state = reactive<{data:AppData|null;profile:Profile|null;loading:boolean;error:string|null}>({data:null,profile:null,loading:false,error:null})
export function useApp(){
  const refresh=async()=>{state.loading=true;state.error=null;try{state.profile=await getCurrentProfile();state.data=await loadAppData()}catch(e:any){state.error=e?.message??'Không tải được dữ liệu'}finally{state.loading=false}}
  return {state,refresh,isSuper:computed(()=>state.profile?.role==='SUPER_ADMIN')}
}

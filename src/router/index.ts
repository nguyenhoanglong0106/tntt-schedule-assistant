import { createRouter, createWebHistory } from 'vue-router'
import { isAuthRetryableFetchError } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import HomeView from '@/views/HomeView.vue'
const router=createRouter({history:createWebHistory(),routes:[
 {path:'/',component:HomeView},
 {path:'/calendar',component:()=>import('@/views/CalendarView.vue')},
 {path:'/tasks',component:()=>import('@/views/TasksView.vue')},
 {path:'/ai',component:()=>import('@/views/AIView.vue'),meta:{fill:true}},
 {path:'/reminders',component:()=>import('@/views/RemindersView.vue')},
 {path:'/profile',component:()=>import('@/views/ProfileView.vue')},
 {path:'/reading-config',component:()=>import('@/views/ReadingConfigView.vue')},
 {path:'/branch-times',component:()=>import('@/views/BranchTimeConfigView.vue')},
 {path:'/create-admin',component:()=>import('@/views/CreateAdminView.vue')},
 {path:'/people',component:()=>import('@/views/PeopleView.vue')},
 {path:'/activity-log',component:()=>import('@/views/ActivityLogView.vue')},
 {path:'/stats',component:()=>import('@/views/StatsView.vue')},
 {path:'/attendance',component:()=>import('@/views/AttendanceView.vue')},
 {path:'/kpi',component:()=>import('@/views/KpiView.vue')},
 {path:'/guide',component:()=>import('@/views/GuideView.vue')},
 {path:'/meetings',component:()=>import('@/views/MeetingsView.vue')},
 {path:'/breakfast',component:()=>import('@/views/BreakfastView.vue')},
 {path:'/login',component:()=>import('@/views/LoginView.vue'),meta:{hideNav:true}},
]})
// Offline, an expired token can't be refreshed and getSession reports no session; that is not a sign-out, so stay in the app
router.beforeEach(async(to:any)=>{if(!isSupabaseConfigured)return true;const {data:{session},error}=await supabase!.auth.getSession();if(!session&&error&&isAuthRetryableFetchError(error))return to.path==='/login'?'/':true;if(!session&&to.path!='/login')return'/login';if(session&&to.path==='/login')return'/';return true})
export default router

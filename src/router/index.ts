import { createRouter, createWebHistory } from 'vue-router'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import HomeView from '@/views/HomeView.vue'
const router=createRouter({history:createWebHistory(),routes:[
 {path:'/',component:HomeView},
 {path:'/calendar',component:()=>import('@/views/CalendarView.vue')},
 {path:'/ai',component:()=>import('@/views/AIView.vue')},
 {path:'/reminders',component:()=>import('@/views/RemindersView.vue')},
 {path:'/profile',component:()=>import('@/views/ProfileView.vue')},
 {path:'/reading-config',component:()=>import('@/views/ReadingConfigView.vue')},
 {path:'/people',component:()=>import('@/views/PeopleView.vue')},
 {path:'/activity-log',component:()=>import('@/views/ActivityLogView.vue')},
 {path:'/login',component:()=>import('@/views/LoginView.vue'),meta:{hideNav:true}},
]})
router.beforeEach(async(to:any)=>{if(!isSupabaseConfigured)return true;const session=(await supabase!.auth.getSession()).data.session;if(!session&&to.path!='/login')return'/login';if(session&&to.path==='/login')return'/';return true})
export default router

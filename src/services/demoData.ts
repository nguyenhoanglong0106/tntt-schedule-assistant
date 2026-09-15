import { DEMO_BRANCHES, DEMO_TASK_TYPES } from '@/lib/constants'
import type { AppData, ClassGroup, Member, Schedule } from '@/types'
import { addDays, nextWeekdayInWeek, startOfWeek, todayISO } from '@/utils/date'

const classes: ClassGroup[] = [
  { id:'class-chien-1', branchId:'branch-chien', name:'Chiên 1' },
  { id:'class-au-1', branchId:'branch-au', name:'Ấu 1' },
  { id:'class-thieu-1', branchId:'branch-thieu', name:'Thiếu 1' },
  { id:'class-thieu-2', branchId:'branch-thieu', name:'Thiếu 2' },
  { id:'class-nghia-1', branchId:'branch-nghia', name:'Nghĩa 1' },
  { id:'class-hiep-1', branchId:'branch-hiep', name:'Hiệp 1' },
]
const members: Member[] = [
  { id:'m-minh-thu', branchId:'branch-thieu', classId:'class-thieu-1', fullName:'Minh Thư', active:true },
  { id:'m-duc', branchId:'branch-thieu', classId:'class-thieu-1', fullName:'Đức', active:true },
  { id:'m-tuyen', branchId:'branch-thieu', classId:'class-thieu-2', fullName:'Tuyền', active:true },
  { id:'m-hoang', branchId:'branch-thieu', classId:'class-thieu-2', fullName:'Hoàng', active:true },
  { id:'m-minh', branchId:'branch-chien', classId:'class-chien-1', fullName:'Minh', active:true },
  { id:'m-duc-au', branchId:'branch-au', classId:'class-au-1', fullName:'Đức An', active:true },
  { id:'m-an-nghia', branchId:'branch-nghia', classId:'class-nghia-1', fullName:'An', active:true },
  { id:'m-bao-hiep', branchId:'branch-hiep', classId:'class-hiep-1', fullName:'Bảo', active:true },
]

export function makeDemoData(): AppData {
  const base = startOfWeek(todayISO())
  const schedule = (s: Partial<Schedule> & Pick<Schedule,'id'|'taskTypeId'|'taskCode'|'taskName'|'branchId'|'date'>): Schedule => ({
    startTime:null,endTime:null,status:'ASSIGNED',notes:null,assignees:[],reminderOffsets:[180],...s
  })
  const schedules: Schedule[] = [
    schedule({id:'s1',taskTypeId:'task-reading',taskCode:'READING',taskName:'Đọc sách',branchId:'branch-thieu',date:nextWeekdayInWeek(base,1),startTime:'18:00',assignees:[{type:'MEMBER',memberId:'m-minh-thu',label:'Minh Thư'}]}),
    schedule({id:'s2',taskTypeId:'task-reading',taskCode:'READING',taskName:'Đọc sách',branchId:'branch-thieu',date:nextWeekdayInWeek(base,2),startTime:'18:00',assignees:[{type:'MEMBER',memberId:'m-duc',label:'Đức'}]}),
    schedule({id:'s3',taskTypeId:'task-reading',taskCode:'READING',taskName:'Đọc sách',branchId:'branch-thieu',date:nextWeekdayInWeek(base,4),startTime:'18:00',assignees:[{type:'MEMBER',memberId:'m-tuyen',label:'Tuyền'}]}),
    schedule({id:'s4',taskTypeId:'task-cleaning',taskCode:'CLEANING',taskName:'Vệ sinh Nhà Giáo Lý',branchId:'branch-chien',date:addDays(base,6),startTime:'05:30',endTime:'06:00',assignees:[{type:'MEMBER',memberId:'m-minh',label:'Minh'}]}),
    schedule({id:'s5',taskTypeId:'task-cleaning',taskCode:'CLEANING',taskName:'Vệ sinh Nhà Giáo Lý',branchId:'branch-au',date:addDays(base,6),startTime:'06:00',endTime:'06:30',assignees:[{type:'MEMBER',memberId:'m-duc-au',label:'Đức An'}]}),
    schedule({id:'s6',taskTypeId:'task-icecream',taskCode:'ICE_CREAM',taskName:'Bán kem',branchId:'branch-thieu',date:addDays(base,6),startTime:'07:00',endTime:'08:00',assignees:[{type:'CLASS',classId:'class-thieu-2',label:'Thiếu 2'}],reminderOffsets:[720,30]}),
    schedule({id:'s7',taskTypeId:'task-office',taskCode:'OFFICE_DUTY',taskName:'Trực văn phòng',branchId:'branch-hiep',date:addDays(base,6),startTime:'07:30',endTime:'09:00',assignees:[{type:'MEMBER',memberId:'m-bao-hiep',label:'Bảo'}]}),
  ]
  return { branches:DEMO_BRANCHES, taskTypes:DEMO_TASK_TYPES, members, classes, schedules, rotation:{startDate:base,startBranchId:'branch-thieu'}, notifications:[] }
}

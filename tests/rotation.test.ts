import { describe, expect, it } from 'vitest'
import { readingBranchForDate, startOfWeek } from '../src/utils/date'
import type { Branch } from '../src/types'
const branches:Branch[]=[
 {id:'c',code:'CHIEN',name:'Chiên',colorHex:'#000000',rotationIndex:0},
 {id:'a',code:'AU',name:'Ấu',colorHex:'#000000',rotationIndex:1},
 {id:'t',code:'THIEU',name:'Thiếu',colorHex:'#000000',rotationIndex:2},
 {id:'n',code:'NGHIA',name:'Nghĩa',colorHex:'#000000',rotationIndex:3},
 {id:'h',code:'HIEP',name:'Hiệp',colorHex:'#000000',rotationIndex:4},
]
describe('reading rotation',()=>{
 it('starts Monday',()=>expect(startOfWeek('2026-09-20')).toBe('2026-09-14'))
 it('rotates one branch per week',()=>{
  const cfg={startDate:'2026-09-21',startBranchId:'t'}
  expect(readingBranchForDate('2026-09-21',cfg,branches)?.name).toBe('Thiếu')
  expect(readingBranchForDate('2026-09-28',cfg,branches)?.name).toBe('Nghĩa')
  expect(readingBranchForDate('2026-10-05',cfg,branches)?.name).toBe('Hiệp')
  expect(readingBranchForDate('2026-10-12',cfg,branches)?.name).toBe('Chiên')
  expect(readingBranchForDate('2026-10-19',cfg,branches)?.name).toBe('Ấu')
 })
})

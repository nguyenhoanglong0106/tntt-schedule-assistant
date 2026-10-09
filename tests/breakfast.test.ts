import { describe, expect, it } from 'vitest'
import { closesAt, deadlineDay, isOpen, lastServedMap, minPicks, tallyBreakfast, timeLeft, upcomingBreakfast } from '../src/utils/breakfast'
import { addDaysISO, rankDishes } from '../supabase/functions/_shared/breakfast'

const item = (id: string, name: string, sortOrder = 10, active = true) => ({ id, name, note: null, active, sortOrder })
const ballot = (branchId: string, itemIds: string[], headcount: number | null = null) => ({ weekDate: '2026-10-11', branchId, itemIds, headcount, updatedBy: null, updatedAt: '' })
const menu = [item('pho', 'Phở', 10), item('bunbo', 'Bún bò', 20), item('banhmi', 'Bánh mì', 30), item('hutieu', 'Hủ tiếu', 40), item('xoi', 'Xôi', 50), item('banhcuon', 'Bánh cuốn', 60)]

describe('breakfast week', () => {
  it('chooses for this Sunday on weekdays and Saturday', () => {
    expect(upcomingBreakfast('2026-10-05')).toBe('2026-10-11') // Monday
    expect(upcomingBreakfast('2026-10-09')).toBe('2026-10-11') // Friday
    expect(upcomingBreakfast('2026-10-10')).toBe('2026-10-11') // Saturday
  })
  it('moves on to next Sunday on the Sunday itself', () => expect(upcomingBreakfast('2026-10-11')).toBe('2026-10-18'))
  it('deadline is the Friday before, closing when Saturday starts in Vietnam', () => {
    expect(deadlineDay('2026-10-11')).toBe('2026-10-09')
    expect(closesAt('2026-10-11')).toBe(Date.parse('2026-10-09T17:00:00Z'))
    expect(isOpen('2026-10-11', Date.parse('2026-10-09T23:59:00+07:00'))).toBe(true)
    expect(isOpen('2026-10-11', Date.parse('2026-10-10T00:00:00+07:00'))).toBe(false)
  })
  it('shows the time left', () => {
    expect(timeLeft('2026-10-11', Date.parse('2026-10-07T21:00:00+07:00'))).toBe('còn 2 ngày 3 giờ')
    expect(timeLeft('2026-10-11', Date.parse('2026-10-09T18:20:00+07:00'))).toBe('còn 5 giờ 40 phút')
    expect(timeLeft('2026-10-11', Date.parse('2026-10-11T07:00:00+07:00'))).toBe('còn 0 phút')
  })
  it('asks for at most as many dishes as the menu has', () => { expect(minPicks(6)).toBe(2); expect(minPicks(1)).toBe(1) })
})

describe('breakfast tally', () => {
  // The example from the design: Hiệp has not chosen
  const ballots = [
    ballot('chien', ['pho', 'banhmi', 'xoi'], 12),
    ballot('au', ['bunbo', 'pho'], 15),
    ballot('thieu', ['pho', 'hutieu', 'banhmi'], 10),
    ballot('nghia', ['banhmi', 'pho', 'bunbo']),
  ]
  const { rows, voters, headcount } = tallyBreakfast(menu, ballots)

  it('percent is over the branches that chose', () => {
    expect(voters).toBe(4)
    expect(rows.map(r => [r.item.id, r.percent, r.points])).toEqual([
      ['pho', 100, 10], ['banhmi', 75, 6], ['bunbo', 50, 4], ['hutieu', 25, 2], ['xoi', 25, 1], ['banhcuon', 0, 0],
    ])
  })
  it('equal percent is broken by preference points, not reported as a tie', () => {
    expect(rows.find(r => r.item.id === 'hutieu')!.tied).toBe(false)
  })
  it('lists who picked each dish and at which preference', () => {
    expect(rows[0].picks).toEqual([{ branchId: 'chien', rank: 1 }, { branchId: 'au', rank: 2 }, { branchId: 'thieu', rank: 1 }, { branchId: 'nghia', rank: 2 }])
  })
  it('adds up the headcount', () => expect(headcount).toBe(37))

  it('a full tie goes to the dish not eaten for the longest time', () => {
    const tie = [ballot('a', ['pho', 'bunbo']), ballot('b', ['bunbo', 'pho'])]
    const served = lastServedMap([{ weekDate: '2026-09-27', finalItemIds: ['bunbo'] }, { weekDate: '2026-10-04', finalItemIds: ['pho'] }])
    const r = tallyBreakfast(menu, tie, served).rows
    expect(r.slice(0, 2).map(x => x.item.id)).toEqual(['bunbo', 'pho'])
    expect(r[0].tied && r[1].tied).toBe(true)
    // A dish never ordered counts as longest ago
    expect(tallyBreakfast(menu, tie, { pho: '2026-10-04' }).rows[0].item.id).toBe('bunbo')
  })
  it('keeps hidden dishes only while someone picked them', () => {
    const withHidden = [...menu, item('chao', 'Cháo', 70, false), item('mi', 'Mì', 80, false)]
    const ids = tallyBreakfast(withHidden, [ballot('a', ['chao', 'pho'])]).rows.map(r => r.item.id)
    expect(ids).toContain('chao')
    expect(ids).not.toContain('mi')
  })
  it('with no ballots every dish is 0%', () => {
    const t = tallyBreakfast(menu, [])
    expect(t.voters).toBe(0)
    expect(t.rows.every(r => r.percent === 0 && !r.tied)).toBe(true)
  })
  it('the Saturday notice ranks dishes exactly like the results screen', () => {
    const toServer = (bs: typeof ballots) => bs.map(b => ({ item_ids: b.itemIds }))
    expect(rankDishes(menu, toServer(ballots)).rows.map(r => [r.id, r.percent])).toEqual(rows.filter(r => r.count).map(r => [r.item.id, r.percent]))
    const tie = [ballot('a', ['pho', 'bunbo']), ballot('b', ['bunbo', 'pho'])]
    expect(rankDishes(menu, toServer(tie), { bunbo: '2026-10-04' }).rows[0].id).toBe(tallyBreakfast(menu, tie, { bunbo: '2026-10-04' }).rows[0].item.id)
    expect(addDaysISO('2026-10-11', -2)).toBe(deadlineDay('2026-10-11'))
  })
  it('remembers the latest time a dish was ordered', () => {
    expect(lastServedMap([{ weekDate: '2026-10-04', finalItemIds: ['pho'] }, { weekDate: '2026-09-20', finalItemIds: ['pho', 'xoi'] }])).toEqual({ pho: '2026-10-04', xoi: '2026-09-20' })
  })
})

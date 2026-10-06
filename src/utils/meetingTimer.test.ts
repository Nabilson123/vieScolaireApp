import { describe, expect, it } from 'vitest'
import { addElapsed, formatClock, statutTemps, totalElapsed } from './meetingTimer'

describe('formatClock', () => {
  it('minutes et secondes sur deux chiffres', () => {
    expect(formatClock(0)).toBe('0:00')
    expect(formatClock(65.9)).toBe('1:05')
    expect(formatClock(30 * 60)).toBe('30:00')
    expect(formatClock(-4)).toBe('0:00')
  })
})

describe('statutTemps', () => {
  it('ok, proche à 80 %, dépassé au-delà du prévu', () => {
    expect(statutTemps(60, 3)).toBe('ok')
    expect(statutTemps(144, 3)).toBe('proche')
    expect(statutTemps(180, 3)).toBe('proche')
    expect(statutTemps(181, 3)).toBe('depasse')
  })
})

describe('temps écoulé par point', () => {
  it('s’additionne par point et au total', () => {
    let t = addElapsed({}, 1, 30)
    t = addElapsed(t, 1, 15)
    t = addElapsed(t, 3, 100)
    expect(t).toEqual({ 1: 45, 3: 100 })
    expect(totalElapsed(t)).toBe(145)
  })

  it('ne modifie pas l’objet d’origine', () => {
    const base = { 2: 10 }
    addElapsed(base, 2, 5)
    expect(base).toEqual({ 2: 10 })
  })
})

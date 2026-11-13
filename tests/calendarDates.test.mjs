import test from 'node:test'
import assert from 'node:assert/strict'
import { calendarMinimum } from '../src/utils/calendarDates.js'

test('calendar day rolls over at Philippine midnight regardless of browser timezone', () => {
    assert.equal(calendarMinimum('date', '', new Date('2026-11-13T15:59:59Z')), '2026-11-13')
    assert.equal(calendarMinimum('date', '', new Date('2026-11-13T16:00:00Z')), '2026-11-14')
    assert.equal(calendarMinimum('datetime-local', '', new Date('2026-11-13T16:00:00Z')), '2026-11-14T00:00')
})
test('range start cannot weaken the past-day lock and later range starts are preserved', () => {
    const now = new Date('2026-11-13T06:00:00Z')
    assert.equal(calendarMinimum('date', '2026-11-01', now), '2026-11-13')
    assert.equal(calendarMinimum('date', '2026-11-20', now), '2026-11-20')
    assert.equal(calendarMinimum('datetime-local', '2026-11-12T12:00', now), '2026-11-13T00:00')
    assert.equal(calendarMinimum('datetime-local', '2026-11-13T12:00', now), '2026-11-13T12:00')
})

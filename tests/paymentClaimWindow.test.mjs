import { test } from 'node:test'
import assert from 'node:assert/strict'
import { claimMatchesWindow } from '../src/utils/paymentClaimWindow.js'

test('claim window matches semester and inclusive opening, exclusive closing', () => {
    const window = { academic_period_id: 2, opens_at: '2026-11-19 08:00:00', closes_at: '2026-11-23 17:00:00' }
    const claim = { academic_period_id: '2', submitted_at: window.opens_at }
    assert.equal(claimMatchesWindow(claim, window), true)
    assert.equal(claimMatchesWindow({ ...claim, submitted_at: window.closes_at }, window), false)
    assert.equal(claimMatchesWindow({ ...claim, academic_period_id: 1 }, window), false)
    assert.equal(claimMatchesWindow({ ...claim, submitted_at: '2026-11-19 07:59:59' }, window), false)
    assert.equal(claimMatchesWindow(claim, undefined), false)
})

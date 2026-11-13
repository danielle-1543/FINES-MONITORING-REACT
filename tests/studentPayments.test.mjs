import test from 'node:test'
import assert from 'node:assert/strict'
import { paymentOrganizations, paymentBlockReason, paymentPage } from '../src/utils/studentPayments.js'

const schedule = { id: 1, payment_window: 'OPEN' }
const fine = (org, amount, extra = {}) => ({ org_user_id: org, organization_name: `Org ${org}`, fine_amount: amount,
    outstanding: amount, pending_amount: '0.00', available_to_claim: amount, payment_window: 'OPEN', payment_period_id: 1, ...extra })

test('organization and combined totals are independent of filters and pagination', () => {
    const groups = paymentOrganizations({ organizations: [{ id: 1, organization_name: 'CCS', schedules: [schedule] },
        { id: 2, organization_name: 'USG', schedules: [schedule] }],
    fines: [fine(1, '30.10'), fine(1, '20.20'), fine(2, '25.00')], claims: [] })
    assert.equal(groups[0].total, 5030)
    assert.equal(groups[1].total, 2500)
    assert.equal(groups.reduce((sum, group) => sum + group.total, 0), 7530)
    assert.equal(paymentBlockReason(groups[0], schedule), '')
})
test('pending claims block only their organization, even when their fine is not in the list', () => {
    const groups = paymentOrganizations({ organizations: [{ id: 1, schedules: [schedule] }, { id: 2, schedules: [schedule] }],
        fines: [fine(1, '30.00'), fine(2, '25.00')], claims: [{ org_user_id: 1, status: 'PENDING' }] })
    assert.equal(groups[0].payable, 0)
    assert.match(paymentBlockReason(groups[0], schedule), /pending/)
    assert.equal(groups[1].payable, 2500)
    assert.equal(paymentBlockReason(groups[1], schedule), '')
})
test('historical fines for an ineligible organization cannot become payment choices', () => {
    const [group] = paymentOrganizations({ organizations: [], fines: [fine(3, '10.00')] })
    assert.equal(group.total, 1000)
    assert.equal(group.payable, 0)
    assert.match(paymentBlockReason(group), /current program/)
})
test('missing, future, closed, and uncovered schedules explain why payment is unavailable', () => {
    const [group] = paymentOrganizations({ organizations: [{ id: 1, schedules: [] }], fines: [fine(1, '10.00')] })
    assert.match(paymentBlockReason(group), /publish one/)
    group.schedules = [schedule]
    assert.match(paymentBlockReason(group, { ...schedule, payment_window: 'UPCOMING' }), /opening date/)
    assert.match(paymentBlockReason(group, { ...schedule, payment_window: 'CLOSED' }), /closed/)
    assert.match(paymentBlockReason(group, { ...schedule, id: 999 }), /covered/)
})
test('fines are paginated five at a time and pages clamp after records change', () => {
    const rows = Array.from({ length: 12 }, (_, id) => ({ id }))
    assert.equal(paymentPage(rows).rows.length, 5)
    assert.equal(paymentPage(rows, 2).rows[0].id, 5)
    assert.equal(paymentPage(rows, 3).rows.length, 2)
    assert.equal(paymentPage(rows, 100).page, 3)
    assert.equal(paymentPage(rows.slice(0, 2), 3).page, 1)
    assert.deepEqual(paymentPage([], 3), { rows: [], page: 1, pages: 1, total: 0 })
})

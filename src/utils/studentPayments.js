const cents = value => Math.round(Number(value || 0) * 100)

export function paymentOrganizations(data) {
    const groups = new Map()
    for (const org of data.organizations || []) {
        groups.set(String(org.id), { id: String(org.id), name: org.organization_name,
            eligible: true, schedules: org.schedules || [], fines: [], total: 0, originalTotal: 0, outstanding: 0, pending: 0, payable: 0 })
    }
    for (const fine of data.fines || []) {
        const id = String(fine.org_user_id)
        if (!groups.has(id)) groups.set(id, { id, name: fine.organization_name, eligible: false,
            schedules: [], fines: [], total: 0, originalTotal: 0, outstanding: 0, pending: 0, payable: 0 })
        const group = groups.get(id)
        group.fines.push(fine)
        group.originalTotal += cents(fine.fine_amount)
        group.total += fine.payable_amount != null ? cents(fine.payable_amount)
            : Math.max(0, cents(fine.fine_amount) - cents(fine.cap_adjustment) - cents(fine.discount_amount))
        group.outstanding += cents(fine.outstanding)
        group.pending += cents(fine.pending_amount)
        if (fine.payment_window === 'OPEN') group.payable += cents(fine.available_to_claim)
    }
    for (const group of groups.values()) {
        group.hasPending = group.pending > 0 || (data.claims || []).some(claim =>
            String(claim.org_user_id) === group.id && claim.status === 'PENDING')
        if (!group.eligible || group.hasPending) group.payable = 0
    }
    return [...groups.values()]
}

export function paymentBlockReason(group, schedule = null) {
    if (!group.eligible) return 'This organization does not cover your current program.'
    if (group.hasPending) return 'A payment is pending. Resolve it in Payment history before paying again.'
    if (schedule?.payment_window === 'UPCOMING') return 'Payments open on the scheduled opening date.'
    if (schedule?.payment_window === 'CLOSED') return 'This payment window has closed.'
    if (!group.schedules.length) return 'No payment schedule yet. Ask this organization to publish one.'
    if (schedule && !group.fines.some(fine => String(fine.payment_period_id) === String(schedule.id) && cents(fine.available_to_claim) > 0)) {
        return 'No unpaid fines are covered by this schedule.'
    }
    if (group.payable <= 0) return 'No fines are currently payable in an open payment schedule.'
    return ''
}

export function paymentPage(rows, requested = 1, size = 5) {
    const pages = Math.max(1, Math.ceil(rows.length / size))
    const page = Math.min(pages, Math.max(1, Number(requested) || 1))
    return { rows: rows.slice((page - 1) * size, page * size), page, pages, total: rows.length }
}

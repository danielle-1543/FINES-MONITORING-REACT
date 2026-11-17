export function claimMatchesWindow(claim, window) {
    return Boolean(window)
        && String(claim.academic_period_id || 0) === String(window.academic_period_id || 0)
        && claim.submitted_at >= window.opens_at
        && claim.submitted_at < window.closes_at
}

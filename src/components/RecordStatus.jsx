export default function RecordStatus({ value }) {
    const status = String(value || '').toUpperCase()
    const positive = ['ACTIVE', 'ACTIVATED', 'PRESENT', 'PAID', 'CONFIRMED', 'SETTLED', 'OPEN']
    const negative = ['INACTIVE', 'DEACTIVATED', 'ABSENT', 'REJECTED', 'REVOKED']
    const pending = ['PENDING', 'UNPAID', 'PARTIALLY_PAID', 'UPCOMING']
    const tone = positive.includes(status) ? 'positive' : negative.includes(status) ? 'negative' : pending.includes(status) ? 'pending' : 'neutral'
    const label = status ? status.toLowerCase().replaceAll('_', ' ').replace(/^./, letter => letter.toUpperCase()) : '—'
    return <span className="record-status" data-tone={tone}>{label}</span>
}

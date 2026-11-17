export function notificationDate(value) {
    if (!value) return null
    const text = String(value).replace(' ', 'T')
    const date = new Date(text + (/(Z|[+-]\d{2}:\d{2})$/.test(text) ? '' : '+08:00'))
    return Number.isNaN(date.getTime()) ? null : date
}

export function notificationDay(value, now = new Date()) {
    const date = notificationDate(value)
    if (!date) return 'Earlier'
    const day = value => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(value)
    if (day(date) === day(now)) return 'Today'
    if (day(date) === day(new Date(now.getTime() - 86400000))) return 'Yesterday'
    return 'Earlier'
}

export function notificationFields(item) {
    const message = item.message || ''
    const fields = []
    if (item.kind === 'PAYMENT_WINDOW') {
        const match = message.match(/^(.*?) · (.*?): payments are accepted from (\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) until (\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/)
        if (match) {
            fields.push(['Organization', match[1]], ['Academic period', match[2]])
            const year = match[2].match(/\d{4}\s*[–-]\s*\d{4}/)?.[0]
            const semester = match[2].match(/(?:First|Second|Third|1st|2nd|3rd) Semester|Summer|Midyear/i)?.[0]
            if (year) fields.push(['Academic year', year])
            if (semester) fields.push(['Semester', semester])
            fields.push(['Payment opens', match[3], 'date'], ['Payment closes', match[4], 'date'])
        }
    } else {
        const quoted = [...message.matchAll(/"([^"\n]+)"/g)].map(match => match[1])
        if (quoted[0]) fields.push([item.kind === 'VIOLATION' ? 'Violation' : 'Event', quoted[0]])
        if (item.kind === 'VIOLATION' && quoted[1]) fields.push(['Event', quoted[1]])
        const amount = message.match(/₱[\d,.]+/)?.[0]
        if (amount) fields.push(['Fine amount', amount])
    }
    if (item.recorded_at) fields.push(['Recorded', item.recorded_at, 'date'])
    if (item.created_at) fields.push(['Notification created', item.created_at, 'date'])
    if (item.read_at) fields.push(['Read', item.read_at, 'date'])
    return fields
}

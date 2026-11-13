export function calendarMinimum(type = 'date', minimum = '', now = new Date()) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(now).map(part => [part.type, part.value]))
    const today = `${parts.year}-${parts.month}-${parts.day}`
    const floor = type === 'datetime-local' ? `${today}T00:00` : today
    return minimum && minimum > floor ? minimum : floor
}

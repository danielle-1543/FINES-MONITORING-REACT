export function money(value) {
    return Number(value || 0).toLocaleString('en-PH', {
        style: 'currency',
        currency: 'PHP'
    })
}

export function date(value) {
    return value ? new Date(value.replace(' ', 'T') + '+08:00').toLocaleString('en-PH', {
        timeZone: 'Asia/Manila'
    }) : '—'
}

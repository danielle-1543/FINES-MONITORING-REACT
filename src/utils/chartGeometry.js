const categoryColors = {
    BSIT: '#079447', BSCRIM: '#e53935', BTVTED: '#f59e0b', BSED: '#4361ee',
    BSHM: '#9333ea', BSTM: '#0891b2', BTLED: '#db2777',
    'AB ENGLISH': '#65a30d', ABPSYCH: '#ea580c',
    'Pending Activation': '#f59e0b', 'Activated Accounts': '#079447',
    'Active Accounts': '#079447', 'Inactive Accounts': '#e53935'
}
function categoryColor(label) {
    if (categoryColors[label]) return categoryColors[label]
    const hash = Array.from(label).reduce((value, character) => ((value * 31 + character.charCodeAt(0)) >>> 0), 0)
    return `hsl(${hash % 360} 75% ${40 + (hash % 3) * 5}%)`
}
export function chartSegments(values) {
    const counts = new Map()
    for (const item of values) {
        const count = Number(item.count)
        counts.set(item.label, (counts.get(item.label) || 0) + (Number.isFinite(count) && count > 0 ? count : 0))
    }
    const total = Array.from(counts.values()).reduce((sum, count) => sum + count, 0)
    let angle = -90
    const segments = Array.from(counts, ([label, count]) => {
        const start = angle
        angle += total ? count / total * 360 : 0
        return { label, count, start, end: angle, percentage: total ? count / total * 100 : 0, color: categoryColor(label) }
    })
    return { total, segments }
}
export function slicePath(start, end, innerRadius = 0, paddingAngle = 2) {
    const span = end - start
    if (span <= 0) return ''
    const gap = Math.min(paddingAngle, span * 0.2)
    const first = start + gap / 2
    const last = Math.min(end - gap / 2, first + 359.9999)
    const point = (radius, angle) => {
        const radians = angle * Math.PI / 180
        return `${radius * Math.cos(radians)},${radius * Math.sin(radians)}`
    }
    const large = last - first > 180 ? 1 : 0
    const outer = `M${point(90, first)} A90,90 0 ${large} 1 ${point(90, last)}`
    return innerRadius
        ? `${outer} L${point(innerRadius, last)} A${innerRadius},${innerRadius} 0 ${large} 0 ${point(innerRadius, first)} Z`
        : `${outer} L0,0 Z`
}

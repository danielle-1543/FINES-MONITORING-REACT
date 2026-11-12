import { useState } from 'react'
import { chartSegments, slicePath } from '../utils/chartGeometry'

export default function StatisticsChart({ title, values, donut = false, unit = 'Accounts', population = 'accounts' }) {
    const [hovered, setHovered] = useState(null)
    const [selected, setSelected] = useState(null)
    const { total, segments } = chartSegments(values)
    const active = segments.find(item => item.label === (hovered ?? selected))
    function toggle(label) {
        setSelected(current => current === label ? null : label)
    }
    function interaction(label) {
        return {
            onPointerEnter: event => {
                if (event.pointerType !== 'touch') setHovered(label)
            },
            onPointerLeave: () => setHovered(null),
            onPointerDown: event => {
                if (event.pointerType === 'touch') toggle(label)
            },
            onFocus: () => setHovered(label),
            onBlur: () => setHovered(null)
        }
    }
    return <section className="statistics-chart">
        <h4>{title}</h4>
        <div className="statistics-svg-wrap">
            <svg viewBox="-110 -110 220 220" className="statistics-svg" aria-label={title}>
                {!total && <circle r="90" fill="#e5ece5" />}
                {segments.filter(item => item.count > 0).map(item => {
                    const radians = (item.start + item.end) / 2 * Math.PI / 180
                    return <path key={item.label}
                        d={slicePath(item.start, item.end, donut ? 56 : 0, segments.filter(value => value.count > 0).length > 1 ? 2 : 0)}
                        fill={item.color} className="statistics-slice"
                        style={{ transform: active?.label === item.label ? `translate(${Math.cos(radians) * 6}px, ${Math.sin(radians) * 6}px)` : 'translate(0, 0)' }}
                        tabIndex={0} role="button" aria-pressed={selected === item.label}
                        aria-label={`${item.label}: ${item.count.toLocaleString()} ${unit}, ${item.percentage.toFixed(1)}%`}
                        {...interaction(item.label)}
                        onKeyDown={event => {
                            if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault()
                                toggle(item.label)
                            }
                            if (event.key === 'Escape') {
                                setSelected(null)
                                setHovered(null)
                            }
                        }} />
                })}
                {donut && !total && <circle r="56" fill="white" />}
            </svg>
            {donut && <div className="statistics-center" aria-live="polite">
                {active ? <><strong>{active.label}</strong><b>{active.percentage.toFixed(1)}%</b><small>{active.count.toLocaleString()} {unit}</small></>
                    : <><b>{total.toLocaleString()}</b><small>Total {unit}</small></>}
            </div>}
        </div>
        {!donut && <div className="statistics-selection" aria-live="polite">
            {active ? <><strong>{active.label}</strong><span>{active.count.toLocaleString()} {unit} · {active.percentage.toFixed(1)}%</span></>
                : <><strong>{total.toLocaleString()} {unit}</strong><span>Hover, focus, or tap a category for details.</span></>}
        </div>}
        <details className="statistics-breakdown">
        <summary>View breakdown</summary>
        <ul aria-label={`${title} summary`}>
            {segments.map(item => <li key={item.label}>
                <button type="button" className="statistics-legend-button" aria-pressed={selected === item.label}
                    {...interaction(item.label)} onClick={event => {
                        if (event.detail === 0) toggle(item.label)
                    }}>
                    <span className="statistics-key" aria-hidden="true" style={{ backgroundColor: item.color }} />
                    <strong className="statistics-category">{item.label}</strong>
                    <strong className="statistics-value">{item.count.toLocaleString()} · {item.percentage.toFixed(1)}%</strong>
                </button>
            </li>)}
        </ul>
        </details>
        <small>{total ? `Percentage of ${total.toLocaleString()} ${population}.` : 'No records available.'}</small>
        {selected && <button type="button" className="statistics-clear" onClick={() => {
            setSelected(null)
            setHovered(null)
        }}>Clear selection</button>}
    </section>
}

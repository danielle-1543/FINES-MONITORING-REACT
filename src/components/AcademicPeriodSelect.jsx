import { useEffect, useRef, useState } from 'react'
import { apiRequest } from '../utils/apiRequest'

export default function AcademicPeriodSelect({ accessToken, value, onChange, includeAll = false, includeLegacy = false, openOnly = false, required = false, defaultCurrent = false, label = 'Academic year and semester', disabled = false }) {
    const [periods, setPeriods] = useState([])
    const [error, setError] = useState('')
    const currentValue = useRef(value)
    const changed = useRef(onChange)
    useEffect(() => { currentValue.current = value; changed.current = onChange }, [value, onChange])
    useEffect(() => {
        const controller = new AbortController()
        apiRequest('/api/academic-periods', accessToken, undefined, controller.signal).then(result => {
            if (controller.signal.aborted) return
            setPeriods(result.data)
            if (defaultCurrent && !currentValue.current) {
                const current = result.data.find(period => Number(period.is_current) === 1)
                if (current) changed.current(String(current.id))
            }
        }).catch(error => { if (error.name !== 'AbortError') setError(error.message) })
        return () => controller.abort()
    }, [accessToken, defaultCurrent])
    return <label>{label}<select value={value ?? ''} required={required} disabled={disabled} onChange={event => onChange(event.target.value)}>
        <option value="">Choose academic year and semester</option>
        {includeAll && <option value="all">All academic periods</option>}
        {includeLegacy && <option value="0">Legacy / Unassigned</option>}
        {periods.filter(period => !openOnly || period.status === 'OPEN').map(period => <option key={period.id} value={period.id}>
            {period.label}{Number(period.is_current) === 1 ? ' · Current' : ''}{period.status === 'CLOSED' ? ' · Closed' : ''}
        </option>)}
    </select>{error && <small role="alert">{error}</small>}</label>
}

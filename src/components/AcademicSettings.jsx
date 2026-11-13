import { useEffect, useState } from 'react'
import { apiRequest } from '../utils/apiRequest'
import { trackEvent } from '../config/posthog'

export default function AcademicSettings({ accessToken }) {
    const [periods, setPeriods] = useState([])
    const [form, setForm] = useState({ year_start: new Date().getFullYear(), term: 'FIRST', is_current: true })
    const [error, setError] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false)
    const [legacy, setLegacy] = useState(null), [selection, setSelection] = useState(''), [periodId, setPeriodId] = useState(''), [preview, setPreview] = useState(null)
    useEffect(() => {
        const controller = new AbortController()
        apiRequest('/api/academic-periods', accessToken, undefined, controller.signal).then(result => setPeriods(result.data))
            .catch(error => { if (error.name !== 'AbortError') setError(error.message) })
        return () => controller.abort()
    }, [accessToken])
    async function save(values) {
        setBusy(true); setError(''); setMessage('')
        try {
            await apiRequest('/api/admin/academic-periods/save', accessToken, values)
            setPeriods((await apiRequest('/api/academic-periods', accessToken)).data)
            setMessage('Academic settings saved. Existing records keep their original semesters.')
            trackEvent('academic_period_updated')
        } catch (error) { setError(error.message) } finally { setBusy(false) }
    }
    async function classify(confirm = false) {
        setBusy(true); setError('')
        try {
            const [kind, source] = selection.split(':')
            const result = await apiRequest('/api/admin/academic-periods/classify', accessToken, {
                kind, source_id: Number(source), academic_period_id: Number(periodId), preview: !confirm,
                ...(confirm ? { fingerprint: preview.fingerprint } : {})
            })
            setMessage(result.data.message)
            setPreview(confirm ? null : result.data)
            if (confirm) { setLegacy((await apiRequest('/api/admin/academic-periods/legacy', accessToken)).data); setSelection('') }
        } catch (error) { setError(error.message); setPreview(null) } finally { setBusy(false) }
    }
    return <section className="student-panel payment-page academic-settings">
        <h2>Academic Settings</h2>
        <p>Choose the academic year and semester used for new records. Calendar dates are not required. Changing the current semester never moves old records.</p>
        {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
        <form className="payment-form academic-period-form" onSubmit={event => { event.preventDefault(); void save(form) }}>
            <label>Academic year starts<input type="number" required min="2000" max="2200" value={form.year_start} onChange={event => setForm({ ...form, year_start: event.target.value })} /></label>
            <p>Academic Year {form.year_start}–{Number(form.year_start) + 1}</p>
            <label>Semester<select value={form.term} onChange={event => setForm({ ...form, term: event.target.value })}>
                <option value="FIRST">First Semester</option><option value="SECOND">Second Semester</option><option value="SUMMER">Summer Term</option>
            </select></label>
            <label><input type="checkbox" checked={form.is_current} onChange={event => setForm({ ...form, is_current: event.target.checked })} />Make this the current academic period</label>
            <button disabled={busy}>Create academic period</button>
        </form>
        <div className="student-table"><table><thead><tr><th>Academic period</th><th>Status</th><th>Current</th><th>Actions</th></tr></thead>
            <tbody>{periods.map(period => <tr key={period.id}><td>{period.label}</td><td>{period.status}</td><td>{Number(period.is_current) ? 'Current' : '—'}</td>
                <td><button disabled={busy || Boolean(Number(period.is_current))} onClick={() => save({ ...period, is_current: true, status: 'OPEN' })}>Set current</button>{' '}
                    <button disabled={busy} onClick={() => save({ ...period, is_current: false, status: period.status === 'OPEN' ? 'CLOSED' : 'OPEN' })}>{period.status === 'OPEN' ? 'Close semester' : 'Reopen semester'}</button></td></tr>)}</tbody></table></div>
        <section className="academic-legacy-section">
        <h3>Classify existing legacy records</h3>
        <p>Old records are unassigned until reviewed. Classification preserves original cap rules, amounts, payment allocations, notification IDs and receipts.</p>
        <button disabled={busy} onClick={async () => {
            try { setLegacy((await apiRequest('/api/admin/academic-periods/legacy', accessToken)).data) } catch (error) { setError(error.message) }
        }}>Load legacy records</button>
        {legacy && <div className="payment-form">
            <label>Legacy source<select value={selection} onChange={event => { setSelection(event.target.value); setPreview(null) }}><option value="">Choose source</option>
                {legacy.events.map(event => <option key={`e${event.id}`} value={`event:${event.id}`}>Event #{event.id} · {event.organization_name} · {event.name}</option>)}
                {legacy.violations.map(row => <option key={`v${row.id}`} value={`violation:${row.id}`}>Violation #{row.id} · {row.organization_name} · {row.student_number} · {row.violation_name}</option>)}
            </select></label>
            <label>Assign academic period<select value={periodId} onChange={event => { setPeriodId(event.target.value); setPreview(null) }}><option value="">Choose semester</option>
                {periods.map(period => <option key={period.id} value={period.id}>{period.label}</option>)}</select></label>
            <button disabled={busy || !selection || !periodId} onClick={() => classify()}>Preview classification</button>
            {preview && <><p>{preview.period}: {preview.scans} attendance records and {preview.violations} violation records.</p>
                <button disabled={busy} onClick={() => classify(true)}>Confirm classification</button></>}
        </div>}
        </section>
    </section>
}

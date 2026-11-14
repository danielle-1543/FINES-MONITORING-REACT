import { useEffect, useState } from 'react'
import { apiRequest } from '../utils/apiRequest'
import { trackEvent } from '../config/posthog'
import { askConfirmation } from '../utils/confirmation'
import { date } from '../utils/format'

const semesterChangeNote = 'Note: All non-graduated students move to the selected academic year and semester. Year levels follow that academic year in either direction: saved year levels are restored when available; otherwise the current year level is adjusted by the academic-year difference, within 1st–4th Year. Switching semesters within the same academic year does not change year levels. Graduated students remain archived. Make course, section or individual year-level corrections in Student Management using Edit Profile or Multiple edits. Accounts and QR codes stay unchanged.'

export default function AcademicSettings({ accessToken }) {
    const [periods, setPeriods] = useState([])
    const [form, setForm] = useState({ year_start: new Date().getFullYear(), term: 'FIRST', is_current: true })
    const [error, setError] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false)
    const [history, setHistory] = useState([])
    useEffect(() => {
        const controller = new AbortController()
        Promise.all([apiRequest('/api/academic-periods', accessToken, undefined, controller.signal), apiRequest('/api/admin/academic-periods/history', accessToken, undefined, controller.signal)]).then(([periods, history]) => { if (!controller.signal.aborted) { setPeriods(periods.data); setHistory(history.data) } })
            .catch(error => { if (error.name !== 'AbortError') setError(error.message) })
        return () => controller.abort()
    }, [accessToken])
    async function save(values) {
        setBusy(true); setError(''); setMessage('')
        try {
            const current = periods.find(period => Number(period.is_current) === 1)
            const switching = values.is_current && (!current || Number(current.id) !== Number(values.id))
            let payload = values
            if (switching) {
                const preview = (await apiRequest('/api/admin/academic-periods/save', accessToken, { ...values, preview: true })).data
                const promotionMessage = preview.academic_year_changed
                    ? ` Year levels will update for ${preview.year_levels_updated} student(s): ${preview.year_levels_promoted} move to a higher level and ${preview.year_levels_reduced} to a lower level. ${preview.year_levels_restored} saved year level(s) will be restored. ${preview.year_level_review} student(s) need manual review.`
                    : ' Year levels will stay unchanged because the academic year is the same.'
                const confirmed = await askConfirmation({ title: 'Change academic year and semester?', confirmLabel: 'Apply to all students',
                    message: `Are you sure you want to change from ${preview.from || 'no current academic period'} to ${preview.to}? This will automatically update ${preview.students} non-graduated student record(s) to the selected academic year and semester. ${preview.graduates_excluded || 0} graduated student(s) will remain archived.${promotionMessage} Student data from before the change will be saved, and the previous semester will close. Existing fines, attendance and payments will remain in their original semester.`,
                    note: semesterChangeNote })
                if (!confirmed) return
                payload = { ...values, preview: false, fingerprint: preview.fingerprint }
            }
            const result = await apiRequest('/api/admin/academic-periods/save', accessToken, payload)
            setHistory((await apiRequest('/api/admin/academic-periods/history', accessToken)).data)
            setPeriods((await apiRequest('/api/academic-periods', accessToken)).data)
            setMessage(switching ? `Academic year and semester changed. ${result.data.students_updated} student record(s) updated; ${result.data.year_levels_updated} year level(s) updated, including ${result.data.year_levels_restored} restored from saved records. Previous records and student snapshots are saved below.` : 'Academic settings saved.')
            trackEvent('academic_period_updated')
        } catch (error) { setError(error.message) } finally { setBusy(false) }
    }
    return <section className="student-panel payment-page academic-settings">
        <h2>Academic Settings</h2>
        <p>Choose the academic year and semester used for new records. Calendar dates are not required. Changing the current semester requires confirmation, saves the previous student data and updates all students to the new semester. Old fines, attendance and payments keep their original semester.</p>
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
        <p>{semesterChangeNote}</p>
        <div className="student-table"><table><thead><tr><th>Academic period</th><th>Status</th><th>Current</th><th>Actions</th></tr></thead>
            <tbody>{periods.map(period => <tr key={period.id}><td>{period.label}</td><td>{period.status}</td><td>{Number(period.is_current) ? 'Current' : '—'}</td>
                <td><button disabled={busy || Boolean(Number(period.is_current))} onClick={() => save({ ...period, is_current: true, status: 'OPEN' })}>Set current</button>{' '}
                    <button disabled={busy || Boolean(Number(period.is_current))} title={Number(period.is_current) ? 'Switch to another semester to close the current one.' : undefined} onClick={() => save({ ...period, is_current: false, status: period.status === 'OPEN' ? 'CLOSED' : 'OPEN' })}>{period.status === 'OPEN' ? 'Close semester' : 'Reopen semester'}</button></td></tr>)}</tbody></table></div>
        <section className="academic-history-section">
            <h3>Previous semester records</h3>
            <p>Before each semester change, student data is saved here. Original attendance, violations, fines and payments remain under the semester in which they occurred.</p>
            {!history.some(entry => entry.snapshot.from) && <p>No previous semester change has been recorded yet.</p>}
            {history.filter(entry => entry.snapshot.from).map(entry => <details key={entry.id} className="academic-semester-snapshot">
                <summary>{entry.snapshot.from.label} → {entry.snapshot.to.label} · {date(entry.changed_at)}</summary>
                <p>{entry.snapshot.students.length} student records saved before the change.</p>
                {entry.snapshot.academic_year_changed ? <p>{entry.snapshot.year_levels_updated} year level(s) updated; {entry.snapshot.year_levels_restored} restored from saved records.</p>
                    : entry.snapshot.advancing_academic_year && <p>{entry.snapshot.year_levels_promoted} student(s) advanced one year level.</p>}
                <p>Preserved records: {entry.snapshot.records.org_events} events · {entry.snapshot.records.org_scan_records} scan records · {entry.snapshot.records.org_violation_records} violation records · {entry.snapshot.records.payment_claims} payment claims.</p>
                <div className="student-table"><table><thead><tr><th>Student number</th><th>Name</th><th>Course</th><th>Year level</th><th>Section</th></tr></thead>
                    <tbody>{entry.snapshot.students.map(student => <tr key={student.id}><td>{student.student_number}</td><td>{student.full_name}</td><td>{student.course}</td><td>{student.year_level}</td><td>{student.section}</td></tr>)}</tbody>
                </table></div>
            </details>)}
        </section>
    </section>
}

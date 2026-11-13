import { useState } from 'react'
import { apiRequest } from '../utils/apiRequest'
import AcademicPeriodSelect from './AcademicPeriodSelect'

export default function SemesterEnrollment({ student, accessToken, courses, onSaved }) {
    const [form, setForm] = useState({ academic_period_id: '', mode: 'ENROLL', course: student.course, year_level: student.year_level,
        section: student.section, enrollment_status: 'ENROLLED', make_current: true })
    const [error, setError] = useState(''), [busy, setBusy] = useState(false)
    function periodChanged(value) {
        const existing = (student.enrollments || []).find(row => String(row.academic_period_id) === value)
        setForm(current => ({ ...current, ...(existing || {}), academic_period_id: value, mode: existing ? 'CORRECT' : 'ENROLL',
            make_current: existing ? String(student.current_academic_period_id) === value : true }))
    }
    return <section className="student-panel"><h3>Semester enrollment</h3>
        <p>Keep this student’s existing account and QR. Enroll in another semester or correct that semester’s enrollment details.</p>
        {error && <p role="alert">{error}</p>}
        <form className="payment-form" onSubmit={async event => {
            event.preventDefault(); setBusy(true); setError('')
            try { await apiRequest('/api/admin/enrollments/save', accessToken, { ...form, student_id: student.id }); await onSaved() }
            catch (error) { setError(error.message) } finally { setBusy(false) }
        }}>
            <AcademicPeriodSelect accessToken={accessToken} value={form.academic_period_id} onChange={periodChanged} required />
            <p>{form.mode === 'CORRECT' ? 'Correct the selected semester enrollment' : 'Add enrollment for this semester'}</p>
            <label>Program<select value={form.course} onChange={event => setForm({ ...form, course: event.target.value })}>{courses.map(course => <option key={course}>{course}</option>)}</select></label>
            <label>Year level<select value={form.year_level} onChange={event => setForm({ ...form, year_level: event.target.value })}>{['1st Year', '2nd Year', '3rd Year', '4th Year'].map(year => <option key={year}>{year}</option>)}</select></label>
            <label>Section<input required pattern="[A-Za-z]+[1-9][0-9]*" value={form.section} onChange={event => setForm({ ...form, section: event.target.value })} /></label>
            <label>Enrollment status<select value={form.enrollment_status} onChange={event => setForm({ ...form, enrollment_status: event.target.value })}>{['ENROLLED', 'WITHDRAWN', 'COMPLETED'].map(status => <option key={status}>{status}</option>)}</select></label>
            <label><input type="checkbox" checked={form.make_current} onChange={event => setForm({ ...form, make_current: event.target.checked })} />Use these details for the current student profile</label>
            <button disabled={busy || !form.academic_period_id}>{busy ? 'Saving…' : 'Save semester enrollment'}</button>
        </form>
        <div className="student-table"><table><thead><tr><th>Semester</th><th>Program</th><th>Year / Section</th><th>Status</th></tr></thead>
            <tbody>{(student.enrollments || []).map(row => <tr key={row.id}><td>{row.label}</td><td>{row.course}</td><td>{row.year_level} · {row.section}</td><td>{row.enrollment_status}</td></tr>)}</tbody></table></div>
    </section>
}

import AcademicPeriodSelect from '../../components/AcademicPeriodSelect'
import { apiFetch } from '../../utils/apiFetch'
import CalendarInput from '../../components/CalendarInput'
import { useEffect, useState } from 'react'
import { confirmSensitive } from '../../utils/confirmation'
const emptySchedule = {
    label: '',
    academic_period_id: '',
    opens_at: '',
    closes_at: '',
    cap_amount: ''
}
export default function PaymentSchedules({
    accessToken,
    onChanged
}) {
    const [periods, setPeriods] = useState([])
    const [form, setForm] = useState(emptySchedule)
    const [editing, setEditing] = useState(false)
    const [busy, setBusy] = useState(false)
    const [message, setMessage] = useState('')
    const [error, setError] = useState('')
    const [version, setVersion] = useState(0)
    useEffect(() => {
        const controller = new AbortController()
        apiFetch('/api/org/payments/periods', {
            headers: {
                Authorization: `Bearer ${accessToken}`
            },
            cache: 'no-store',
            signal: controller.signal
        }).then(async response => {
            const result = await response.json()
            if (!response.ok || !result.success) {
                throw new Error(result.message || result.error || 'Unable to load schedules.')
            }
            setPeriods(result.data)
        }).catch(reason => {
            if (reason.name !== 'AbortError') {
                setError(reason.message)
            }
        })
        return () => {
            return controller.abort()
        }
    }, [accessToken, version])
    function update(event) {
        setForm({
            ...form,
            [event.target.name]: event.target.value
        })
    }
    async function save(event) {
        event.preventDefault()
        if (busy) {
            return
        }
        setBusy(true)
        setError('')
        setMessage('')
        try {
            await confirmSensitive('/api/org/payments/periods', form)
            const response = await apiFetch('/api/org/payments/periods', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(form)
            })
            const result = await response.json()
            if (!response.ok || !result.success) {
                throw new Error(result.message || result.error || 'Unable to save schedule.')
            }
            setMessage(result.message)
            setEditing(false)
            setVersion(value => {
                return value + 1
            })
            onChanged?.()
        } catch (reason) {
            setError(reason.message)
        } finally {
            setBusy(false)
        }
    }
    return <section className="student-panel payment-schedules">
        <h3>Semester Payment Schedules</h3>
        <p>Set when students can pay your organization. An optional cap covers attendance and violation fines together, per student and semester.</p>
        {error && <p
            role="alert"
            className="account-error"
        >{error}</p>}
        {message && <p
            role="status"
            className="account-success"
        >{message}</p>}
        {!editing && <button
            type="button"
            onClick={() => {
                setForm(emptySchedule)
                setEditing(true)
                setMessage('')
            }}
        >Add Semester</button>}
        {editing && <form
            className="payment-form"
            onSubmit={save}
        >
            {form.id ? <p>{form.label}</p> : <AcademicPeriodSelect accessToken={accessToken} value={form.academic_period_id} onChange={value => setForm({ ...form, academic_period_id: value })} required openOnly defaultCurrent />}
            <label>Payment opens<CalendarInput
                name="opens_at"
                type="datetime-local"
                required
                value={form.opens_at}
                onChange={update}
            /></label>
            <label>Payment closes<CalendarInput
                name="closes_at"
                type="datetime-local"
                required
                min={form.opens_at}
                value={form.closes_at}
                onChange={update}
            /></label>
            <label>Cap per student (PHP, optional)<input
                name="cap_amount"
                type="number"
                min="0.01"
                max="99999999.99"
                step="0.01"
                value={form.cap_amount}
                disabled={Boolean(form.id)}
                onChange={update}
                placeholder="Leave blank for no cap"
            /></label>
            <p>Fines are included only for the selected academic semester. Covered fines and the cap stay fixed after saving; payment times can be edited.</p>
            <div className="payment-schedule-actions">
                <button
                    disabled={busy}
                    type="submit"
                >{busy ? 'Saving…' : 'Save Schedule'}</button>
                <button
                    disabled={busy}
                    type="button"
                    onClick={() => {
                        return setEditing(false)
                    }}
                >Cancel</button>
            </div>
        </form>}
        <div className="student-table">
            <table>
                <thead>
                    <tr>
                        <th>Semester</th>
                        <th>Payment window</th>
                        <th>Student cap</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>{periods.map(period => {
                    return <tr key={period.id}>
                        <td>{period.label}</td>
                        <td>{period.opens_at} to {period.closes_at}</td>
                        <td>{period.cap_amount === null ? 'No cap' : `₱${Number(period.cap_amount).toFixed(2)}`}</td>
                        <td>
                            <button
                                type="button"
                                disabled={busy}
                                onClick={() => {
                                    setForm({
                                        id: period.id,
                                        academic_period_id: period.academic_period_id,
                                        label: period.label,
                                        cap_amount: period.cap_amount ?? '',
                                        opens_at: period.opens_at.replace(' ', 'T').slice(0, 16),
                                        closes_at: period.closes_at.replace(' ', 'T').slice(0, 16)
                                    })
                                    setEditing(true)
                                }}
                            >Edit Payment Window</button>
                        </td>
                    </tr>
                })}</tbody>
            </table>
            {!periods.length && <p>No semester scheduled yet. Students can view fines, but cannot submit payments until a schedule is open.</p>}
        </div>
    </section>
}

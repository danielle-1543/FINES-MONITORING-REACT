import { useEffect, useRef, useState } from 'react'
import { apiRequest } from '../../utils/apiRequest'
import { money } from '../../utils/format'

export default function StudentRecord({ studentId, accessToken, onClose, onUpdated }) {
    const dialog = useRef(null)
    const saveLock = useRef(false)
    const [data, setData] = useState(null)
    const [error, setError] = useState('')
    const [notice, setNotice] = useState('')
    const [version, setVersion] = useState(0)
    const [form, setForm] = useState(null)
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        const element = dialog.current
        element.showModal()
        return () => element.close()
    }, [])

    useEffect(() => {
        const controller = new AbortController()
        apiRequest(`/api/org/students/record?student_id=${studentId}`, accessToken, undefined, controller.signal)
            .then(result => {
                setData(result.data)
                setError('')
            })
            .catch(err => {
                if (err.name !== 'AbortError') {
                    setError(err.message)
                }
            })
        return () => controller.abort()
    }, [studentId, accessToken, version])

    function close() {
        if (!saveLock.current) {
            onClose()
        }
    }

    async function save(event) {
        event.preventDefault()
        if (saveLock.current) {
            return
        }
        saveLock.current = true
        setSaving(true)
        setError('')
        try {
            const result = await apiRequest('/api/org/students/vouchers', accessToken, {
                ...form,
                student_id: studentId,
                expected_available: data.summary.available_to_claim
            })
            setNotice(result.message)
            setForm(null)
            setData(null)
            setVersion(value => value + 1)
            onUpdated?.()
        } catch (err) {
            setError(err.message)
        } finally {
            saveLock.current = false
            setSaving(false)
        }
    }

    const discount = form && data ? (form.discount_type === 'PERCENT'
        ? Math.round(Number(data.summary.available_to_claim) * Number(form.discount_value)) / 100
        : Number(form.discount_value)) : 0

    return <dialog ref={dialog} className="org-dialog org-student-record" aria-label="Student Record"
        onCancel={event => {
            event.preventDefault()
            close()
        }}>
        <div className="org-record-heading">
            <h2>Student Record</h2>
            <button type="button" className="secondary" disabled={saving} onClick={close}>Close</button>
        </div>
        {error && <p role="alert">{error}</p>}
        {notice && <p role="status">{notice}</p>}
        {!data ? <p>Loading student record…</p> : <>
            <h3>{data.student.full_name}</h3>
            <dl className="org-student-details">
                {Object.entries({
                    'Student Number': data.student.student_number,
                    Course: data.student.course,
                    'Year Level': data.student.year_level,
                    Section: data.student.section,
                    Account: data.student.account_status,
                    Activation: data.student.activation_status
                }).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
            </dl>
            <p>Records and discounts issued by your organization only.</p>
            <div className="student-summary">
                {Object.entries({
                    'Total Fines': data.summary.fine_amount,
                    'Amount Due after Reductions': data.summary.outstanding
                }).map(([label, value]) => <div key={label}><span>{label}</span><strong>{money(value)}</strong></div>)}
            </div>
            <div className="org-actions">
                <button disabled={saving || Boolean(form) || Number(data.summary.available_to_claim) <= 0}
                    onClick={() => {
                        setNotice('')
                        setForm({ discount_type: 'PESO', discount_value: '', reason: '', request_key: crypto.randomUUID() })
                    }}>Add Voucher / Discount</button>
                <button className="secondary" disabled={saving} onClick={() => {
                    setForm(null)
                    setVersion(value => value + 1)
                }}>Refresh Record</button>
            </div>
            {form && <form className="org-voucher-form" onSubmit={save}>
                <h3>Add Voucher / Discount</h3>
                <p>Eligible balance: <strong>{money(data.summary.available_to_claim)}</strong>. Paid amounts and pending claims are excluded. The discount applies to existing fines, oldest first.</p>
                <fieldset disabled={saving}>
                    <label className="org-field">Discount type<select value={form.discount_type} onChange={event => setForm({ ...form, discount_type: event.target.value, discount_value: '' })}>
                        <option value="PESO">Peso amount (PHP)</option>
                        <option value="PERCENT">Percentage (%)</option>
                    </select></label>
                    <label className="org-field">{form.discount_type === 'PESO' ? 'Amount (PHP)' : 'Percentage'}<input type="number" min="0.01" step="0.01" required
                        max={form.discount_type === 'PESO' ? data.summary.available_to_claim : '100'}
                        value={form.discount_value} onChange={event => setForm({ ...form, discount_value: event.target.value })} /></label>
                    <label className="org-field">Reason<textarea required maxLength={1000} rows={3} value={form.reason}
                        onChange={event => setForm({ ...form, reason: event.target.value })} /></label>
                </fieldset>
                <p>Discount: <strong>{money(Number.isFinite(discount) ? discount : 0)}</strong>. This will be saved in the student’s voucher history.</p>
                <div className="org-actions">
                    <button disabled={saving}>{saving ? 'Saving…' : 'Apply Discount'}</button>
                    <button type="button" className="secondary" disabled={saving} onClick={() => setForm(null)}>Cancel</button>
                </div>
            </form>}
            <h3>Recorded Fines</h3>
            {!data.fines.length ? <p>No fines recorded for this student.</p> : <div className="org-table"><table>
                <thead><tr><th>Violation / Fine</th><th>Event / Date</th><th>Fine</th><th>Outstanding</th></tr></thead>
                <tbody>{data.fines.map(fine => <tr key={fine.fine_key}>
                    <td>{fine.violation_name}</td><td>{fine.event_name}<small>{fine.recorded_at}</small></td>
                    <td>{money(fine.fine_amount)}</td>
                    <td>{money(fine.outstanding)}</td>
                </tr>)}</tbody>
            </table></div>}
            <h3>Voucher / Discount History</h3>
            {!data.vouchers.length ? <p>No vouchers or discounts yet.</p> : <div className="org-table"><table>
                <thead><tr><th>Date</th><th>Type / Value</th><th>Discount</th><th>Reason</th></tr></thead>
                <tbody>{data.vouchers.map(voucher => <tr key={voucher.id}>
                    <td>{voucher.created_at}</td><td>{voucher.discount_type === 'PERCENT' ? `${voucher.discount_value}%` : money(voucher.discount_value)}</td>
                    <td>{money(voucher.amount)}</td><td>{voucher.reason}</td>
                </tr>)}</tbody>
            </table></div>}
        </>}
    </dialog>
}

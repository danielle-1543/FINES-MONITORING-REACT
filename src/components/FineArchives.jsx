import { useEffect, useState } from 'react'
import { apiRequest } from '../utils/apiRequest'
import { money, date } from '../utils/format'
import { downloadExcel } from '../utils/exportExcel'
import AcademicPeriodSelect from './AcademicPeriodSelect'

export default function FineArchives({ accessToken, role = 'STUDENT', summaryOnly = false }) {
    const [period, setPeriod] = useState(''), [status, setStatus] = useState('ALL')
    const [student, setStudent] = useState(''), [page, setPage] = useState(1), [paymentPage, setPaymentPage] = useState(1)
    const [result, setResult] = useState(null), [error, setError] = useState(''), [exporting, setExporting] = useState(false)
    const query = new URLSearchParams({ academic_period_id: period || '0', status, page, payment_page: paymentPage, student_id: student }).toString()
    useEffect(() => {
        const controller = new AbortController()
        apiRequest(`/api/fine-archives?${query}`, accessToken, undefined, controller.signal).then(response => {
            if (!controller.signal.aborted) { setResult(response.data); setError('') }
        }).catch(error => { if (error.name !== 'AbortError') setError(error.message) })
        return () => controller.abort()
    }, [query, accessToken])
    function choose(value) { setPeriod(value); setPage(1); setPaymentPage(1) }
    async function exportRecords(payments = false) {
        setExporting(true); setError('')
        try {
            const response = await apiRequest(`/api/fine-archives?${query}&export=1`, accessToken)
            downloadExcel({ data: payments ? response.data.payments : response.data.fines,
                columns: payments ? { academic_period_label: 'Academic Period', organization_name: 'Organization', student_number: 'Student Number', full_name: 'Student', id: 'Claim ID', fine_key: 'Fine', allocated_amount: 'Allocated Amount', status: 'Status', method: 'Method', reference_number: 'Reference', submitted_at: 'Submitted', reviewed_at: 'Verified' }
                    : { academic_period_label: 'Academic Period', organization_name: 'Organization', student_number: 'Student Number', full_name: 'Student', fine_key: 'Fine ID', violation_name: 'Fine', event_name: 'Event', fine_amount: 'Original Amount', payable_amount: 'After Reductions', paid_amount: 'Confirmed Paid', pending_amount: 'Pending', outstanding: 'Outstanding', settlement_status: 'Status', recorded_at: 'Recorded At' }
            }, payments ? 'semester-payment-allocations.xlsx' : 'fine-archives.xlsx')
        } catch (error) { setError(error.message) } finally { setExporting(false) }
    }
    const summaries = (result?.summaries || []).filter(row => !period || period === 'all' || String(row.academic_period_id) === period)
    return <section className="student-panel payment-page fine-archives">
        <h2>{summaryOnly ? 'Semester fine summary' : 'Fine Archives'}</h2>
        <p>Records remain in their original academic semester after profile changes and payment. Legacy records stay unassigned until reviewed by the administrator.</p>
        <div className="payment-actions">
            <AcademicPeriodSelect accessToken={accessToken} value={period} onChange={choose} includeAll includeLegacy defaultCurrent />
            {!summaryOnly && <label>Fine status<select value={status} onChange={event => { setStatus(event.target.value); setPage(1) }}>
                {['ALL', 'UNPAID', 'PARTIALLY_PAID', 'PAID', 'SETTLED'].map(value => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}</select></label>}
            {role !== 'STUDENT' && <label>Student database ID (optional)<input type="number" min="1" value={student} onChange={event => { setStudent(event.target.value); setPage(1); setPaymentPage(1) }} /></label>}
        </div>
        {error && <p role="alert">{error}</p>}
        <div className="student-table fine-summary-table"><table><thead><tr><th>Academic semester</th><th>Organization</th><th>Fines</th><th>Original</th><th>After cap/discounts</th><th>Paid</th><th>Pending</th><th>Remaining</th></tr></thead>
            <tbody>{summaries.map(row => <tr key={`${row.academic_period_id}:${row.org_user_id}`}>
                <td><button onClick={() => choose(String(row.academic_period_id))}>{row.academic_period_label}</button></td><td>{row.organization_name}</td><td>{row.count}</td>
                {['original', 'adjusted', 'paid', 'pending', 'outstanding'].map(key => <td key={key}>{money(row[key])}</td>)}
            </tr>)}</tbody></table></div>
        {!summaries.length && !error && <p>{result ? 'No fine assessments in this semester.' : 'Loading semester records…'}</p>}
        {!summaryOnly && result && <>
            <div className="payment-section-heading"><h3>Fine assessments</h3><button disabled={exporting} onClick={() => exportRecords()}>Export semester fines</button></div>
            <div className="student-table"><table><thead><tr><th>Student / Semester</th><th>Organization / Fine</th><th>Original</th><th>After reductions</th><th>Paid</th><th>Remaining</th><th>Status</th></tr></thead>
                <tbody>{result.fines.map(fine => <tr key={fine.fine_key}><td>{fine.full_name}<br />{fine.student_number}<br />{fine.academic_period_label}</td>
                    <td>{fine.organization_name}<br />{fine.violation_name}<br />{fine.event_name}<br />{date(fine.recorded_at)}</td>
                    {['fine_amount', 'payable_amount', 'paid_amount', 'outstanding'].map(key => <td key={key}>{money(fine[key])}</td>)}<td>{fine.settlement_status.replaceAll('_', ' ')}</td></tr>)}</tbody></table></div>
            <nav className="payment-pagination"><span>{result.pagination.total} fines · Page {result.pagination.page} / {result.pagination.pages}</span>
                <button disabled={result.pagination.page <= 1} onClick={() => setPage(result.pagination.page - 1)}>Previous</button>
                <button disabled={result.pagination.page >= result.pagination.pages} onClick={() => setPage(result.pagination.page + 1)}>Next</button></nav>
            <div className="payment-section-heading"><h3>Payment allocations</h3><button disabled={exporting} onClick={() => exportRecords(true)}>Export semester payments</button></div>
            <p>Each row is the amount applied to a fine. A payment can cover multiple fines; pending or cancelled claims do not reduce the confirmed balance.</p>
            <div className="student-table"><table><thead><tr><th>Claim / Fine</th><th>Academic semester</th><th>Amount allocated</th><th>Method / Reference</th><th>Submitted / Verified</th><th>Status</th></tr></thead>
                <tbody>{result.payments.map((payment, index) => <tr key={`${payment.id}:${payment.fine_key}:${index}`}><td>#{payment.id} · {payment.fine_key}<br />{payment.organization_name}<br />{payment.student_number}</td>
                    <td>{payment.academic_period_label}</td><td>{money(payment.allocated_amount)}</td><td>{payment.method}<br />{payment.reference_number || '—'}<br />{payment.receipt_number || ''}</td>
                    <td>{date(payment.submitted_at)}<br />{date(payment.reviewed_at)}</td><td>{payment.status}</td></tr>)}</tbody></table></div>
            <nav className="payment-pagination"><span>{result.payment_pagination.total} allocations · Page {result.payment_pagination.page} / {result.payment_pagination.pages}</span>
                <button disabled={result.payment_pagination.page <= 1} onClick={() => setPaymentPage(result.payment_pagination.page - 1)}>Previous</button>
                <button disabled={result.payment_pagination.page >= result.payment_pagination.pages} onClick={() => setPaymentPage(result.payment_pagination.page + 1)}>Next</button></nav>
        </>}
    </section>
}

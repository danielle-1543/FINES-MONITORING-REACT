import RecordStatus from './RecordStatus'
import { useEffect, useState } from 'react'
import { apiRequest } from '../utils/apiRequest'
import { money, date } from '../utils/format'
import { downloadExcel } from '../utils/exportExcel'
import AcademicPeriodSelect from './AcademicPeriodSelect'
import { paymentPage as paginateRecords } from '../utils/studentPayments'

export default function FineArchives({ accessToken, role = 'STUDENT', summaryOnly = false }) {
    const [period, setPeriod] = useState(''), [status, setStatus] = useState('ALL')
    const [student, setStudent] = useState(''), [page, setPage] = useState(1), [paymentPage, setPaymentPage] = useState(1)
    const [search, setSearch] = useState(''), [summaryPage, setSummaryPage] = useState(1)
    const [result, setResult] = useState(null), [error, setError] = useState(''), [exporting, setExporting] = useState(false)
    const query = new URLSearchParams({ academic_period_id: period || '0', status, page, payment_page: paymentPage, search }).toString()
    useEffect(() => {
        const timer = setTimeout(() => { setSearch(student.trim()); setPage(1); setPaymentPage(1); setSummaryPage(1) }, 300)
        return () => clearTimeout(timer)
    }, [student])
    useEffect(() => {
        const controller = new AbortController()
        apiRequest(`/api/fine-archives?${query}`, accessToken, undefined, controller.signal).then(response => {
            if (!controller.signal.aborted) { setResult(response.data); setError('') }
        }).catch(error => { if (error.name !== 'AbortError') setError(error.message) })
        return () => controller.abort()
    }, [query, accessToken])
    function choose(value) { setPeriod(value); setPage(1); setPaymentPage(1); setSummaryPage(1) }
    async function exportRecords(payments = false) {
        setExporting(true); setError('')
        try {
            const response = await apiRequest(`/api/fine-archives?${query}&export=1`, accessToken)
            downloadExcel({ data: payments ? response.data.student_payments : response.data.fines,
                columns: payments ? { academic_period_label: 'Academic Year / Semester', organization_name: 'Organization', student_number: 'Student Number', full_name: 'Name', total_fine: 'Total Fines', paid_amount: 'Total Amount Paid', method: 'Payment Method', reference_number: 'Reference', status: 'Status', submitted_at: 'Submitted', reviewed_at: 'Verified' }
                    : { academic_period_label: 'Academic Period', organization_name: 'Organization', student_number: 'Student Number', full_name: 'Student', fine_key: 'Fine ID', violation_name: 'Fine', event_name: 'Event', fine_amount: 'Original Amount', payable_amount: 'After Reductions', paid_amount: 'Confirmed Paid', pending_amount: 'Pending', outstanding: 'Outstanding', settlement_status: 'Status', recorded_at: 'Recorded At' }
            }, payments ? 'semester-student-payments.xlsx' : 'fine-archives.xlsx')
        } catch (error) { setError(error.message) } finally { setExporting(false) }
    }
    const summaries = (result?.summaries || []).filter(row => !period || period === 'all' || String(row.academic_period_id) === period)
    const summaryPagination = paginateRecords(summaries, summaryPage, 10)
    return <section className="student-panel payment-page fine-archives">
        <h2>{summaryOnly ? 'Semester fine summary' : 'Fine Archives'}</h2>
        <p>Records remain in their original academic semester after profile changes and payment. Legacy records stay unassigned until reviewed by the administrator.</p>
        <div className="payment-actions table-toolbar">
            <AcademicPeriodSelect accessToken={accessToken} value={period} onChange={choose} includeAll includeLegacy defaultCurrent />
            {!summaryOnly && <label>Fine status<select value={status} onChange={event => { setStatus(event.target.value); setPage(1) }}>
                {['ALL', 'UNPAID', 'PARTIALLY_PAID', 'PAID', 'SETTLED'].map(value => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}</select></label>}
            {role !== 'STUDENT' && <label>Search student<input type="search" maxLength={150} placeholder="Student ID, name or section" value={student} onChange={event => setStudent(event.target.value)} /></label>}
        </div>
        {error && <p role="alert">{error}</p>}
        <div className="student-table fine-summary-table"><table className="system-table"><thead><tr><th>Academic semester</th><th>Organization</th><th>Fines</th><th className="table-number">Original</th><th className="table-number">After cap/discounts</th><th className="table-number">Paid</th><th className="table-number">Pending</th><th className="table-number">Remaining</th></tr></thead>
            <tbody>{summaryPagination.rows.map(row => <tr key={`${row.academic_period_id}:${row.org_user_id}`}>
                <td><button onClick={() => choose(String(row.academic_period_id))}>{row.academic_period_label}</button></td><td>{row.organization_name}</td><td>{row.count}</td>
                {['original', 'adjusted', 'paid', 'pending', 'outstanding'].map(key => <td key={key}>{money(row[key])}</td>)}
            </tr>)}</tbody></table></div>
        {summaryPagination.pages > 1 && <nav className="payment-pagination" aria-label="Semester summary pages">
            <span>Page {summaryPagination.page} / {summaryPagination.pages}</span>
            <button disabled={summaryPagination.page <= 1} onClick={() => setSummaryPage(summaryPagination.page - 1)}>Previous</button>
            <button disabled={summaryPagination.page >= summaryPagination.pages} onClick={() => setSummaryPage(summaryPagination.page + 1)}>Next</button>
        </nav>}
        {!summaries.length && !error && <p>{result ? 'No fine assessments in this semester.' : 'Loading semester records…'}</p>}
        {!summaryOnly && result && <>
            <div className="payment-section-heading"><h3>Fine assessments</h3><button disabled={exporting} onClick={() => exportRecords()}>Export semester fines</button></div>
            <div className="student-table"><table className="system-table"><thead><tr><th>Student / Semester</th><th>Organization / Fine</th><th className="table-number">Original</th><th className="table-number">After reductions</th><th className="table-number">Paid</th><th className="table-number">Remaining</th><th>Status</th></tr></thead>
                <tbody>{!result.fines.length && <tr><td colSpan={7}>No fine assessments match these filters.</td></tr>}{result.fines.map(fine => <tr key={fine.fine_key}><td>{fine.full_name}<br />{fine.student_number}<br />{fine.academic_period_label}</td>
                    <td>{fine.organization_name}<br />{fine.violation_name}<br />{fine.event_name}<br />{date(fine.recorded_at)}</td>
                    {['fine_amount', 'payable_amount', 'paid_amount', 'outstanding'].map(key => <td key={key}>{money(fine[key])}</td>)}<td><RecordStatus value={fine.settlement_status} /></td></tr>)}</tbody></table></div>
            <nav className="payment-pagination"><span>{result.pagination.total} fines · Page {result.pagination.page} / {result.pagination.pages}</span>
                <button disabled={result.pagination.page <= 1} onClick={() => setPage(result.pagination.page - 1)}>Previous</button>
                <button disabled={result.pagination.page >= result.pagination.pages} onClick={() => setPage(result.pagination.page + 1)}>Next</button></nav>
            <div className="payment-section-heading"><h3>Student payment records</h3><button disabled={exporting} onClick={() => exportRecords(true)}>Export semester payments</button></div>
            <p>One row per student, organization and semester. Total fines includes caps and discounts; total paid includes verified payments only. Dates show the latest submission and verification.</p>
            <div className="student-table"><table className="system-table"><thead><tr><th>Academic year / Semester</th><th>Student number</th><th>Name</th><th className="table-number">Total fines</th><th className="table-number">Total amount paid</th><th>Payment method</th><th>Reference</th><th>Status</th><th>Submitted</th><th>Verified</th></tr></thead>
                <tbody>{!result.student_payments.length && <tr><td colSpan={10}>No student payments match these filters.</td></tr>}{result.student_payments.map(payment => <tr key={payment.id}>
                    <td>{payment.academic_period_label}</td><td>{payment.student_number}</td><td>{payment.full_name}<br /><small>{payment.organization_name}</small></td>
                    <td className="table-number">{money(payment.total_fine)}</td><td className="table-number">{money(payment.paid_amount)}</td>
                    <td>{payment.method}</td><td>{payment.reference_number || '—'}</td><td><RecordStatus value={payment.status} /></td>
                    <td>{date(payment.submitted_at)}</td><td>{date(payment.reviewed_at)}</td></tr>)}</tbody></table></div>
            <nav className="payment-pagination"><span>{result.student_payment_pagination.total} student payment records · Page {result.student_payment_pagination.page} / {result.student_payment_pagination.pages}</span>
                <button disabled={result.student_payment_pagination.page <= 1} onClick={() => setPaymentPage(result.student_payment_pagination.page - 1)}>Previous</button>
                <button disabled={result.student_payment_pagination.page >= result.student_payment_pagination.pages} onClick={() => setPaymentPage(result.student_payment_pagination.page + 1)}>Next</button></nav>
        </>}
    </section>
}

import { useEffect, useState } from 'react'
import { apiRequest } from '../../utils/apiRequest'
import { money, date } from '../../utils/format'
import '../../css/student/FineArchives.css'

const summaryFields = [
    ['original', 'Total Original Fines'],
    ['cap_adjustment', 'Organization Fine Cap (deducted)'],
    ['discount', 'Discounts / Vouchers (deducted)'],
    ['payable', 'Final Amount Payable'],
    ['paid', 'Total Amount Paid (verified)'],
    ['outstanding', 'Remaining Balance']
]

export default function StudentFineArchives({ accessToken }) {
    const [response, setResponse] = useState(null), [error, setError] = useState(null)
    const [organization, setOrganization] = useState('all'), [version, setVersion] = useState(0)
    const data = response?.token === accessToken ? response.data : null
    const failure = error?.token === accessToken ? error.message : ''
    useEffect(() => {
        const controller = new AbortController()
        apiRequest('/api/fine-archives', accessToken, undefined, controller.signal).then(result => {
            if (!controller.signal.aborted) { setResponse({ token: accessToken, data: result.data }); setError(null) }
        }).catch(reason => { if (!controller.signal.aborted) setError({ token: accessToken, message: reason.message }) })
        return () => controller.abort()
    }, [accessToken, version])
    const selected = data?.organizations.some(item => String(item.id) === organization) ? organization : 'all'
    const records = (data?.records || []).filter(record => selected === 'all' || String(record.organization_id) === selected)
    return <section className="student-panel personal-fine-archives" aria-labelledby="personal-archives-title">
        <header><h2 id="personal-archives-title">Fine Archives</h2>
            <p>Your fines and absences for the current academic semester.</p>
            {data?.current_period && <p className="personal-archives-period">AY {data.current_period.label} · Current</p>}
        </header>
        {failure ? <div role="alert" className="account-error"><p>{failure}</p><button onClick={() => setVersion(value => value + 1)}>Try again</button></div>
            : !data ? <p role="status">Loading your current semester records…</p>
                : !data.current_period ? <p role="status">No open current academic semester is configured. Please contact the administrator.</p>
                    : <>
                        <label className="personal-archives-filter">Organization<select value={selected} onChange={event => setOrganization(event.target.value)}>
                            <option value="all">All Organizations</option>
                            {data.organizations.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                        </select></label>
                        <h3>Fine and absence records</h3>
                        <ol className="personal-archives-records">
                            {records.map(record => <li key={record.id}>
                                <div><strong>{record.description}</strong><span>{record.organization_name} · {record.type}</span>
                                    <time dateTime={record.recorded_at.replace(' ', 'T') + '+08:00'}>{date(record.recorded_at)}</time></div>
                                <span className="personal-archives-amount">{money(record.fine_amount)}</span>
                            </li>)}
                        </ol>
                        {!records.length && <p className="personal-archives-empty">No fines or absences for {selected === 'all' ? 'this semester' : 'this organization in the current semester'}.</p>}
                        <section className="personal-archives-summary" aria-labelledby="personal-summary-title">
                            <h3 id="personal-summary-title">Personal fine summary</h3>
                            <p>Current semester · All organizations</p>
                            <h4>Organization breakdown</h4>
                            <dl>{data.organizations.map(item => <div key={item.id}><dt>{item.name} · Original fines</dt><dd>{money(item.original)}</dd></div>)}</dl>
                            {!data.organizations.length && <p>No fines assessed this semester.</p>}
                            <h4>Financial summary</h4>
                            <dl>{summaryFields.map(([key, label]) => <div key={key} className={key === 'outstanding' || key === 'payable' ? 'personal-archives-total' : ''}>
                                <dt>{label}</dt><dd>{money(data.summary[key])}</dd>
                            </div>)}</dl>
                        </section>
                        <p className="personal-archives-note">Fine totals reflect the original assessments. Applicable organization fine caps and approved discounts or vouchers are deducted to determine the final amount payable. Only verified payments are included.</p>
                    </>}
    </section>
}

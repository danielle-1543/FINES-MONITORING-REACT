import { useEffect, useRef, useState } from 'react'
import { money, date } from '../utils/format'
import { paymentOrganizations, paymentBlockReason, paymentPage } from '../utils/studentPayments'

function Pages({ result, onChange, label }) {
    return <nav className="payment-pagination" aria-label={label}>
        <span>{result.total} records · Page {result.page} of {result.pages}</span>
        <button type="button" disabled={result.page <= 1} onClick={() => onChange(result.page - 1)}>Previous</button>
        <button type="button" disabled={result.page >= result.pages} onClick={() => onChange(result.page + 1)}>Next</button>
    </nav>
}

export default function StudentPaymentWorkspace({ data, busy, onManualPayment, onXendit, requestError }) {
    const groups = paymentOrganizations(data)
    const [fineOrg, setFineOrg] = useState('')
    const [finePages, setFinePages] = useState({})
    const [fineStatus, setFineStatus] = useState('ALL')
    const [schedulePage, setSchedulePage] = useState(1)
    const [payOrg, setPayOrg] = useState('')
    const [method, setMethod] = useState('')
    const [reference, setReference] = useState('')
    const [proof, setProof] = useState(null)
    const [error, setError] = useState('')
    const checkout = useRef(null)
    const formRef = useRef(null)
    useEffect(() => {
        if (payOrg) {
            checkout.current?.focus()
            checkout.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
    }, [payOrg])
    const active = groups.find(group => group.id === fineOrg) || groups.find(group => group.fines.length) || groups[0]
    const fineResults = paymentPage(active?.fines.filter(fine => fineStatus === 'ALL' || fine.payment_status === fineStatus) || [], finePages[active?.id])
    const schedules = groups.filter(group => group.eligible).flatMap(group => group.schedules.length
        ? group.schedules.map(schedule => ({ group, schedule })) : [{ group, schedule: null }])
    const scheduleResults = paymentPage(schedules, schedulePage)
    const selected = groups.find(group => group.id === payOrg && group.eligible)
    const blocked = selected ? paymentBlockReason(selected) : ''
    const payable = groups.filter(group => !paymentBlockReason(group))
    const openPayment = id => {
        setPayOrg(id)
        setMethod('')
        setReference('')
        setProof(null)
        setError('')
        formRef.current?.reset()
    }
    async function submit(event) {
        event.preventDefault()
        if (!selected || blocked || !method || busy) return
        setError('')
        if (method === 'XENDIT_TEST') {
            await onXendit(selected.id)
            return
        }
        const body = new FormData()
        body.set('fine_key', 'ALL')
        body.set('organization_id', selected.id)
        body.set('amount', (selected.payable / 100).toFixed(2))
        body.set('method', method)
        body.set('reference_number', reference)
        if (proof) body.set('proof', proof)
        if (await onManualPayment(body)) {
            setPayOrg('')
            setMethod('')
            setProof(null)
            setReference('')
        }
    }
    return <>
        <div className="payment-org-cards">
            <article className="payment-org-card payment-combined-card">
                <span>Total fines · All organizations</span>
                <strong>{money(groups.reduce((sum, group) => sum + group.total, 0) / 100)}</strong>
                <p>Original fine amount before cap and discounts: {money(groups.reduce((sum, group) => sum + group.originalTotal, 0) / 100)}</p>
                <p>Remaining balance: <b>{money(groups.reduce((sum, group) => sum + group.outstanding, 0) / 100)}</b></p>
            </article>
            {groups.map(group => <article className="payment-org-card" key={group.id}>
                <span>{group.name} · Total fines</span>
                <strong>{money(group.total / 100)}</strong>
                <p>Original fine amount before cap and discounts: {money(group.originalTotal / 100)}</p>
                <p>Remaining balance: <b>{money(group.outstanding / 100)}</b> · Pending: {money(group.pending / 100)}</p>
                <button type="button" onClick={() => setFineOrg(group.id)}>View fines</button>
            </article>)}
        </div>

        <section className="student-panel">
            <div className="payment-section-heading"><h3>Fines by organization</h3>
                <label>Status <select value={fineStatus} onChange={event => { setFineStatus(event.target.value); setFinePages({}) }}>
                    <option value="ALL">All fines</option><option value="UNPAID">Unpaid</option><option value="PAID">Paid</option>
                </select></label>
            </div>
            <div className="payment-org-tabs" role="group" aria-label="Choose organization fines">
                {groups.map(group => <button key={group.id} type="button" aria-pressed={active?.id === group.id}
                    onClick={() => setFineOrg(group.id)}>{group.name} ({group.fines.length})</button>)}
            </div>
            {active ? <>
                <h4>{active.name}</h4>
                {!active.eligible && <p className="payment-state-note">{paymentBlockReason(active)}</p>}
                <div className="student-table"><table>
                    <thead><tr><th>Fine / Event</th><th>Original</th><th>Reductions</th><th>Paid</th><th>Remaining</th><th>Status</th></tr></thead>
                    <tbody>{fineResults.rows.map(fine => <tr key={fine.fine_key}>
                        <td>{fine.violation_name || 'Fine'}<small className="payment-window">{fine.event_name}</small></td>
                        <td>{money(fine.fine_amount)}</td>
                        <td>{money(Number(fine.cap_adjustment || 0) + Number(fine.discount_amount || 0))}</td>
                        <td>{money(fine.paid_amount)}</td><td>{money(fine.outstanding)}</td>
                        <td>{fine.payment_status === 'PAID' ? 'Paid' : 'Unpaid'}{Number(fine.pending_amount) > 0 && <small className="payment-window">{money(fine.pending_amount)} pending</small>}</td>
                    </tr>)}</tbody>
                </table></div>
                {!fineResults.total && <p>No fines match this filter.</p>}
                <Pages result={fineResults} label={`${active.name} fines pages`} onChange={page => setFinePages(current => ({ ...current, [active.id]: page }))} />
            </> : <p>No fines recorded.</p>}
        </section>

        <section className="student-panel">
            <h3>Payment schedules</h3>
            <p>Only organizations that cover your current program appear here. Choose an open schedule, then select Pay fines.</p>
            <div className="student-table"><table>
                <thead><tr><th>Organization / Semester</th><th>Payment window</th><th>Status</th><th>Payable to organization now</th><th>Action</th></tr></thead>
                <tbody>{scheduleResults.rows.map(({ group, schedule }) => {
                    const reason = paymentBlockReason(group, schedule)
                    return <tr key={`${group.id}:${schedule?.id || 'none'}`}>
                        <td>{group.name}<small className="payment-window">{schedule?.label || 'Not scheduled'}</small>
                            {schedule?.cap_amount != null && <small className="payment-window">Semester cap: {money(schedule.cap_amount)}</small>}</td>
                        <td>{schedule ? <>{date(schedule.opens_at)}<br />to {date(schedule.closes_at)}</> : 'Not published'}</td>
                        <td>{schedule ? { OPEN: 'Open', UPCOMING: 'Upcoming', CLOSED: 'Closed' }[schedule.payment_window] : 'Not scheduled'}</td>
                        <td>{money(group.payable / 100)}</td>
                        <td><button type="button" disabled={busy || Boolean(reason)} onClick={() => openPayment(group.id)}>Pay fines</button>
                            {reason && <small className="payment-window">{reason}</small>}</td>
                    </tr>
                })}</tbody>
            </table></div>
            {!schedules.length && <p>No eligible organizations are configured for your program. Contact the administrator.</p>}
            <Pages result={scheduleResults} label="Payment schedule pages" onChange={setSchedulePage} />
        </section>

        {selected && <section className="student-panel payment-checkout" tabIndex={-1} ref={checkout} aria-label={`Pay fines to ${selected.name}`}>
            <div className="payment-section-heading"><h3>Pay fines · {selected.name}</h3>
                <button type="button" disabled={busy} onClick={() => setPayOrg('')}>Close payment form</button></div>
            <p>Includes the full payable balance for this organization across its open schedules. Caps, discounts, and confirmed payments are applied automatically.</p>
            {blocked && <p role="alert" className="payment-state-note">{blocked}</p>}
            {error && <p role="alert" className="account-error">{error}</p>}
            {requestError && <p role="alert" className="account-error">{requestError}</p>}
            <form className="payment-form" onSubmit={submit} ref={formRef}>
                <label>Organization<select value={selected.id} disabled={busy} onChange={event => openPayment(event.target.value)}>
                    {!payable.some(group => group.id === selected.id) && <option value={selected.id}>{selected.name}</option>}
                    {payable.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}
                </select></label>
                <label>Amount (PHP)<input value={(selected.payable / 100).toFixed(2)} readOnly /></label>
                <label>Payment method<select required value={method} disabled={busy || Boolean(blocked)} onChange={event => {
                    setMethod(event.target.value); setProof(null); setReference(''); setError('')
                }}><option value="">Choose payment method</option><option value="CASH">Cash</option>
                    <option value="GCASH">GCash — manual verification</option><option value="XENDIT_TEST">Xendit — test checkout</option></select></label>
                {method === 'XENDIT_TEST' && <div className="payment-total-note">
                    <h4>Xendit test checkout</h4><p>No real funds are collected. Completing the simulation updates the demo balance and creates a TEST receipt.</p>
                    <p>You will choose an available payment channel on Xendit’s hosted checkout. Payment is confirmed only after provider verification.</p>
                </div>}
                {method === 'CASH' && <p>Submit a claim after paying {selected.name}. The organization verifies receipt before the balance changes.</p>}
                {method === 'GCASH' && <>
                    <div className="gcash-test-qr"><h4>{selected.name} · GCash</h4>
                        <img src="/gcash-payment-qr.png" width="240" height="240" alt="GCash payment QR" />
                        <p>Confirm the recipient with {selected.name} before paying.</p>
                        <strong>{money(selected.payable / 100)}</strong></div>
                    <label>GCash reference number<input required minLength={6} maxLength={100} pattern="[A-Za-z0-9-]{6,100}" value={reference} disabled={busy}
                        onChange={event => setReference(event.target.value)} /></label>
                </>}
                {method && method !== 'XENDIT_TEST' && <>
                    <label>Proof of payment {method === 'GCASH' ? '(required)' : '(optional)'}<input key={method} type="file" required={method === 'GCASH'} disabled={busy}
                        accept="image/jpeg,image/png,application/pdf" onChange={event => {
                            const file = event.target.files[0]
                            if (file?.size > 5242880) { setError('Proof must be 5 MB or smaller.'); event.target.value = ''; setProof(null) }
                            else { setProof(file || null); setError('') }
                        }} /></label><small>JPEG, PNG or PDF, up to 5 MB.</small>
                </>}
                <button type="submit" disabled={busy || !method || Boolean(blocked)}>{busy ? 'Please wait…' : method === 'XENDIT_TEST' ? 'Continue to Xendit test checkout' : 'Submit payment claim'}</button>
            </form>
        </section>}
    </>
}

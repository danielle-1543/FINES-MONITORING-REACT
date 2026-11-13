import { apiFetch } from '../../utils/apiFetch'
import { xenditCheckoutUrl } from '../../utils/xenditCheckout'
import { confirmSensitive } from '../../utils/confirmation'
import { money, date } from '../../utils/format'
import { useEffect, useRef, useState } from 'react'
import { downloadExcel } from '../../utils/exportExcel'
import '../../css/student/Payments.css'
import PaymentSchedules from '../organization/PaymentSchedules'
import StudentPaymentWorkspace from '../../components/StudentPaymentWorkspace'
import { paymentPage } from '../../utils/studentPayments'
export default function Payments({
    accessToken,
    organization = false,
    onChanged
}) {
    const [data, setData] = useState(null),
        [error, setError] = useState(''),
        [notice, setNotice] = useState(() => new URLSearchParams(window.location.search).has('xendit')
            ? 'You returned from Xendit test checkout. Payment is confirmed only after provider verification. Refresh or check the pending payment status below.' : '')
    const [version, setVersion] = useState(0),
        [busy, setBusy] = useState(false),
        [status, setStatus] = useState('ALL')
    const [historyPage, setHistoryPage] = useState(1)
    const [receipt, setReceipt] = useState(null),
        [review, setReview] = useState(null),
        [note, setNote] = useState('')
    const dialog = useRef(null),
        lock = useRef(false)
    async function request(path, body) {
        await confirmSensitive(path, body)
        const response = await apiFetch(`/api/${path}`, {
            method: body === undefined ? 'GET' : 'POST',
            headers: {
                Accept: 'application/json',
                Authorization: `Bearer ${accessToken}`,
                ...(body && !(body instanceof FormData) ? {
                    'Content-Type': 'application/json'
                } : {})
            },
            body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
            cache: 'no-store'
        })
        const result = await response.json().catch(() => {
            throw new Error('The API returned an invalid response.')
        })
        if (!response.ok || !result.success) {
            throw new Error(result.message || result.error || 'Request failed.')
        }
        return result
    }
    useEffect(() => {
        const controller = new AbortController()
        apiFetch(`/api/${organization ? 'org/payments' : 'student/payments'}`, {
            headers: {
                Accept: 'application/json',
                Authorization: `Bearer ${accessToken}`
            },
            cache: 'no-store',
            signal: controller.signal
        }).then(async response => {
            const result = await response.json()


            
            if (!response.ok || !result.success) {
                throw new Error(result.message || result.error || 'Unable to load payments.')
            }
            setData(result.data)
            setError('')
        }).catch(err => {
            if (err.name !== 'AbortError') {
                setError(err.message)
            }
        })
        return () => {
            return controller.abort()
        }
    }, [accessToken, organization, version])
    useEffect(() => {
        if (receipt) {
            dialog.current.showModal()
        }
    }, [receipt])
    useEffect(() => {
        const timer = setInterval(() => {
            return setVersion(v => {
                return v + 1
            })
        }, 30000)
        return () => {
            return clearInterval(timer)
        }
    }, [])
    async function action(path, body) {
        if (lock.current) {
            return false
        }
        lock.current = true
        setBusy(true)
        setError('')
        setNotice('')
        try {
            const result = await request(path, body)
            setNotice(result.message)
            setVersion(v => {
                return v + 1
            })
            onChanged?.()
            return true
        } catch (err) {
            setError(err.message)
            return false
        } finally {
            lock.current = false
            setBusy(false)
        }
    }
    async function showReceipt(id) {
        try {
            const result = await request(`payments/receipt?id=${id}`)
            setReceipt(result.data)
        } catch (err) {
            setError(err.message)
        }
    }
    async function xenditCheckout(organizationId, claimId = null, resume = false, selection = {}) {
        if (lock.current) return
        lock.current = true
        setBusy(true)
        setError('')
        setNotice('')
        try {
            const result = claimId === null
                ? await request('student/payments/xendit/checkout', { ...selection, organization_id: organizationId })
                : await request(`student/payments/xendit/status?id=${claimId}`)
            const payment = result.data
            setVersion(v => v + 1)
            onChanged?.()
            if ((claimId === null || resume) && payment.checkout_url && payment.status === 'PENDING') {
                window.location.assign(xenditCheckoutUrl(payment.checkout_url))
            } else {
                setNotice(payment.status === 'CONFIRMED'
                    ? 'TEST PAYMENT confirmed. No real funds were collected. Your demo balance and receipt are updated.'
                    : payment.status === 'CANCELLED' ? 'Test checkout closed without a confirmed payment.'
                        : 'Test payment is awaiting confirmation. You can resume the existing checkout; do not create another payment.')
            }
        } catch (err) {
            setError(err.message || 'Unable to open Xendit checkout.')
            setVersion(v => v + 1)
        } finally {
            lock.current = false
            setBusy(false)
        }
    }
    async function getProof(id) {
        try {
            const response = await apiFetch(`/api/payments/proof?id=${id}`, {
                responseType: 'blob',
                headers: {
                    Authorization: `Bearer ${accessToken}`
                }
            })
            if (!response.ok) {
                const result = await response.json()
                throw new Error(result.error || 'Proof unavailable.')
            }
            const blob = await response.blob(),
                url = URL.createObjectURL(blob),
                link = document.createElement('a')
            link.href = url
            link.download = `payment-proof-${id}.${blob.type === 'application/pdf' ? 'pdf' : blob.type === 'image/png' ? 'png' : 'jpg'}`
            link.click()
            setTimeout(() => {
                return URL.revokeObjectURL(url)
            }, 5000)
        } catch (err) {
            setError(err.message)
        }
    }
    if (!data) {
        return <section className="student-panel">
            <h2>Payments</h2>
            <p role={error ? 'alert' : undefined}>{error || 'Loading payments…'}</p>
        </section>
    }
    const claims = organization ? data : data.claims
    const history = paymentPage(claims.filter(claim => status === 'ALL' || claim.status === status), historyPage, 10)
    return <section className="payment-page">
        <h2>{organization ? 'Payment Claim Review' : 'Payment Management'}</h2>
        {error && <p
            role="alert"
            className="account-error"
        >{error}</p>}
        {notice && <p
            role="status"
            className="account-success"
        >{notice}</p>}
        <button
            type="button"
            disabled={busy}
            onClick={() => {
                return setVersion(v => {
                    return v + 1
                })
            }}
        >Refresh</button>
        {organization && <PaymentSchedules
            accessToken={accessToken}
            onChanged={onChanged}
        />}
        {!organization && <StudentPaymentWorkspace data={data} busy={busy} requestError={error} accessToken={accessToken}
            onManualPayment={body => action('student/payments/submit', body)}
            onXendit={(id, selection) => xenditCheckout(id, null, false, selection)} />}
        <section className="student-panel">
            <h3>{organization ? 'Claims to Review' : 'Payment Overview & History'}</h3>
            <div className="payment-counts">{['PENDING', 'CONFIRMED', 'REJECTED', 'CANCELLED'].map(v => {
                return <span key={v}>{v}: {claims.filter(c => {
                    return c.status === v
                }).length}</span>
            })}</div>
            <label>Claim status <select
                value={status}
                onChange={e => {
                    setStatus(e.target.value)
                    setHistoryPage(1)
                }}
            >{['ALL', 'PENDING', 'CONFIRMED', 'REJECTED', 'CANCELLED'].map(v => {
                return <option key={v}>{v}</option>
            })}</select></label>
            <div className="student-table">
                <table>
                    <thead>
                        <tr>
                            {organization && <th>Student</th>}
                            <th>Organization / Fine</th>
                            <th>Amount</th>
                            <th>Method / Reference</th>
                            <th>Submitted</th>
                            <th>Reviewed</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {history.rows.map(c => {
                            return <tr key={c.id}>
                                {organization && <td>
                                    {c.full_name}
                                    <br />
                                    {c.student_number}
                                </td>}
                                <td>
                                    {c.organization_name}
                                    <br />
                                    {Number(c.fine_count) > 0 ? `All fines (${c.fine_count} items)` : c.fine_key}
                                </td>
                                <td>{money(c.amount)}</td>
                                <td>
                                    {c.method}
                                    <br />
                                    {c.reference_number || '—'}
                                </td>
                                <td>{date(c.submitted_at)}</td>
                                <td>{date(c.reviewed_at)}</td>
                                <td>
                                    {c.status}
                                    {c.review_note && <p>{c.review_note}</p>}
                                </td>
                                <td className="payment-actions">
                                    {Boolean(Number(c.has_proof)) && <button onClick={() => {
                                        return getProof(c.id)
                                    }}>Download Proof</button>}
                                    {c.status === 'CONFIRMED' && <button
                                        onClick={() => {
                                            return showReceipt(c.id)
                                        }}
                                    >View Receipt</button>}
                                    {c.status === 'PENDING' && c.method === 'XENDIT_TEST' && (organization
                                        ? <span>Awaiting Xendit test confirmation</span>
                                        : <><button type="button" disabled={busy} onClick={() => xenditCheckout(null, c.id)}>Check Xendit status</button>
                                            <button type="button" disabled={busy} onClick={() => xenditCheckout(null, c.id, true)}>Resume test checkout</button></>)}
                                    {c.status === 'PENDING' && c.method !== 'XENDIT_TEST' && (organization ? <button
                                        disabled={busy}
                                        onClick={() => {
                                            setReview(c)
                                            setNote('')
                                        }}
                                    >Review</button> : <button
                                        disabled={busy}
                                        onClick={() => {
                                            return action('student/payments/cancel', {
                                                id: c.id
                                            })
                                        }}
                                    >Cancel Claim</button>)}
                                </td>
                            </tr>
                        })}
                    </tbody>
                </table>
                {!history.total && <p>No payment claims match this filter.</p>}
            </div>
            <nav className="payment-pagination" aria-label="Payment history pages">
                <span>{history.total} records · Page {history.page} of {history.pages}</span>
                <button type="button" disabled={history.page <= 1} onClick={() => setHistoryPage(history.page - 1)}>Previous</button>
                <button type="button" disabled={history.page >= history.pages} onClick={() => setHistoryPage(history.page + 1)}>Next</button>
            </nav>
        </section>
        {organization && review && <section className="student-panel">
            <h3>Review Claim #{review.id}</h3>
            <p>{review.full_name} · {money(review.amount)} · {review.method}</p>
            <p>Confirm only after verifying the cash or GCash payment was actually received.</p>
            <label>Review note / rejection reason<textarea
                maxLength={500}
                value={note}
                onChange={e => {
                    return setNote(e.target.value)
                }}
            /></label>
            <div className="payment-actions">
                <button
                    disabled={busy}
                    onClick={async () => {
                        if (await action('org/payments/review', {
                            id: review.id,
                            decision: 'CONFIRMED',
                            note
                        })) {
                            setReview(null)
                        }
                    }}
                >Confirm Payment Received</button>
                <button
                    disabled={busy || !note.trim()}
                    onClick={async () => {
                        if (await action('org/payments/review', {
                            id: review.id,
                            decision: 'REJECTED',
                            note
                        })) {
                            setReview(null)
                        }
                    }}
                >Reject Claim</button>
                <button
                    disabled={busy}
                    onClick={() => {
                        return setReview(null)
                    }}
                >Back</button>
            </div>
        </section>}
        <dialog
            ref={dialog}
            className="payment-receipt"
            onCancel={() => {
                return setReceipt(null)
            }}
        >{receipt && <><h2>{receipt.method === 'XENDIT_TEST' ? 'TEST PAYMENT RECEIPT — No real funds collected' : 'Confirmed Payment Receipt'}</h2><dl>{Object.entries(receipt).map(([key, value]) => {
            return <div key={key}>
                <dt>{key.replaceAll('_', ' ')}</dt>
                <dd>{key === 'amount' ? money(value) : value || '—'}</dd>
            </div>
        })}</dl>
            <button
                onClick={() => {
                    return downloadExcel({
                        columns: {
                            receipt_number: 'Receipt Number',
                            full_name: 'Student Name',
                            student_number: 'Student Number',
                            organization_name: 'Organization',
                            amount: 'Amount (PHP)',
                            method: 'Method',
                            reference_number: 'Reference',
                            reviewed_at: 'Confirmed At'
                        },
                        data: [receipt]
                    }, `${receipt.receipt_number}.xlsx`)
                }}
            >Download Excel Receipt</button>
            <button
                onClick={() => {
                    dialog.current.close()
                    setReceipt(null)
                }}
            >Close</button></>}</dialog>
    </section>
}

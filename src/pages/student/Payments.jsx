import { apiFetch } from '../../utils/apiFetch'
import { confirmSensitive } from '../../utils/confirmation'
import { money, date } from '../../utils/format'
import { useEffect, useRef, useState } from 'react'
import { downloadExcel } from '../../utils/exportExcel'
import '../../css/student/Payments.css'
import PaymentSchedules from '../organization/PaymentSchedules'
export default function Payments({
    accessToken,
    organization = false,
    onChanged
}) {
    const [data, setData] = useState(null),
        [error, setError] = useState(''),
        [notice, setNotice] = useState('')
    const [version, setVersion] = useState(0),
        [busy, setBusy] = useState(false),
        [status, setStatus] = useState('ALL'),
        [fineStatus, setFineStatus] = useState('ALL')
    const [form, setForm] = useState({
        fine_key: '',
        amount: '',
        method: 'CASH',
        reference_number: ''
    }),
        [proof, setProof] = useState(null)
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
    async function getProof(id) {
        try {
            const response = await apiFetch(`/api/payments/proof?id=${id}`, {
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
    const payableGroups = []
    if (!organization) {
        for (const fine of data.fines) {
            const cents = Math.round(Number(fine.available_to_claim) * 100)
            if (cents <= 0 || fine.payment_window !== 'OPEN' || data.fines.some(item => String(item.org_user_id) === String(fine.org_user_id) && Number(item.pending_amount) > 0)) {
                continue
            }
            let group = payableGroups.find(item => {
                return String(item.org_user_id) === String(fine.org_user_id)
            })
            if (!group) {
                group = {
                    org_user_id: fine.org_user_id,
                    organization_name: fine.organization_name,
                    cents: 0,
                    count: 0
                }
                payableGroups.push(group)
            }
            group.cents += cents
            group.count++
        }
    }
    const allGroup = form.fine_key.startsWith('ALL:') ? payableGroups.find(group => {
        return String(group.org_user_id) === form.fine_key.slice(4)
    }) : null
    const selected = !organization && allGroup ? {
        ...allGroup,
        available_to_claim: (allGroup.cents / 100).toFixed(2)
    } : null
    const enteredAmount = allGroup ? (allGroup.cents / 100).toFixed(2) : ''
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
        {!organization && <>
            <div className="student-summary">{[['Total Fines', data.summary.total_fines], ['Amount Due after Reductions', data.summary.outstanding]].map(([label, value]) => {
                return <article key={label}>
                    <span>{label}</span>
                    <strong>{money(value)}</strong>
                </article>
            })}</div>
            <section className="student-panel">
                <h3>My Fines</h3>
                <label>Fine status <select
                    value={fineStatus}
                    onChange={e => {
                        return setFineStatus(e.target.value)
                    }}
                >{['ALL', 'UNPAID', 'PAID'].map(v => {
                    return <option
                        key={v}
                        value={v}
                    >{v.replaceAll('_', ' ')}</option>
                })}</select></label>
                {Object.values(data.fines.reduce((groups, fine) => {
                    const group = groups[fine.org_user_id] ||= { name: fine.organization_name, id: fine.org_user_id, fines: [] }
                    group.fines.push(fine)
                    return groups
                }, {})).map(group => <section key={group.id}>
                    <h3>{group.name}</h3>
                <div className="student-table">
                    <table>
                        <thead>
                            <tr>
                                <th>Fine / Organization</th>
                                <th>Total</th>
                                <th>Cap Reduction</th>
                                <th>Discounts</th>
                                <th>Paid</th>
                                <th>Outstanding</th>
                                <th>Pending Claims</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>{group.fines.filter(f => {
                            return fineStatus === 'ALL' || f.payment_status === fineStatus
                        }).map(f => {
                            return <tr key={f.fine_key}>
                                <td>
                                    {f.violation_name || 'Violation'}
                                    <br />
                                    {f.organization_name}
                                    <br />
                                    <small>{f.semester_label || 'Semester not scheduled'} — {f.payment_window.replaceAll('_', ' ')}</small>
                                    {f.opens_at && <small className="payment-window">Pay: {date(f.opens_at)} to {date(f.closes_at)}</small>}
                                </td>
                                <td>{money(f.fine_amount)}</td>
                                <td>{money(f.cap_adjustment)}</td>
                                <td>{money(f.discount_amount)}</td>
                                <td>{money(f.paid_amount)}</td>
                                <td>{money(f.outstanding)}</td>
                                <td>{money(f.pending_amount)}</td>
                                <td>{f.payment_status.replaceAll('_', ' ')}</td>
                            </tr>
                        })}</tbody>
                    </table>
                    {!group.fines.length && <p>No fines recorded.</p>}
                </div>
                </section>)}
                {!data.fines.length && <p>No fines recorded.</p>}
            </section>
            <section className="student-panel">
                <h3>Submit a Payment Claim</h3>
                <p>Pay the full payable balance for one organization during its payment window. Caps and discounts are applied automatically. Your balance updates after the organization confirms payment.</p>
                {!payableGroups.length && <p>No fines are available for payment right now. Check the schedules above; pending claims already reserve their amounts.</p>}
                <form
                    className="payment-form"
                    onSubmit={async e => {
                        e.preventDefault()
                        const element = e.currentTarget
                        const body = new FormData()
                        Object.entries(form).forEach(([key, value]) => {
                            return body.append(key, value)
                        })
                        if (allGroup) {
                            body.set('fine_key', 'ALL')
                            body.set('organization_id', allGroup.org_user_id)
                            body.set('amount', enteredAmount)
                        }
                        if (proof) {
                            body.append('proof', proof)
                        }
                        if (await action('student/payments/submit', body)) {
                            setForm({
                                fine_key: '',
                                amount: '',
                                method: 'CASH',
                                reference_number: ''
                            })
                            setProof(null)
                            element.reset()
                        }
                    }}
                >
                    <label>Fines to pay<select
                        required
                        value={form.fine_key}
                        onChange={e => {
                            const value = e.target.value
                            const group = payableGroups.find(item => {
                                return `ALL:${item.org_user_id}` === value
                            })
                            setForm({
                                ...form,
                                fine_key: value,
                                amount: group ? (group.cents / 100).toFixed(2) : ''
                            })
                        }}
                    >
                        <option value="">Select organization</option>
                        <optgroup label="Pay all available fines per organization">{payableGroups.map(group => {
                            return <option
                                key={group.org_user_id}
                                value={`ALL:${group.org_user_id}`}
                            >{group.organization_name} — all {group.count} fines — {money(group.cents / 100)}</option>
                        })}</optgroup>
                    </select></label>
                    {allGroup && <p className="payment-total-note">Includes every payable attendance and violation fine for {allGroup.organization_name}. Payment must cover the full payable balance for this organization.</p>}
                    <label>Amount (PHP)<input
                        type="number"
                        required
                        min="0.01"
                        step="0.01"
                        readOnly
                        max={selected?.available_to_claim || '99999999.99'}
                        value={enteredAmount}
                    /></label>
                    <label>Method<select
                        value={form.method}
                        onChange={e => {
                            return setForm({
                                ...form,
                                method: e.target.value,
                                reference_number: ''
                            })
                        }}
                    >
                        <option value="CASH">Cash</option>
                        <option value="GCASH">GCash</option>
                    </select></label>
                    {form.method === 'GCASH' && <><div className="gcash-test-qr">
                        <span className="gcash-test-label">QR CODE</span>
                        <h4>{selected?.organization_name || 'GCash Payment'}</h4>
                        <img
                            src="/gcash-payment-qr.png"
                            width="240"
                            height="240"
                            alt=""
                        />
                        <p>Scan the QR code to Pay.</p>
                        {enteredAmount && <strong>{money(enteredAmount)}</strong>}
                    </div><label>GCash reference number<input
                        required
                        maxLength={100}
                        minLength={6}
                        value={form.reference_number}
                        onChange={e => {
                            return setForm({
                                ...form,
                                reference_number: e.target.value
                            })
                        }}
                    /></label></>}
                    <label>Proof of payment {form.method === 'GCASH' ? '(required)' : '(optional)'}<input
                        type="file"
                        required={form.method === 'GCASH'}
                        accept="image/jpeg,image/png,application/pdf"
                        onChange={e => {
                            const file = e.target.files[0]
                            if (file?.size > 5242880) {
                                setError('Proof must be 5 MB or smaller.')
                                e.target.value = ''
                                setProof(null)
                            } else {
                                setProof(file)
                            }
                        }}
                    /></label>
                    <small>JPEG, PNG or PDF, up to 5 MB. Pending claims reserve their amount to prevent duplicate submissions.</small>
                    <button disabled={busy || !selected}>{busy ? 'Submitting…' : 'Submit Claim'}</button>
                </form>
            </section>
        </>}
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
                    return setStatus(e.target.value)
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
                        {claims.filter(c => {
                            return status === 'ALL' || c.status === status
                        }).map(c => {
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
                                    {c.status === 'PENDING' && (organization ? <button
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
                {!claims.length && <p>No payment claims yet.</p>}
            </div>
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
        >{receipt && <><h2>Confirmed Payment Receipt</h2><dl>{Object.entries(receipt).map(([key, value]) => {
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

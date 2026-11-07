import { useEffect, useState } from 'react'
import { downloadExcel } from '../../utils/exportExcel'
const money = value => {
    return Number(value || 0).toLocaleString('en-PH', {
        style: 'currency',
        currency: 'PHP'
    })
}
const label = value => {
    return value.replaceAll('_', ' ')
}
export default function OrganizationFines({
    accessToken
}) {
    const [search, setSearch] = useState('')
    const [status, setStatus] = useState('')
    const [page, setPage] = useState(1)
    const [version, setVersion] = useState(0)
    const [result, setResult] = useState(null)
    const [error, setError] = useState('')
    const [exporting, setExporting] = useState(false)
    const query = new URLSearchParams({
        search,
        status,
        page
    }).toString()
    useEffect(() => {
        const timer = setInterval(() => {
            return setVersion(value => {
                return value + 1
            })
        }, 30000)
        return () => {
            return clearInterval(timer)
        }
    }, [])
    useEffect(() => {
        const controller = new AbortController()
        const timer = setTimeout(async () => {
            try {
                const response = await fetch(`/api/org/fines?${query}`, {
                    headers: {
                        Authorization: `Bearer ${accessToken}`
                    },
                    cache: 'no-store',
                    signal: controller.signal
                })
                const data = await response.json()
                if (!response.ok || !data.success) {
                    throw new Error(data.message || data.error || 'Unable to load fines.')
                }
                setResult(data)
                setError('')
            } catch (err) {
                if (err.name !== 'AbortError') {
                    setError(err.message)
                }
            }
        }, 250)
        return () => {
            clearTimeout(timer)
            controller.abort()
        }
    }, [query, accessToken, version])
    async function exportExcel() {
        setExporting(true)
        try {
            const response = await fetch(`/api/org/fines/export?${query}`, {
                headers: {
                    Authorization: `Bearer ${accessToken}`
                },
                cache: 'no-store'
            })
            const data = await response.json()
            if (!response.ok || !data.success) {
                throw new Error(data.message || data.error || 'Export failed.')
            }
            downloadExcel(data, 'organization-fines.xlsx')
        } catch (err) {
            setError(err.message)
        } finally {
            setExporting(false)
        }
    }
    return <section className="org-panel">
        <div className="org-record-heading">
            <h2>Student Fines & Balances</h2>
            <button
                className="secondary"
                disabled={exporting}
                onClick={exportExcel}
            >{exporting ? 'Exporting…' : 'Export Excel'}</button>
        </div>
        <p>Fines issued by your organization, including students who have not submitted a payment claim. Only confirmed payments reduce balances.</p>
        <div className="org-actions">
            <label className="org-field">Search students<input
                maxLength={100}
                value={search}
                placeholder="Name, student number, course or section"
                onChange={e => {
                    setSearch(e.target.value)
                    setPage(1)
                    setResult(null)
                }}
            /></label>
            <label className="org-field">Balance status<select
                value={status}
                onChange={e => {
                    setStatus(e.target.value)
                    setPage(1)
                    setResult(null)
                }}
            >
                <option value="">All statuses</option>
                <option value="UNPAID">Unpaid</option>
                <option value="PARTIALLY_PAID">Partially paid</option>
                <option value="PAID">Fully paid</option>
            </select></label>
            <button
                className="secondary"
                onClick={() => {
                    return setVersion(value => {
                        return value + 1
                    })
                }}
            >Refresh</button>
        </div>
        {error && <p role="alert">{error}</p>}
        {!result ? <p>Loading fines…</p> : <>
            <p aria-live="polite">{result.summary.student_count} students · Total fines: <strong>{money(result.summary.total_fine)}</strong> · Confirmed payments: <strong>{money(result.summary.paid_amount)}</strong> · Outstanding: <strong>{money(result.summary.outstanding)}</strong> · Pending claims: {money(result.summary.pending_amount)}</p>
            <p>Totals reflect the selected filters. Sorted by course, year level, section, then name. Updates every 30 seconds.</p>
            {!result.data.length ? <p>No students with fines match these filters.</p> : <div className="org-table">
                <table>
                    <thead>
                        <tr>
                            <th>Course</th>
                            <th>Year Level</th>
                            <th>Section</th>
                            <th>Name / Student Number</th>
                            <th>Violations</th>
                            <th>Total Fines</th>
                            <th>Paid</th>
                            <th>Outstanding</th>
                            <th>Status / Details</th>
                        </tr>
                    </thead>
                    <tbody>{result.data.map(student => {
                        return <tr key={student.student_id}>
                            <td>{student.course}</td>
                            <td>{student.year_level}</td>
                            <td>{student.section}</td>
                            <td>
                                {student.full_name}
                                <small>{student.student_number}</small>
                            </td>
                            <td>{student.violation_count}</td>
                            <td>{money(student.total_fine)}</td>
                            <td>{money(student.paid_amount)}</td>
                            <td>{money(student.outstanding)}</td>
                            <td>
                                {label(student.payment_status)}
                                <details>
                                    <summary>View fines</summary>
                                    {student.fines.map(fine => {
                                        return <div key={fine.fine_key}>
                                            <strong>{fine.violation_name}</strong>
                                            <small>{fine.event_name} · {fine.recorded_at} PHT</small>
                                            <small>Fine: {money(fine.fine_amount)} · Paid: {money(fine.paid_amount)} · Balance: {money(fine.outstanding)}</small>
                                            <small>Pending claims: {money(fine.pending_amount)}</small>
                                        </div>
                                    })}
                                </details>
                            </td>
                        </tr>
                    })}</tbody>
                </table>
            </div>}
            <div className="org-pagination">
                <span>Page {result.pagination.current_page} of {result.pagination.total_pages}</span>
                <div className="org-actions">
                    <button
                        className="secondary"
                        disabled={result.pagination.current_page <= 1}
                        onClick={() => {
                            setPage(result.pagination.current_page - 1)
                            setResult(null)
                        }}
                    >Previous</button>
                    <button
                        className="secondary"
                        disabled={result.pagination.current_page >= result.pagination.total_pages}
                        onClick={() => {
                            setPage(result.pagination.current_page + 1)
                            setResult(null)
                        }}
                    >Next</button>
                </div>
            </div>
        </>}
    </section>
}

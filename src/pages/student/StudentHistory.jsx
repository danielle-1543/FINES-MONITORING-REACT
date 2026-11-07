import { useEffect, useRef, useState } from 'react'
import { studentRequest } from './studentApi'
import { downloadExcel } from '../../utils/exportExcel'
const money = value => {
    return Number(value || 0).toLocaleString('en-PH', {
        style: 'currency',
        currency: 'PHP'
    })
}
const date = value => {
    return value ? new Date(value.replace(' ', 'T') + '+08:00').toLocaleString('en-PH', {
        timeZone: 'Asia/Manila'
    }) : '—'
}
export default function StudentHistory({
    accessToken,
    kind
}) {
    const [filters, setFilters] = useState({
        search: '',
        from: '',
        to: '',
        page: 1
    })
    const [result, setResult] = useState(null),
        [error, setError] = useState(''),
        [loading, setLoading] = useState(true),
        [exporting, setExporting] = useState(false)
    const query = new URLSearchParams({
        ...filters,
        kind
    }).toString(),
        exportLock = useRef(false)
    useEffect(() => {
        const controller = new AbortController()
        const timer = setTimeout(() => {
            return studentRequest(`history?${query}`, accessToken, undefined, controller.signal).then(value => {
                setResult(value)
                setError('')
            }).catch(err => {
                if (err.name !== 'AbortError') {
                    setError(err.message)
                }
            }).finally(() => {
                if (!controller.signal.aborted) {
                    setLoading(false)
                }
            })
        }, 200)
        return () => {
            clearTimeout(timer)
            controller.abort()
        }
    }, [query, accessToken])
    const change = (key, value) => {
        setFilters(current => {
            return {
                ...current,
                [key]: value,
                page: 1
            }
        })
        setLoading(true)
        setError('')
    }
    async function exportRecords() {
        if (exportLock.current) {
            return
        }
        exportLock.current = true
        setExporting(true)
        setError('')
        try {
            const value = await studentRequest(`history/export?${query}`, accessToken)
            downloadExcel(value, kind === 'ATTENDANCE' ? 'my-attendance.xlsx' : 'my-violations.xlsx')
        } catch (err) {
            setError(err.message)
        } finally {
            exportLock.current = false
            setExporting(false)
        }
    }
    return <section className="student-panel">
        <div className="student-page-heading">
            <h2>{kind === 'ATTENDANCE' ? 'My Attendance History' : 'My Violation History'}</h2>
            <button
                type="button"
                className="student-button"
                disabled={exporting}
                onClick={exportRecords}
            >{exporting ? 'Exporting…' : 'Export Excel'}</button>
        </div>
        <p>{kind === 'ATTENDANCE' ? 'Your recorded present/absent attendance, newest first.' : 'All of your recorded violations, including event, standalone and attendance-linked violations.'}</p>
        <div className="student-filters">
            <label>Search<input
                value={filters.search}
                placeholder="Event, organization or violation"
                onChange={e => {
                    return change('search', e.target.value)
                }}
            /></label>
            <label>From (PHT)<input
                type="date"
                value={filters.from}
                onChange={e => {
                    return change('from', e.target.value)
                }}
            /></label>
            <label>To (PHT)<input
                type="date"
                value={filters.to}
                min={filters.from || undefined}
                onChange={e => {
                    return change('to', e.target.value)
                }}
            /></label>
            <button
                type="button"
                className="student-button"
                onClick={() => {
                    setFilters({
                        search: '',
                        from: '',
                        to: '',
                        page: 1
                    })
                    setLoading(true)
                    setError('')
                }}
            >Clear</button>
        </div>
        {error && <p
            role="alert"
            className="account-error"
        >{error}</p>}
        {kind === 'VIOLATION' && result && !loading && !error && <div className="student-summary">{[['Total Fines', result.summary.total_fines], ['Paid', result.summary.paid_amount], ['Outstanding', result.summary.outstanding]].map(([label, value]) => {
            return <article key={label}>
                <span>{label} (matching records)</span>
                <strong>{money(value)}</strong>
            </article>
        })}</div>}
        {loading ? <p>Loading records…</p> : !error && result && <>
            <div className="student-table">
                <table>
                    <thead>
                        <tr>
                            <th>Event</th>
                            <th>Organization</th>
                            <th>Recorded At (PHT)</th>
                            {kind === 'ATTENDANCE' ? <th>Status</th> : <><th>Violation</th><th>Fine</th><th>Paid</th><th>Outstanding</th></>}
                        </tr>
                    </thead>
                    <tbody>{result.data.map(row => {
                        return <tr key={row.id}>
                            <td>{row.event_name}</td>
                            <td>{row.organization_name}</td>
                            <td>{date(row.recorded_at)}</td>
                            {kind === 'ATTENDANCE' ? <td>{row.attendance_status}</td> : <><td>{row.violation_name || 'Violation'}</td><td>{money(row.fine_amount)}</td><td>{money(row.paid_amount)}</td><td>{money(row.outstanding)}</td></>}
                        </tr>
                    })}</tbody>
                </table>
            </div>
            {!result.data.length && <p>No matching records.</p>}
            <div className="student-page-heading">
                <span>{result.pagination.total_records} records · Page {result.pagination.current_page} of {result.pagination.total_pages}</span>
                <div className="account-actions">
                    <button
                        className="student-button"
                        disabled={result.pagination.current_page <= 1}
                        onClick={() => {
                            setFilters(current => {
                                return {
                                    ...current,
                                    page: result.pagination.current_page - 1
                                }
                            })
                            setLoading(true)
                        }}
                    >Previous</button>
                    <button
                        className="student-button"
                        disabled={result.pagination.current_page >= result.pagination.total_pages}
                        onClick={() => {
                            setFilters(current => {
                                return {
                                    ...current,
                                    page: result.pagination.current_page + 1
                                }
                            })
                            setLoading(true)
                        }}
                    >Next</button>
                </div>
            </div><p className="student-note">Excel exports include every matching record, not just this page.</p>
        </>}
    </section>
}

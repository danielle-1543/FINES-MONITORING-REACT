import { apiRequest } from '../../utils/apiRequest'
import { money } from '../../utils/format'
import { useEffect, useState } from 'react'
function Table({
    title,
    rows,
    columns,
    empty
}) {
    return <section className="org-panel">
        <h2>{title}</h2>
        {!rows.length ? <p>{empty}</p> : <div className="org-table">
            <table>
                <thead>
                    <tr>{columns.map(([key, label]) => {
                        return <th key={key}>{label}</th>
                    })}</tr>
                </thead>
                <tbody>{rows.map((row, index) => {
                    return <tr key={row.id || row.fine_key || index}>{columns.map(([key, , format]) => {
                        return <td key={key}>{format ? format(row[key]) : row[key] || '—'}</td>
                    })}</tr>
                })}</tbody>
            </table>
        </div>}
    </section>
}
export default function OrganizationOverview({
    accessToken,
    username,
    onNavigate
}) {
    const [data, setData] = useState(null),
        [error, setError] = useState(''),
        [version, setVersion] = useState(0)
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
        apiRequest('/api/org/dashboard', accessToken, undefined, controller.signal, {
            failureMessage: 'Unable to load dashboard.',
            invalidResponseMessage: 'The dashboard API returned malformed JSON. Check the backend Render logs.'
        }).then(result => {
            if (controller.signal.aborted) return
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
    }, [accessToken, version])
    return <><div className="student-page-heading">
        <h2 className="portal-greeting">Mabuhay, {username}!</h2>
        <button
            onClick={() => {
                return setVersion(value => {
                    return value + 1
                })
            }}
        >Refresh</button>
    </div>
        {error && <p
            role="alert"
            className="account-error"
        >{error}</p>}{!data ? <p>{error ? 'Dashboard could not be loaded. Use Refresh to try again.' : 'Loading dashboard…'}</p> : <>
            <div className="student-summary org-dashboard-totals">{[['Students', data.summary.students], ['Attendance · Present', data.summary.present], ['Attendance · Absent', data.summary.absent], ['Recorded violations', data.summary.violations], ['Total fines', money(data.summary.total_fine)], ['Confirmed payments', money(data.summary.paid_amount)], ['Outstanding balance', money(data.summary.outstanding)], ['Pending payment claims', data.summary.pending_claims]].map(([label, value]) => {
                return <article key={label}>
                    <span>{label}</span>
                    <strong>{value}</strong>
                </article>
            })}</div>
            <p className="student-note">Totals cover your organization’s permitted students. Attendance totals count records across events. Updates every 30 seconds.</p>
            <div className="org-actions">
                <button onClick={() => {
                    return onNavigate('attendance')
                }}>Record attendance</button>
                <button onClick={() => {
                    return onNavigate('violations')
                }}>Record violation</button>
                <button onClick={() => {
                    return onNavigate('payments')
                }}>Review payments</button>
            </div>
            <Table
                title="Ongoing & Upcoming Events"
                rows={data.events}
                empty="No ongoing or upcoming events."
                columns={[['name', 'Event'], ['event_status', 'Status'], ['scan_starts_at', 'Starts'], ['scan_ends_at', 'Ends']]}
            />
            <Table
                title="Recent Attendance"
                rows={data.recent_attendance}
                empty="No attendance recorded."
                columns={[['full_name', 'Student'], ['student_number', 'Student number'], ['event_name', 'Event'], ['attendance_status', 'Status'], ['recorded_at', 'Recorded']]}
            />
            <Table
                title="Recent Violations"
                rows={data.recent_violations}
                empty="No violations recorded."
                columns={[['full_name', 'Student'], ['violation_name', 'Violation'], ['event_name', 'Event'], ['fine_amount', 'Fine', money], ['recorded_at', 'Recorded']]}
            />
            <Table
                title="Recent Payment Claims"
                rows={data.recent_payments}
                empty="No payment claims submitted."
                columns={[['full_name', 'Student'], ['amount', 'Amount', money], ['method', 'Method'], ['status', 'Status'], ['submitted_at', 'Submitted']]}
            />
        </>}
    </>
}

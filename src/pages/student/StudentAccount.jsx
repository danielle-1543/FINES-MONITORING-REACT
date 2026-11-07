import { useEffect, useState } from 'react'
import '../../css/auth/Account.css'
import '../../css/student/Dashboard.css'
import Payments from './Payments'
import StudentQR from './StudentQR'
import StudentHistory from './StudentHistory'
import StudentProfile from './StudentProfile'
import PortalLayout from '../../components/PortalLayout'
const money = value => {
    return Number(value || 0).toLocaleString('en-PH', {
        style: 'currency',
        currency: 'PHP'
    })
}
function date(value) {
    return value ? new Date(value.replace(' ', 'T') + '+08:00').toLocaleString('en-PH', {
        timeZone: 'Asia/Manila'
    }) : '—'
}
function Records({
    title,
    rows,
    columns,
    empty
}) {
    return <section className="student-panel">
        <h2>{title}</h2>
        {!rows.length ? <p>{empty}</p> : <div className="student-table">
            <table>
                <thead>
                    <tr>{columns.map(([key, label]) => {
                        return <th key={key}>{label}</th>
                    })}</tr>
                </thead>
                <tbody>{rows.map(row => {
                    return <tr key={row.id}>{columns.map(([key, , format]) => {
                        return <td key={key}>{format ? format(row[key]) : row[key] || '—'}</td>
                    })}</tr>
                })}</tbody>
            </table>
        </div>}
    </section>
}
export default function StudentAccount({
    user,
    accessToken,
    onLogout,
    onAccountUpdated
}) {
    const [data, setData] = useState(null)
    const [error, setError] = useState('')
    const [page, setPage] = useState('dashboard')
    const [version, setVersion] = useState(0)
    useEffect(() => {
        const controller = new AbortController()
        fetch('/api/student/dashboard', {
            headers: {
                Accept: 'application/json',
                Authorization: `Bearer ${accessToken}`
            },
            cache: 'no-store',
            signal: controller.signal
        }).then(async response => {
            const result = await response.json()
            if (!response.ok || !result.success) {
                throw new Error(result.message || result.error || 'Unable to load your dashboard.')
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
    }, [accessToken, version, page])
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
    return <PortalLayout
        role="Student"
        account={user.username}
        items={[['dashboard', 'Dashboard'], ['attendance', 'Attendance History'], ['violations', 'Violation History'], ['payments', 'Payments & Receipts'], ['profile', 'Profile']]}
        page={page}
        onNavigate={setPage}
        onLogout={onLogout}
    >
        <div className="student-content">
            {page === 'payments' ? <Payments
                accessToken={accessToken}
                onChanged={() => {
                    return setVersion(v => {
                        return v + 1
                    })
                }}
            /> : page === 'attendance' || page === 'violations' ? <StudentHistory
                key={page}
                accessToken={accessToken}
                kind={page === 'attendance' ? 'ATTENDANCE' : 'VIOLATION'}
            /> : page === 'profile' ? <><h2 className="portal-greeting">Profile</h2><div className="student-profile-layout">
                <StudentQR accessToken={accessToken} />
                <StudentProfile
                    accessToken={accessToken}
                    onAccountUpdated={onAccountUpdated}
                    onPasswordChanged={onLogout}
                />
            </div></> : error ? <p
                role="alert"
                className="account-error"
            >{error}</p> : !data ? <p>Loading your dashboard…</p> : <>
                <h2 className="portal-greeting">Mabuhay, {data.profile.full_name}!</h2>
                <div className="student-summary">
                    <article>
                        <span>Total Violations</span>
                        <strong>{data.summary.total_violations}</strong>
                    </article>
                    <article>
                        <span>Total Fines</span>
                        <strong>{money(data.summary.total_fines)}</strong>
                    </article>
                    <article>
                        <span>Confirmed Payments</span>
                        <strong>{money(data.summary.paid_amount)}</strong>
                    </article>
                    <article>
                        <span>Outstanding Fines</span>
                        <strong>{money(data.summary.unpaid_fines)}</strong>
                    </article>
                </div>
                {!data.payments_available && <p className="student-note">Payments are not connected yet. The unpaid total currently includes all recorded fines; payment deductions will appear when payment confirmation is implemented.</p>}
                <Records
                    title="Recent Attendance"
                    rows={data.recent_attendance}
                    empty="No attendance recorded yet."
                    columns={[['event_name', 'Event'], ['organization_name', 'Organization'], ['attendance_status', 'Status'], ['recorded_at', 'Recorded At (PHT)', date]]}
                />
                <Records
                    title="Recent Violations"
                    rows={data.recent_violations}
                    empty="No violations recorded."
                    columns={[['violation_name', 'Violation'], ['event_name', 'Event'], ['organization_name', 'Organization'], ['fine_amount', 'Fine', money], ['recorded_at', 'Recorded At (PHT)', date]]}
                />
                <Records
                    title="Recent Payments"
                    rows={data.recent_payments}
                    empty={data.payments_available ? 'No payments recorded.' : 'Payment records are not connected yet.'}
                    columns={[['recorded_at', 'Date (PHT)', date], ['amount', 'Amount', money], ['method', 'Method']]}
                />
                <Records
                    title="Ongoing & Upcoming Organization Events"
                    rows={data.upcoming_events}
                    empty="No ongoing or upcoming events for your course or USG."
                    columns={[['name', 'Event'], ['organization_name', 'Organization'], ['event_status', 'Status'], ['scan_starts_at', 'Starts (PHT)', date], ['scan_ends_at', 'Ends (PHT)', date]]}
                />
            </>}
        </div>
    </PortalLayout>
}

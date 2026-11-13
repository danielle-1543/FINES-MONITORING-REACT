import AcademicSettings from '../../components/AcademicSettings'
import FineArchives from '../../components/FineArchives'
import { apiFetch } from '../../utils/apiFetch'
import StatisticsChart from '../../components/StatisticsChart'
import AccountSettings from '../../components/AccountSettings'
import { useEffect, useRef, useState } from 'react'
import StudentManagement from './StudentManagement'
import OrganizationManagement from './OrganizationManagement'
import PortalLayout from '../../components/PortalLayout'

import '../../css/admin/Dashboard.css'
const activityMetrics = [
    ['login_success', 'Successful logins'],
    ['login_failed', 'Failed logins'],
    ['logout', 'Logouts'],
    ['account_activated', 'Account activations']
]
const featureLabels = {
    dashboard: 'Dashboard', students: 'Student management', organizations: 'Organizations',
    profile: 'Account settings', notifications: 'Notifications', attendance: 'Attendance',
    violations: 'Violations', payments: 'Payments', fines: 'Fines', events: 'Events',
    unknown: 'Other feature'
}
function SystemActivityAnalytics({ accessToken }) {
    const [days, setDays] = useState('7')
    const [environment, setEnvironment] = useState('all')
    const [report, setReport] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [version, setVersion] = useState(0)
    const forceRefresh = useRef(false)
    useEffect(() => {
        const timer = setInterval(() => {
            if (document.visibilityState === 'visible') setVersion(v => v + 1)
        }, 60000)
        return () => clearInterval(timer)
    }, [])
    useEffect(() => {
        const controller = new AbortController()
        const refresh = forceRefresh.current
        forceRefresh.current = false
        async function load() {
            try {
                const query = new URLSearchParams({ days, environment, refresh: refresh ? '1' : '0' })
                const response = await apiFetch(`/api/admin/dashboard/analytics?${query}`, {
                    headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}` },
                    cache: 'no-store', signal: controller.signal
                })
                const result = await response.json()
                if (!response.ok || !result.success) {
                    throw new Error(result.error || result.message || 'Unable to load activity analytics.')
                }
                if (!controller.signal.aborted) {
                    setReport(result.data)
                    setError('')
                }
            } catch (err) {
                if (!controller.signal.aborted) setError(err.message)
            } finally {
                if (!controller.signal.aborted) setLoading(false)
            }
        }
        void load()
        return () => controller.abort()
    }, [accessToken, days, environment, version])
    const current = report && report.days === Number(days) && report.environment === environment ? report : null
    const peak = Math.max(1, ...(current?.daily.map(item => item.count) || []))
    return <section className="admin-analytics" aria-labelledby="admin-analytics-title" aria-busy={loading}>
        <div className="admin-dashboard-heading">
            <div>
                <h3 id="admin-analytics-title">System Activity Analytics</h3>
                <p>PostHog activity across student, organization, and admin accounts.</p>
            </div>
            <div className="admin-analytics-filters">
                <label>Date range<select value={days} onChange={event => {
                    setDays(event.target.value)
                    setLoading(true)
                    setError('')
                }}>
                    <option value="7">Last 7 days</option>
                    <option value="30">Last 30 days</option>
                    <option value="90">Last 90 days</option>
                </select></label>
                <label>Environment<select value={environment} onChange={event => {
                    setEnvironment(event.target.value)
                    setLoading(true)
                    setError('')
                }}>
                    <option value="all">All environments</option>
                    <option value="development">Development</option>
                    <option value="production">Production</option>
                </select></label>
                <button type="button" disabled={loading} onClick={() => {
                    forceRefresh.current = true
                    setLoading(true)
                    setVersion(v => v + 1)
                }}>{loading ? 'Loading…' : 'Refresh analytics'}</button>
            </div>
        </div>
        {error && <p role="alert" className="admin-analytics-error">{error}{current ? ' Showing the last loaded report.' : ''}</p>}
        {!current ? <p role="status">{loading ? 'Loading PostHog activity…' : 'Activity analytics is unavailable. Your system statistics are still available above.'}</p> : <>
            <div className="admin-analytics-metrics">{activityMetrics.map(([key, label]) => <article key={key}>
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" aria-hidden="true"><path d={key === 'logout' ? 'M9 5H4v14h5M10 12h11m-4-4 4 4-4 4' : key === 'login_failed' ? 'M6 6l12 12M18 6 6 18' : key === 'account_activated' ? 'm5 12 4 4L19 6' : 'M15 5h5v14h-5M3 12h12m-4-4 4 4-4 4'} /></svg><h4>{label}</h4><strong>{current.counts[key].toLocaleString()}</strong>
            </article>)}</div>
            {!current.total_events && <p role="status">No tracked activities for this range and environment yet. Zero means no captured events, not necessarily no system usage.</p>}
            <div className="admin-analytics-panels">
                <section>
                    <h4>Daily activity</h4>
                    <p>{current.total_events.toLocaleString()} tracked events</p>
                    <div className="admin-analytics-chart-scroll">
                        <div className="admin-analytics-chart" role="img" aria-label={`Daily tracked activity from ${current.from_date} to ${current.to_date}. Exact counts are available below.`}
                            style={{ gridTemplateColumns: `repeat(${current.daily.length}, minmax(8px, 1fr))` }}>
                            {current.daily.map(item => <div className="admin-analytics-column" key={item.date} title={`${item.date}: ${item.count} events`}>
                                <span style={{ height: `${item.count / peak * 100}%` }} />
                            </div>)}
                        </div>
                    </div>
                    <div className="admin-analytics-axis"><span>{current.from_date}</span><span>{current.to_date}</span></div>
                    <details><summary>View daily counts</summary><div className="admin-activity-table"><table>
                        <thead><tr><th>Date</th><th>Tracked events</th></tr></thead>
                        <tbody>{current.daily.map(item => <tr key={item.date}><td>{item.date}</td><td>{item.count.toLocaleString()}</td></tr>)}</tbody>
                    </table></div></details>
                </section>
                <section>
                    <h4>Most-used features</h4>
                    <StatisticsChart title="Feature usage" unit="Uses" population="recorded feature uses" values={current.features.map(item => ({
                        label: featureLabels[item.feature] || item.feature, count: item.count
                    }))} />
                </section>
            </div>
            <p className="admin-analytics-note">Last retrieved {new Date(current.updated_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}. Updates automatically every minute while this page is visible. Refresh analytics requests a fresh report; newly captured events may take time to appear. Counts represent captured actions, not unique people or financial totals.</p>
        </>}
    </section>
}
function Overview({
    accessToken,
    username
}) {

    const [page, setPage] = useState(1)
    const [version, setVersion] = useState(0)
    const [data, setData] = useState(null)
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(true)
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
    useEffect(() => {
        const controller = new AbortController()
        async function load() {
            try {
                const query = new URLSearchParams({

                    page
                })
                const response = await apiFetch(`/api/admin/dashboard?${query}`, {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        Accept: 'application/json'
                    },
                    cache: 'no-store',
                    signal: controller.signal
                })
                const result = await response.json()
                if (!response.ok || !result.success) {
                    throw new Error(result.message || result.error || 'Unable to load dashboard.')
                }
                setData(result.data)
                setError('')
            } catch (err) {
                if (err.name !== 'AbortError') {
                    setError(err.message)
                }
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false)
                }
            }
        }
        load()
        return () => {
            return controller.abort()
        }
    }, [page, accessToken, version])
    return <section className="admin-dashboard" aria-busy={loading}>
        <h2 className="admin-greeting">Mabuhay, {username?.toLowerCase() === 'admin' ? 'Admin' : username || 'Admin'}!</h2>
        {error && <p role="alert">{error}</p>}
        {!data && <p>{error ? 'Dashboard unavailable. Please reload the page.' : 'Loading dashboard...'}</p>}
        {data && <>
            <section className="statistics-grid" aria-label="Student accounts">
                <StatisticsChart title="Student Distribution by Course" donut unit="Students" population="registered students" values={data.course_distribution || []} />
                <StatisticsChart title="Account Activation Status" population="student accounts with an activation status" values={[
                    { label: 'Pending Activation', count: data.student_statistics.pending },
                    { label: 'Activated Accounts', count: data.student_statistics.activated }
                ]} />
                <StatisticsChart title="Account Status" population="student accounts with an account status" values={[
                    { label: 'Active Accounts', count: data.student_statistics.active },
                    { label: 'Inactive Accounts', count: data.student_statistics.inactive }
                ]} />
            </section>
        </>}
        <SystemActivityAnalytics accessToken={accessToken} />
        {data && <>
            <section className="admin-activity">
                <div className="admin-activity-heading">
                    <div>
                        <h3>System Activity Log <span className="admin-activity-count">{data.pagination.total_records}</span></h3>
                        <p>Recent successful actions across the system.</p>
                    </div>
                    <span className="admin-update-tag">Updates every 30s</span>
                </div>
                {!data.activity.length ? <p>No activities recorded yet. New actions will appear here.</p> : <div className="admin-activity-table">
                    <table>
                        <thead>
                            <tr>
                                <th>Date & Time</th>
                                <th>Account</th>
                                <th>Role</th>
                                <th>Activity</th>
                            </tr>
                        </thead>
                        <tbody>{data.activity.map(item => {
                            return <tr key={item.id}>
                                <td className="admin-activity-date">{item.created_at}</td>
                                <td>
                                    <span className="admin-actor">
                                        <span
                                            className="admin-avatar"
                                            aria-hidden="true"
                                        >{item.actor_name?.charAt(0).toUpperCase()}</span>
                                        {item.actor_name}
                                    </span>
                                </td>
                                <td>
                                    <span className="admin-role-tag">{item.actor_role}</span>
                                </td>
                                <td>{item.action}</td>
                            </tr>
                        })}</tbody>
                    </table>
                </div>}
                <div className="admin-dashboard-heading">
                    <p>{data.pagination.total_records} activities · Page {data.pagination.current_page} of {data.pagination.total_pages}</p>
                    <div className="admin-log-pagination">
                        <button
                            disabled={data.pagination.current_page <= 1}
                            onClick={() => {
                                return setPage(data.pagination.current_page - 1)
                            }}
                        >Previous</button>
                        <button
                            disabled={data.pagination.current_page >= data.pagination.total_pages}
                            onClick={() => {
                                return setPage(data.pagination.current_page + 1)
                            }}
                        >Next</button>
                    </div>
                </div>
            </section>
        </>}
    </section>
}
export default function AdminDashboard({
    user,
    accessToken,
    onLogout,
    onAccountUpdated
}) {
    const [activePage, setActivePage] = useState('dashboard')

    return <PortalLayout
        className="admin-portal"
        role="Admin"
        account={user?.username || 'Admin'}
        items={[['dashboard', 'Dashboard'], ['students', 'Student Management'], ['organizations', 'Organizations'], ['academic', 'Academic Settings'], ['archives', 'Fine Archives'], ['profile', 'Account Settings']]}
        page={activePage}
        pageDescription={{
            dashboard: 'Student accounts, system activity and semester fine summaries.',
            students: 'Register students and update their semester, profile and account records.',
            organizations: 'Manage organization accounts and program access.',
            academic: 'Configure academic periods and review legacy record classifications.',
            archives: 'Review fine assessments and payment allocations by semester.',
            profile: 'Manage your administrator account and sign-in details.'
        }[activePage]}
onNavigate={setActivePage}
        onLogout={onLogout}
    >
        {activePage === 'dashboard' && <Overview
            accessToken={accessToken}
            username={user?.username}
        />}
        {activePage === 'academic' && <AcademicSettings accessToken={accessToken} />}
        {activePage === 'archives' && <FineArchives accessToken={accessToken} role="ADMIN" />}
        {activePage === 'dashboard' && <FineArchives accessToken={accessToken} role="ADMIN" summaryOnly />}
        {activePage === 'students' && <StudentManagement accessToken={accessToken} />}
        {activePage === 'organizations' && <OrganizationManagement accessToken={accessToken} />}
        {activePage === 'profile' && <AccountSettings
            accessToken={accessToken}
            onAccountUpdated={onAccountUpdated}
            onLogout={onLogout}
        />}
    </PortalLayout>
}

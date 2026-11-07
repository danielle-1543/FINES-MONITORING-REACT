import AccountSettings from '../../components/AccountSettings'
import { useEffect, useState } from 'react'
import StudentManagement from './StudentManagement'
import OrganizationManagement from './OrganizationManagement'
import PortalLayout from '../../components/PortalLayout'
import '../../css/admin/Dashboard.css'
function Overview({
    accessToken,
    username
}) {
    const [course, setCourse] = useState('')
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
                    course,
                    page
                })
                const response = await fetch(`/api/admin/dashboard?${query}`, {
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
    }, [course, page, accessToken, version])
    return <section className="admin-dashboard">
        <h2 className="admin-greeting">Mabuhay, {username?.toLowerCase() === 'admin' ? 'Admin' : username || 'Admin'}!</h2>
        {error && <p role="alert">{error}</p>}
        {!data ? <p>{error ? 'Dashboard unavailable. Please reload the page.' : 'Loading dashboard...'}</p> : <>
            <div className="admin-stat-grid">
                <section className="admin-stat-card">
                    <div className="admin-stat-heading">
                        <div className="admin-stat-title">
                            <span className="admin-stat-icon">
                                <svg
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.6"
                                    aria-hidden="true"
                                >
                                    <path
                                        d="M15 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM6 21v-2a6 6 0 0 1 12 0v2M18 9a2.5 2.5 0 0 1 0 5m3 7v-2a5 5 0 0 0-2-4M6 9a2.5 2.5 0 0 0 0 5m-3 7v-2a5 5 0 0 1 2-4"
                                    />
                                </svg>
                            </span>
                            <h3>Students</h3>
                        </div>
                        <label>Course <select
                            value={course}
                            onChange={e => {
                                setCourse(e.target.value)
                                setLoading(true)
                            }}
                        >
                            <option value="">All courses</option>
                            {data.courses.map(value => {
                                return <option
                                    key={value}
                                    value={value}
                                >{value}</option>
                            })}
                        </select></label>
                    </div>
                    <p
                        className="admin-stat-number"
                        aria-live="polite"
                    >{loading ? '...' : data.student_count.toLocaleString()}</p>
                    <div className="admin-stat-foot">
                        <span className="admin-course-tag">{course || 'All courses'}</span>
                        <span>Registered students</span>
                    </div>
                </section>
                <section className="admin-stat-card">
                    <div className="admin-stat-title">
                        <span className="admin-stat-icon">
                            <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.6"
                                aria-hidden="true"
                            >
                                <path d="m3 8 9-5 9 5v3H3V8ZM3 21h18M5 11v10m5-10v10m4-10v10m5-10v10" />
                            </svg>
                        </span>
                        <h3>Organizations</h3>
                    </div>
                    <p className="admin-stat-number">{data.organization_count.toLocaleString()}</p>
                    <div className="admin-stat-foot">
                        <span className="admin-course-tag">Campus-wide</span>
                        <span>Includes USG</span>
                    </div>
                </section>
            </div>
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
                                <th>Date & Time (PHT)</th>
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
        items={[['dashboard', 'Dashboard'], ['students', 'Student Management'], ['organizations', 'Organizations'], ['profile', 'Account Settings']]}
        page={activePage}
        onNavigate={setActivePage}
        onLogout={onLogout}
    >
        {activePage === 'dashboard' && <Overview
            accessToken={accessToken}
            username={user?.username}
        />}
        {activePage === 'students' && <StudentManagement accessToken={accessToken} />}
        {activePage === 'organizations' && <OrganizationManagement accessToken={accessToken} />}
        {activePage === 'profile' && <AccountSettings
            accessToken={accessToken}
            onAccountUpdated={onAccountUpdated}
            onLogout={onLogout}
        />}
    </PortalLayout>
}

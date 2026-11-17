import { notificationDate, notificationDay, notificationFields } from '../utils/notificationPresentation'
import { apiFetch } from '../utils/apiFetch'
import '../css/student/Notifications.css'
import { useCallback, useEffect, useState } from 'react'

function formatDate(value) {
    const date = notificationDate(value)
    if (!date) return 'Not available'
    return date.toLocaleString('en-PH', {
        timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short'
    })
}

export default function StudentNotificationCenter({ accessToken, open, onUnreadChange }) {
    const [unread, setUnread] = useState(0)
    const [totalCount, setTotalCount] = useState(null)
    const [result, setResult] = useState(null)
    const [page, setPage] = useState(1)
    const [filter, setFilter] = useState('all')
    const [version, setVersion] = useState(0)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')
    const request = useCallback(async (path, options = {}) => {
        const response = await apiFetch(`/api/student/notifications${path}`, {
            ...options,
            cache: 'no-store',
            headers: {
                Accept: 'application/json', Authorization: `Bearer ${accessToken}`,
                ...(options.body ? { 'Content-Type': 'application/json' } : {})
            }
        })
        const body = await response.json()
        if (!response.ok || !body.success) {
            throw new Error(body.error || body.message || 'Unable to load notifications.')
        }
        return body
    }, [accessToken])

    useEffect(() => {
        const controller = new AbortController()
        let timer
        async function refresh() {
            try {
                const body = await request(open ? `?page=${page}&filter=${filter}` : '/unread', {
                    signal: controller.signal
                })
                if (controller.signal.aborted) return
                setUnread(body.unread_count)
                onUnreadChange(body.unread_count)
                if (open) {
                    setResult(body)
                    setTotalCount(body.total_count ?? (filter === 'all' ? body.pagination.total : null))
                }
                setError('')
            } catch (err) {
                if (err.name !== 'AbortError') setError(err.message)
            } finally {
                if (!controller.signal.aborted) timer = setTimeout(refresh, 15000)
            }
        }
        void refresh()
        return () => {
            controller.abort()
            clearTimeout(timer)
        }
    }, [request, open, page, filter, version, onUnreadChange])

    async function markRead(input) {
        setBusy(true)
        try {
            const body = await request('/read', {
                method: 'POST', body: JSON.stringify(input)
            })
            setUnread(body.unread_count)
            onUnreadChange(body.unread_count)
            setVersion(v => v + 1)
            setError('')
        } catch (err) {
            setError(err.message)
        } finally {
            setBusy(false)
        }
    }

    const total = totalCount
    const counts = { all: total, unread, read: total === null || total === undefined ? null : Math.max(0, total - unread) }
    const groups = { Today: [], Yesterday: [], Earlier: [] }
    for (const item of result?.data || []) {
        groups[notificationDay(item.created_at || item.recorded_at)].push(item)
    }

    return open && <section className="notification-page" aria-label="Student notifications">
        <header className="notification-page-heading">
            <h2>Notifications</h2>
            <p>Stay updated with announcements, payment schedules, and important account activities.</p>
        </header>
        <dl className="notification-overview">
            <div><dt>Total Notifications</dt><dd>{total == null ? '—' : total.toLocaleString()}</dd></div>
            <div><dt>Unread Notifications</dt><dd>{totalCount !== null ? unread.toLocaleString() : '—'}</dd></div>
        </dl>
        <section className="notification-inbox" aria-label="Notification inbox">
            <div className="notification-toolbar">
                <nav className="notification-inbox-filters" aria-label="Filter notifications">
                    {['all', 'unread', 'read'].map(value => <button key={value} type="button" aria-pressed={filter === value}
                        onClick={() => {
                            if (value !== filter) {
                                setFilter(value)
                                setPage(1)
                                setResult(null)
                            }
                        }}>
                        {value[0].toUpperCase() + value.slice(1)}
                        {counts[value] != null && <span>{counts[value].toLocaleString()}</span>}
                    </button>)}
                </nav>
                <div className="notification-inbox-actions">
                    <button type="button" disabled={busy || unread === 0} onClick={() => markRead({ all: true })}>Mark all as read</button>
                    <button type="button" disabled={busy} onClick={() => setVersion(value => value + 1)}>Refresh</button>
                </div>
            </div>
            {error && <p role="alert" className="account-error">{error}</p>}
            {!result ? <p className="notification-inbox-empty" role="status">{error ? 'Unable to load notifications. Try Refresh.' : 'Loading notifications…'}</p> : <>
                {!result.data.length && <div className="notification-inbox-empty">
                    <strong>{filter === 'unread' ? 'You’re all caught up.' : 'No notifications to show.'}</strong>
                    <p>{filter === 'all' ? 'Updates to your account will appear here.' : `There are no ${filter} notifications.`}</p>
                </div>}
                {Object.entries(groups).filter(([, items]) => items.length).map(([day, items]) => <section className="notification-date-group" key={day}>
                    <h3>{day}</h3>
                    <ul className="notification-inbox-list">{items.map(item => {
                        const fields = notificationFields(item)
                        const context = fields.filter(([name]) => ['Organization', 'Academic period'].includes(name)).map(([, value]) => value).join(' · ')
                        return <li key={item.id} className={item.read_at ? 'notification-entry' : 'notification-entry is-unread'}>
                            <details className="notification-detail">
                                <summary>
                                    <NotificationIcon kind={item.kind} />
                                    <div className="notification-inbox-content">
                                        <div className="notification-inbox-title">
                                            <h4>{item.title}</h4>
                                            {!item.read_at && <span className="notification-unread-dot" aria-label="Unread" />}
                                        </div>
                                        {context && <p className="notification-context">{context}</p>}
                                        <p className="notification-preview">{item.message}</p>
                                        <div className="notification-item-meta">
                                            <time dateTime={notificationDate(item.created_at || item.recorded_at)?.toISOString()}>{formatDate(item.created_at || item.recorded_at)}</time>
                                            <span>{item.read_at ? 'Read' : 'Unread'}</span>
                                            <span className="notification-expand-label">View details</span>
                                        </div>
                                    </div>
                                    <svg className="notification-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
                                </summary>
                                <div className="notification-detail-body">
                                    <h5>{item.kind === 'PAYMENT_WINDOW' ? 'Payment instructions' : 'Notification details'}</h5>
                                    <p>{item.message}</p>
                                    <dl>{fields.map(([label, value, type]) => <div key={label}>
                                        <dt>{label}</dt><dd>{type === 'date' ? formatDate(value) : value}</dd>
                                    </div>)}</dl>
                                </div>
                            </details>
                            {!item.read_at && <div className="notification-entry-actions">
                                <button className="notification-mark-read" type="button" disabled={busy}
                                    aria-label={`Mark as read: ${item.title}`} onClick={() => markRead({ id: item.id })}>Mark as read</button>
                            </div>}
                        </li>
                    })}</ul>
                </section>)}
                {result.pagination.pages > 1 && <footer className="notification-inbox-pagination">
                    <span>{result.pagination.total} notifications · Page {result.pagination.page} of {result.pagination.pages}</span>
                    <div>
                        <button type="button" disabled={busy || result.pagination.page <= 1} onClick={() => { setPage(result.pagination.page - 1); setResult(null) }}>Previous</button>
                        <button type="button" disabled={busy || result.pagination.page >= result.pagination.pages} onClick={() => { setPage(result.pagination.page + 1); setResult(null) }}>Next</button>
                    </div>
                </footer>}
            </>}
        </section>
    </section>
}

function NotificationIcon({ kind }) {
    const payment = kind.startsWith('PAYMENT')
    const violation = kind === 'VIOLATION' || kind === 'ABSENT'
    const attendance = ['PRESENT', 'ATTENDANCE'].includes(kind)
    const account = kind.startsWith('ACCOUNT') || kind === 'ACTIVATION'
    return <span className="notification-inbox-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            {payment ? <><rect x="3" y="5" width="18" height="15" rx="3" /><path d="M3 10h18M7 15h3" /></>
                : violation ? <><path d="m12 3 10 17H2L12 3Z" /><path d="M12 9v4m0 3h.01" /></>
                    : attendance ? <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4m10-4v4M3 10h18m-13 5 3 3 5-5" /></>
                        : account ? <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>
                            : <><circle cx="12" cy="12" r="9" /><path d="M12 11v6m0-10h.01" /></>}
        </svg>
    </span>
}

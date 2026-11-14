import { apiFetch } from '../utils/apiFetch'
import '../css/student/Notifications.css'
import { useCallback, useEffect, useState } from 'react'

function formatDate(value) {
    return new Date(value.replace(' ', 'T') + '+08:00').toLocaleString('en-PH', {
        timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short'
    })
}

export default function StudentNotificationCenter({ accessToken, open, onUnreadChange }) {
    const [unread, setUnread] = useState(0)
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
                if (open) setResult(body)
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

    return open && <section className="notification-inbox" aria-label="Notifications inbox">
        <header className="notification-inbox-header">
            <h2>Notifications <span aria-label={`${unread} unread`}>{unread} unread</span></h2>
            <div className="notification-inbox-actions">
                <button type="button" disabled={busy || unread === 0} onClick={() => markRead({ all: true })}>Mark all as read</button>
                <button type="button" disabled={busy} onClick={() => setVersion(v => v + 1)}>Refresh</button>
            </div>
        </header>
        <nav className="notification-inbox-filters" aria-label="Filter notifications">
            {['all', 'unread', 'read'].map(value => <button key={value} type="button" aria-pressed={filter === value}
                onClick={() => { if (value !== filter) { setFilter(value); setPage(1); setResult(null) } }}>
                {value[0].toUpperCase() + value.slice(1)}
            </button>)}
        </nav>
        {error && <p role="alert" className="account-error">{error}</p>}
        {!result ? <p className="notification-inbox-empty" role="status">{error ? 'Unable to load notifications. Try Refresh.' : 'Loading notifications…'}</p> : <>
            {!result.data.length && <p className="notification-inbox-empty">{filter === 'all' ? 'No notifications yet.' : `No ${filter} notifications.`}</p>}
            <ul className="notification-inbox-list">{result.data.map(item => {
                const details = notificationDetails(item)
                return <li key={item.id}>
                    <article className={`notification-inbox-row ${item.read_at ? '' : 'is-unread'}`}>
                        <NotificationIcon kind={item.kind} />
                        <div className="notification-inbox-content">
                            <div className="notification-inbox-title"><h3>{item.title}</h3>{!item.read_at && <span className="notification-unread-dot" aria-label="Unread" />}</div>
                            <p className="notification-inbox-description" title={item.message}>{item.message}</p>
                            <div className="notification-inbox-meta">
                                {details.map((detail, index) => <span key={index} title={detail}>{detail}</span>)}
                                <time dateTime={item.recorded_at.replace(' ', 'T') + '+08:00'}>{formatDate(item.recorded_at)}</time>
                            </div>
                        </div>
                        {!item.read_at && <button className="notification-mark-read" type="button" disabled={busy}
                            aria-label={`Mark as read: ${item.title}`} onClick={() => markRead({ id: item.id })}>Mark as read</button>}
                    </article>
                </li>
            })}</ul>
            {result.pagination.pages > 1 && <footer className="notification-inbox-pagination">
                <button type="button" disabled={busy || result.pagination.page <= 1} onClick={() => { setPage(result.pagination.page - 1); setResult(null) }}>Previous</button>
                <span>Page {result.pagination.page} of {result.pagination.pages}</span>
                <button type="button" disabled={busy || result.pagination.page >= result.pagination.pages} onClick={() => { setPage(result.pagination.page + 1); setResult(null) }}>Next</button>
            </footer>}
        </>}
    </section>
}

function notificationDetails(item) {
    const event = item.message.match(/"([^"\n]+)"/)
    const amount = item.message.match(/₱[\d,.]+/)
    const dates = item.kind === 'PAYMENT_WINDOW' ? (item.message.match(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/g) || []) : []
    return [event?.[1], amount?.[0], dates.length === 2 ? `${formatDate(dates[0])} – ${formatDate(dates[1])}` : null].filter(Boolean)
}

function NotificationIcon({ kind }) {
    const payment = kind === 'PAYMENT_WINDOW'
    const warning = kind === 'VIOLATION' || kind === 'ABSENT'
    return <span className={`notification-inbox-icon ${payment ? 'is-payment' : warning ? 'is-warning' : 'is-attendance'}`} aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            {payment ? <><rect x="3" y="5" width="18" height="15" rx="3" /><path d="M3 10h18M7 15h3" /></>
                : warning ? <><path d="m12 3 10 17H2L12 3Z" /><path d="M12 9v4m0 3h.01" /></>
                    : <><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></>}
        </svg>
    </span>
}

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
    const [version, setVersion] = useState(0)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')
    const request = useCallback(async (path, options = {}) => {
        const response = await fetch(`/api/student/notifications${path}`, {
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
                const body = await request(open ? `?page=${page}` : '/unread', {
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
    }, [request, open, page, version, onUnreadChange])

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

    return <>
        {open && <section>
            <h2 className="portal-greeting">Notifications</h2>
            <p>Your attendance, violations, and fines stay here even when browser push is disabled.</p>
            <div className="student-notification-actions">
                <button type="button" disabled={busy || unread === 0} onClick={() => markRead({ all: true })}>Mark all as read</button>
                <button type="button" disabled={busy} onClick={() => setVersion(v => v + 1)}>Refresh</button>
                <span role="status">{unread} unread</span>
            </div>
            {error && <p role="alert" className="account-error">{error}</p>}
            {!result ? <p>Loading notifications…</p> : <>
                {!result.data.length && <div className="student-panel"><h3>No notifications yet</h3><p>New attendance and violation records will appear here.</p></div>}
                <ul className="student-notification-list">{result.data.map(item => <li key={item.id}>
                    <article className={`student-panel student-notification-card ${item.read_at ? '' : 'is-unread'}`}>
                        <div className="student-notification-heading"><h3>{item.title}</h3>{!item.read_at && <span className="student-notification-new">New</span>}</div>
                        <p>{item.message}</p>
                        <time dateTime={item.recorded_at.replace(' ', 'T') + '+08:00'}>{formatDate(item.recorded_at)}</time>
                        {!item.read_at && <div className="student-notification-actions"><button type="button" disabled={busy} onClick={() => markRead({ id: item.id })}>Mark as read</button></div>}
                    </article>
                </li>)}</ul>
                <div className="student-notification-actions">
                    <button type="button" disabled={busy || result.pagination.page <= 1} onClick={() => {
                        setPage(result.pagination.page - 1)
                        setResult(null)
                    }}>Previous</button>
                    <span>Page {result.pagination.page} of {result.pagination.pages}</span>
                    <button type="button" disabled={busy || result.pagination.page >= result.pagination.pages} onClick={() => {
                        setPage(result.pagination.page + 1)
                        setResult(null)
                    }}>Next</button>
                </div>
            </>}
        </section>}
    </>
}

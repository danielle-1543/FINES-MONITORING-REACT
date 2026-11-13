import { useEffect, useState } from 'react'

export default function AppErrorNotice() {
    const [offline, setOffline] = useState(() => navigator.onLine === false)
    const [failed, setFailed] = useState(false)
    useEffect(() => {
        const connection = () => setOffline(navigator.onLine === false)
        const rejection = event => {
            if (event.reason?.name !== 'AbortError') setFailed(true)
        }
        const runtime = event => {
            // Resource failures do not mean the user's action failed.
            if (event.error) setFailed(true)
        }
        window.addEventListener('online', connection)
        window.addEventListener('offline', connection)
        window.addEventListener('unhandledrejection', rejection)
        window.addEventListener('error', runtime)
        return () => {
            window.removeEventListener('online', connection)
            window.removeEventListener('offline', connection)
            window.removeEventListener('unhandledrejection', rejection)
            window.removeEventListener('error', runtime)
        }
    }, [])
    if (!offline && !failed) return null
    return <aside className="app-error-notice" role="alert">
        <p>{offline ? 'You are offline. Reconnect before loading or saving records.'
            : 'An unexpected error occurred. Reload the page. If you were saving a record, check its status before submitting it again.'}</p>
        {!offline && <div>
            <button type="button" onClick={() => window.location.reload()}>Reload page</button>
            <button type="button" onClick={() => setFailed(false)}>Dismiss</button>
        </div>}
    </aside>
}

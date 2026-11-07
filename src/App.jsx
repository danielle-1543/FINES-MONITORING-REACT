import { useEffect, useState } from 'react'
import AdminDashboard from './pages/admin/AdminDashboard'
import Login from './pages/auth/Login'
import StudentActivation from './pages/auth/StudentActivation'
import StudentAccount from './pages/student/StudentAccount'
import OrganizationDashboard from './pages/organization/OrganizationDashboard'
export default function App() {
    const [session, setSession] = useState(() => {
        try {
            const saved = JSON.parse(sessionStorage.getItem('fines-session'))
            return saved?.user && saved?.tokens?.access_token && saved?.tokens?.refresh_token ? saved : null
        } catch {
            return null
        }
    })
    useEffect(() => {
        try {
            if (session) {
                sessionStorage.setItem('fines-session', JSON.stringify(session))
            } else {
                sessionStorage.removeItem('fines-session')
            }
        } catch {/* Storage can be disabled by browser settings. */ }
    }, [session])
    const [activation, setActivation] = useState(() => {
        return window.location.hash === '#activate'
    })
    const [notice, setNotice] = useState('')
    useEffect(() => {
        const changed = () => {
            return setActivation(window.location.hash === '#activate')
        }
        window.addEventListener('hashchange', changed)
        return () => {
            return window.removeEventListener('hashchange', changed)
        }
    }, [])
    useEffect(() => {
        if (!session) {
            return
        }
        let active = true
        let timer
        async function refresh() {
            try {
                const response = await fetch('/api/auth/refresh', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Accept: 'application/json'
                    },
                    body: JSON.stringify({
                        refresh_token: session.tokens.refresh_token
                    })
                })
                const result = await response.json()
                if (!active) {
                    return
                }
                if (response.ok && result.success) {
                    setSession(result)
                    return
                }
                if ([401, 403].includes(response.status)) {
                    sessionStorage.removeItem('fines-session')
                    setSession(null)
                    setNotice(result.error || 'Please log in again.')
                    return
                }
                timer = setTimeout(refresh, 30000)
            } catch {
                if (active) {
                    timer = setTimeout(refresh, 30000)
                }
            }
        }
        let expires = Date.now()
        try {
            expires = JSON.parse(atob(session.tokens.access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).exp * 1000
        } catch {/* Refresh malformed or expired stored sessions. */ }
        timer = setTimeout(refresh, Math.max(0, expires - Date.now() - 60000))
        return () => {
            active = false
            clearTimeout(timer)
        }
    }, [session])
    function showActivation(value) {
        setActivation(value)
        window.history.replaceState(null, '', window.location.pathname + window.location.search + (value ? '#activate' : ''))
    }
    function logout(message) {
        const refreshToken = session?.tokens?.refresh_token
        sessionStorage.removeItem('fines-session')
        setSession(null)
        setNotice(typeof message === 'string' ? message : 'You have been logged out.')
        showActivation(false)
        if (refreshToken) {
            fetch('/api/auth/logout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json'
                },
                body: JSON.stringify({
                    refresh_token: refreshToken
                }),
                keepalive: true
            }).then(response => {
                if (!response.ok) {
                    console.error('Refresh token revocation failed during logout.')
                }
            }).catch(() => {
                return console.error('The API could not be reached during logout.')
            })
        }
    }
    if (!session) {
        return activation ? <StudentActivation
            onBack={() => {
                return showActivation(false)
            }}
            onComplete={message => {
                setNotice(message)
                showActivation(false)
            }}
        /> : <Login
            notice={notice}
            onActivate={() => {
                setNotice('')
                showActivation(true)
            }}
            onLogin={data => {
                setSession(data)
                setNotice('')
                showActivation(false)
            }}
        />
    }
    if (session.user.role === 'STUDENT') {
        return <StudentAccount
            user={session.user}
            accessToken={session.tokens.access_token}
            onLogout={logout}
            onAccountUpdated={account => {
                return setSession(current => {
                    return current ? {
                        ...current,
                        user: {
                            ...current.user,
                            ...account
                        }
                    } : null
                })
            }}
        />
    }
    if (session.user.role === 'ORGANIZATION') {
        return <OrganizationDashboard
            user={session.user}
            accessToken={session.tokens.access_token}
            onLogout={logout}
            onAccountUpdated={account => {
                return setSession(current => {
                    return current ? {
                        ...current,
                        user: {
                            ...current.user,
                            ...account
                        }
                    } : null
                })
            }}
        />
    }
    if (session.user.role !== 'ADMIN') {
        return <main>
            <h1>Fines Monitoring System</h1>
            <p>Welcome, {session.user.username}. Your dashboard is not available yet.</p>
            <button
                type="button"
                onClick={logout}
            >Log Out</button>
        </main>
    }
    return <AdminDashboard
        user={session.user}
        accessToken={session.tokens.access_token}
        onLogout={logout}
        onAccountUpdated={account => {
            return setSession(current => {
                return current ? {
                    ...current,
                    user: {
                        ...current.user,
                        ...account
                    }
                } : null
            })
        }}
    />
}

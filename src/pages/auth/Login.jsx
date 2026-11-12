
import PasswordInput from '../../components/PasswordInput'
import { useState } from 'react'
import { trackEvent } from '../../config/posthog'
import '../../css/auth/Account.css'

// Get the deployed API URL from the Vite environment variable.
const API_URL = import.meta.env.VITE_API_URL?.replace(/\/+$/, '')

function Login({
    onLogin,
    onActivate,
    notice
}) {
    const [identifier, setIdentifier] = useState('')
    const [password, setPassword] = useState('')

    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    async function handleSubmit(event) {
        event.preventDefault()
        setError('')
        setLoading(true)

        try {
            if (!API_URL) {
                throw new Error('API URL is not configured. Check VITE_API_URL.')
            }

            // Send login request directly to the deployed PHP API.
            const response = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json'
                },
                body: JSON.stringify({
                    identifier: identifier.trim(),
                    password
                })
            })

            const contentType = response.headers.get('content-type') || ''

            if (!contentType.includes('application/json')) {
                const responseText = await response.text()

                console.error('Non-JSON API response:', {
                    status: response.status,
                    response: responseText
                })

                throw new Error(
                    'The API returned a non-JSON response. Check the PHP API login route.'
                )
            }

            const data = await response.json()

            if (!response.ok || data.success !== true) {
                trackEvent('login_failed', {
                    reason: response.status === 401
                        ? 'authentication_rejected'
                        : 'request_rejected'
                })

                throw new Error(
                    data.message || data.error || 'Login failed.'
                )
            }

            if (!data.tokens?.access_token || !data.user) {
                throw new Error(
                    'The login response is missing account or token data.'
                )
            }

            trackEvent('login_success', {
                role: data.user.role
            })

            setPassword('')
            onLogin(data)

        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : 'Unable to connect to the API.'
            )
        } finally {
            setLoading(false)
        }
    }

    return (
        <main className="account-page login-page">
            <section className="account-card">
                <img
                    className="login-logo"
                    src="/mindoro-state-university-logo.jpg"
                    alt="Mindoro State University logo"
                    width="80"
                    height="80"
                />

                <h1>Fines Monitoring System</h1>
                <h2>Log In</h2>

                {notice && (
                    <p role="status" className="account-success">
                        {notice}
                    </p>
                )}

                <form onSubmit={handleSubmit}>
                    <div>
                        <label htmlFor="identifier">
                            Username or email
                        </label>

                        <input
                            id="identifier"
                            type="text"
                            autoComplete="username"
                            value={identifier}
                            onChange={event => setIdentifier(event.target.value)}
                            disabled={loading}
                            required
                        />
                    </div>

                    <div>
                        <label htmlFor="password">Password</label>

                        <PasswordInput
                            id="password"
                            autoComplete="current-password"
                            value={password}
                            onChange={event => setPassword(event.target.value)}
                            disabled={loading}
                            required
                        />
                    </div>

                    <button type="submit" disabled={loading}>
                        {loading ? 'Logging in…' : 'Log In'}
                    </button>
                </form>

                {error && <p role="alert">{error}</p>}

                <p className="account-back-link">
                    Not activated yet?{' '}
                    <a
                        href="#activate"
                        aria-disabled={loading || undefined}
                        onClick={event => {
                            event.preventDefault()

                            if (!loading) {
                                onActivate()
                            }
                        }}
                    >
                        Activate your student account
                    </a>
                </p>
            </section>
        </main>
    )
}

export default Login

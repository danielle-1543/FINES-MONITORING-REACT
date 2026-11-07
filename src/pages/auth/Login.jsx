import PasswordInput from '../../components/PasswordInput'
import { useState } from 'react'
import '../../css/auth/Account.css'
function Login({
    onLogin,
    onActivate,
    notice
}) {
    // Store what the user types into the form.
    const [identifier, setIdentifier] = useState('')
    const [password, setPassword] = useState('')

    // Track the request and display feedback.
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    async function handleSubmit(event) {
        // Stop the browser from submitting and reloading the page.
        event.preventDefault()
        setError('')
        setLoading(true)
        try {
            // Vite forwards this request to LavaLust on port 3000.
            const response = await fetch('/api/auth/login', {
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

            // Detect an HTML error page instead of attempting to parse it as JSON.
            const contentType = response.headers.get('content-type') || ''
            if (!contentType.includes('application/json')) {
                throw new Error('The API returned a non-JSON response. Check the LavaLust terminal and login route.')
            }
            const data = await response.json()

            // LavaLust's API helper may return errors under "error".
            if (!response.ok || data.success !== true) {
                throw new Error(data.message || data.error || 'Login failed.')
            }
            if (!data.tokens?.access_token || !data.user) {
                throw new Error('The login response is missing account or token data.')
            }
            setPassword('')
            onLogin(data)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unable to connect to the API.')
        } finally {
            // Re-enable the form whether the request succeeds or fails.
            setLoading(false)
        }
    }
    return <main className="account-page login-page">
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
            {notice && <p
                role="status"
                className="account-success"
            >{notice}</p>}

            <form onSubmit={handleSubmit}>
                <div>
                    <label htmlFor="identifier">Username or email</label>
                    <input
                        id="identifier"
                        type="text"
                        autoComplete="username"
                        value={identifier}
                        onChange={event => {
                            return setIdentifier(event.target.value)
                        }}
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
                        onChange={event => {
                            return setPassword(event.target.value)
                        }}
                        disabled={loading}
                        required
                    />
                </div>

                <button
                    type="submit"
                    disabled={loading}
                >
                    {loading ? 'Logging in…' : 'Log In'}
                </button>
            </form>

            {error && <p role="alert">{error}</p>}
            <p className="account-back-link">Not activated yet? <a
                href="#activate"
                aria-disabled={loading || undefined}
                onClick={event => {
                    event.preventDefault()
                    if (!loading) {
                        onActivate()
                    }
                }}
            >Activate your student account</a></p>
        </section>
    </main>
}
export default Login

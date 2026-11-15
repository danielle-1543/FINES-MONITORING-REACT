import { useState } from 'react'
import PasswordInput from './PasswordInput'
import { otpRequest, withEmailOtp } from '../utils/emailOtp'

export default function ForgotPassword({ onBack }) {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmation, setConfirmation] = useState('')
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')
    const [notice, setNotice] = useState('')
    async function submit(event) {
        event.preventDefault()
        if (busy) return
        setError(''); setNotice('')
        if (password !== confirmation) { setError('Passwords do not match.'); return }
        setBusy(true)
        try {
            const result = await withEmailOtp({
                request: () => otpRequest('/api/auth/otp/request', { purpose: 'password_reset', email }),
                message: 'If an active account matches this email, a code has been sent.',
                verify: otp => otpRequest('/api/auth/password/reset', { email, password, password_confirmation: confirmation, ...otp })
            })
            setPassword(''); setConfirmation(''); setNotice(result.message)
        } catch (err) { setError(err.message) }
        finally { setBusy(false) }
    }
    return <main className="account-page"><section className="account-card">
        <h1>Reset password</h1>
        <p>Enter your account email and choose a new password. Confirm the change with the code sent to your email.</p>
        {error && <p role="alert">{error}</p>}
        {notice && <p role="status">{notice}</p>}
        <form onSubmit={submit}>
            <label>Email<input type="email" required maxLength={150} autoComplete="email" value={email} disabled={busy} onChange={event => setEmail(event.target.value)} /></label>
            <label>New password<PasswordInput required minLength={8} maxLength={72} autoComplete="new-password" value={password} disabled={busy} onChange={event => setPassword(event.target.value)} /></label>
            <label>Confirm new password<PasswordInput required minLength={8} maxLength={72} autoComplete="new-password" value={confirmation} disabled={busy} onChange={event => setConfirmation(event.target.value)} /></label>
            <button disabled={busy}>{busy ? 'Verifying…' : 'Send verification code'}</button>
        </form>
        <button type="button" disabled={busy} onClick={onBack}>Back to login</button>
    </section></main>
}

import { apiFetch } from '../../utils/apiFetch'
import { confirmSensitive } from '../../utils/confirmation'
import PasswordInput from '../../components/PasswordInput'
import { useEffect, useRef, useState } from 'react'
import { trackEvent } from '../../config/posthog'
import '../../css/auth/Account.css'
async function request(path, body) {
    await confirmSensitive(path, body)
    const response = await apiFetch(`/api/student/activation/${path}`, {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body),
        cache: 'no-store'
    })
    const result = await response.json().catch(() => {
        throw new Error('Unable to read the API response. Check that the API is running.')
    })
    if (!response.ok || !result.success) {
        throw new Error(result.message || result.error || 'Activation failed.')
    }
    return result
}
async function release(reader, starting) {
    if (!reader) {
        return
    }
    try {
        await starting
    } catch {/* Failed startup still needs cleanup. */ }
    try {
        if (reader.isScanning) {
            await reader.stop()
        }
    } catch {/* Camera may be disconnected. */ }
    try {
        reader.clear()
    } catch {/* The page may have been unmounted. */ }
}
export default function StudentActivation({
    onBack,
    onComplete
}) {
    const [pair, setPair] = useState({
        qr_token: '',
        activation_code: ''
    })
    const [student, setStudent] = useState(null)
    const [identified, setIdentified] = useState(null)
    const [form, setForm] = useState({
        username: '',
        email: '',
        password: '',
        password_confirmation: ''
    })
    const [error, setError] = useState('')
    const [busy, setBusy] = useState(false)
    const [cameraBusy, setCameraBusy] = useState(false)
    const [running, setRunning] = useState(false)
    const scanner = useRef(null)
    const starting = useRef(null)
    const mounted = useRef(false)
    const lock = useRef(false)
    const decoded = useRef(false)
    useEffect(() => {
        mounted.current = true
        return () => {
            mounted.current = false
            void release(scanner.current, starting.current)
        }
    }, [])
    async function stopCamera() {
        setCameraBusy(true)
        await release(scanner.current, starting.current)
        scanner.current = null
        if (mounted.current) {
            setRunning(false)
            setCameraBusy(false)
        }
    }
    async function startCamera() {
        if (scanner.current || cameraBusy) {
            return
        }
        setCameraBusy(true)
        setError('')
        decoded.current = false
        try {
            const {
                Html5Qrcode
            } = await import('html5-qrcode')
            if (!mounted.current) {
                return
            }
            const reader = new Html5Qrcode('activation-reader')
            scanner.current = reader
            starting.current = reader.start({
                facingMode: 'environment'
            }, {
                fps: 10,
                qrbox: {
                    width: 230,
                    height: 230
                }
            }, value => {
                if (decoded.current || !mounted.current) {
                    return
                }
                if (!/^[a-f0-9]{64}$/i.test(value.trim())) {
                    return
                }
                decoded.current = true
                void identify(value.trim())
            }, () => { })
            await starting.current
            if (mounted.current && !decoded.current) {
                setRunning(true)
            }
        } catch (err) {
            await release(scanner.current, starting.current)
            scanner.current = null
            if (mounted.current) {
                setError(`Camera unavailable: ${err.message || err}. Allow camera access on localhost/HTTPS.`)
            }
        } finally {
            if (mounted.current) {
                setCameraBusy(false)
            }
        }
    }
    async function identify(token) {
        setBusy(true)
        setError('')
        setIdentified(null)
        try {
            await stopCamera()
            const result = await request('identify', {
                qr_token: token
            })
            if (mounted.current) {
                setPair({
                    qr_token: token,
                    activation_code: ''
                })
                setIdentified(result.data)
            }
        } catch (err) {
            if (mounted.current) {
                setError(err.message)
            }
        } finally {
            if (mounted.current) {
                setBusy(false)
            }
        }
    }
    async function verify(event) {
        event.preventDefault()
        if (lock.current) {
            return
        }
        lock.current = true
        setBusy(true)
        setError('')
        try {
            const submittedPair = {
                ...pair
            }
            decoded.current = true
            await stopCamera()
            const result = await request('preview', submittedPair)
            if (mounted.current) {
                setPair(submittedPair)
                setStudent(result.data)
                setForm(current => {
                    return {
                        ...current,
                        username: result.data.student_number
                    }
                })
            }
        } catch (err) {
            if (mounted.current) {
                setError(err.message)
            }
        } finally {
            lock.current = false
            if (mounted.current) {
                setBusy(false)
            }
        }
    }
    async function activate(event) {
        event.preventDefault()
        if (lock.current) {
            return
        }
        if (form.password !== form.password_confirmation) {
            setError('Passwords do not match.')
            return
        }
        lock.current = true
        setBusy(true)
        setError('')
        try {
            const result = await request('complete', {
                ...pair,
                ...form
            })
            trackEvent('account_activated', {
                role: 'STUDENT'
            })
            if (mounted.current) {
                setPair({
                    qr_token: '',
                    activation_code: ''
                })
                setForm({
                    username: '',
                    email: '',
                    password: '',
                    password_confirmation: ''
                })
                onComplete(result.message)
            }
        } catch (err) {
            if (mounted.current) {
                setError(err.message)
            }
        } finally {
            lock.current = false
            if (mounted.current) {
                setBusy(false)
            }
        }
    }
    return <main className="account-page">
        <section className="account-card">
            <h1>Student Account Activation</h1>
            <p>Use the QR code and one-time activation code assigned by your administrator.</p>
            {error && <p
                role="alert"
                className="account-error"
            >{error}</p>}
            {!student ? <>
                <h2>Scan your assigned QR code</h2>
                <div className="account-actions">
                    <button
                        type="button"
                        disabled={busy || cameraBusy || running}
                        onClick={startCamera}
                    >Start Camera</button>
                    <button
                        type="button"
                        disabled={cameraBusy || !running}
                        onClick={stopCamera}
                    >Stop Camera</button>
                </div>
                <div
                    id="activation-reader"
                    className="account-reader"
                />
                <form onSubmit={verify}>
                    {identified ? <div
                        className="account-identity"
                        aria-live="polite"
                    >
                        <h3>Is this your student record?</h3>
                        <dl>{Object.entries({
                            Name: identified.full_name,
                            'Student Number': identified.student_number,
                            Course: identified.course,
                            'Year Level': identified.year_level,
                            Section: identified.section
                        }).map(([label, value]) => {
                            return <div key={label}>
                                <dt>{label}</dt>
                                <dd>{value}</dd>
                            </div>
                        })}</dl>
                        <p>If these details are yours, enter your one-time activation code below.</p>
                        <button
                            type="button"
                            disabled={busy}
                            onClick={() => {
                                setIdentified(null)
                                setPair({
                                    qr_token: '',
                                    activation_code: ''
                                })
                                setError('')
                            }}
                        >Scan a different QR code</button>
                    </div> : <p>Scan your assigned QR code to see your name, course, year level, and section here.</p>}
                    <label>One-time activation code<input
                        required
                        maxLength={12}
                        pattern="[A-Fa-f0-9]{12}"
                        autoComplete="off"
                        value={pair.activation_code}
                        disabled={busy || !identified}
                        onChange={e => {
                            return setPair({
                                ...pair,
                                activation_code: e.target.value.toUpperCase()
                            })
                        }}
                    /></label>
                    <button disabled={busy}>{busy ? 'Verifying…' : 'Verify QR and Code'}</button>
                </form>
            </> : <>
                <h2>Create your login</h2><p><strong>{student.full_name}</strong><br />{student.student_number} · {student.course} · {student.year_level} · {student.section}</p>
                <form onSubmit={activate}>
                    <label>Username<input
                        autoComplete="username"
                        required
                        minLength={3}
                        maxLength={50}
                        pattern="[A-Za-z0-9_.\-]+"
                        disabled={busy}
                        value={form.username}
                        onChange={e => {
                            return setForm({
                                ...form,
                                username: e.target.value
                            })
                        }}
                    /></label>
                    <label>Email<input
                        type="email"
                        autoComplete="email"
                        required
                        maxLength={150}
                        disabled={busy}
                        value={form.email}
                        onChange={e => {
                            return setForm({
                                ...form,
                                email: e.target.value
                            })
                        }}
                    /></label>
                    <label>Password<PasswordInput
                        autoComplete="new-password"
                        required
                        minLength={8}
                        maxLength={72}
                        disabled={busy}
                        value={form.password}
                        onChange={e => {
                            return setForm({
                                ...form,
                                password: e.target.value
                            })
                        }}
                    /></label>
                    <label>Confirm password<PasswordInput
                        autoComplete="new-password"
                        required
                        minLength={8}
                        maxLength={72}
                        disabled={busy}
                        value={form.password_confirmation}
                        onChange={e => {
                            return setForm({
                                ...form,
                                password_confirmation: e.target.value
                            })
                        }}
                    /></label>
                    <button disabled={busy}>{busy ? 'Activating…' : 'Activate Account'}</button>
                    <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                            setStudent(null)
                            setIdentified(null)
                            setForm({
                                username: '',
                                email: '',
                                password: '',
                                password_confirmation: ''
                            })
                            setPair({
                                qr_token: '',
                                activation_code: ''
                            })
                            setError('')
                        }}
                    >Use another QR code</button>
                </form>
            </>}
            <p className="account-back-link">Already activated? <a
                href="#login"
                aria-disabled={busy || undefined}
                onClick={event => {
                    event.preventDefault()
                    if (!busy) {
                        onBack()
                    }
                }}
            >Back to Log In</a></p>
        </section>
    </main>
}

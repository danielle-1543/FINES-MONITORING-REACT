import { useEffect, useRef, useState } from 'react'
import PasswordInput from './PasswordInput'
async function request(path, token, body, signal) {
    const response = await fetch(`/api/account${path}`, {
        method: body ? 'POST' : 'GET',
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
            ...(body ? {
                'Content-Type': 'application/json'
            } : {})
        },
        body: body ? JSON.stringify(body) : undefined,
        cache: 'no-store',
        signal
    })
    const data = await response.json()
    if (!response.ok || !data.success) {
        throw new Error(data.message || data.error || 'Unable to load account.')
    }
    return data
}
function SettingsModal({
    data,
    kind,
    accessToken,
    onClose,
    onSaved,
    onLogout
}) {
    const [form, setForm] = useState({
        username: data.username,
        email: data.email,
        organization_name: data.organization_name || '',
        current_password: '',
        password: '',
        password_confirmation: ''
    })
    const [error, setError] = useState(''),
        [busy, setBusy] = useState(false)
    const dialog = useRef(null),
        lock = useRef(false)
    useEffect(() => {
        const element = dialog.current
        element.showModal()
        return () => {
            return element.close()
        }
    }, [])
    const field = key => {
        return {
            value: form[key],
            disabled: busy,
            onChange: e => {
                return setForm(current => {
                    return {
                        ...current,
                        [key]: e.target.value
                    }
                })
            }
        }
    }
    async function submit(event) {
        event.preventDefault()
        if (lock.current) {
            return
        }
        lock.current = true
        setBusy(true)
        setError('')
        try {
            const body = kind === 'password' ? {
                current_password: form.current_password,
                password: form.password,
                password_confirmation: form.password_confirmation
            } : {
                username: form.username,
                email: form.email,
                current_password: form.current_password,
                ...(data.role === 'ORGANIZATION' ? {
                    organization_name: form.organization_name
                } : {})
            }
            const result = await request(kind === 'password' ? '/password' : '/update', accessToken, body)
            if (kind === 'password') {
                onLogout(result.message)
            } else {
                onSaved(result)
            }
        } catch (err) {
            setError(err.message)
        } finally {
            lock.current = false
            setBusy(false)
        }
    }
    return <dialog
        ref={dialog}
        className="account-card student-profile-modal"
        aria-label={kind === 'password' ? 'Change password' : 'Update account details'}
        onCancel={event => {
            event.preventDefault()
            if (!busy) {
                onClose()
            }
        }}
    >
        <h2>{kind === 'password' ? 'Change Password' : 'Update Account Details'}</h2>
        {kind === 'password' && <p>Changing your password signs out all sessions, including this one.</p>}
        {error && <p
            className="account-error"
            role="alert"
        >{error}</p>}
        <form onSubmit={submit}>
            {kind !== 'password' && <>{data.role === 'ORGANIZATION' && <label>Organization name<input
                required
                maxLength={150}
                {...field('organization_name')}
            /></label>}
                <label>Username<input
                    required
                    minLength={3}
                    maxLength={50}
                    pattern="[A-Za-z0-9_.\-]+"
                    autoComplete="username"
                    {...field('username')}
                /></label>
                <label>Email<input
                    type="email"
                    required
                    maxLength={150}
                    autoComplete="email"
                    {...field('email')}
                /></label></>}
            <label>Current password<PasswordInput
                required
                maxLength={72}
                autoComplete="current-password"
                {...field('current_password')}
            /></label>
            {kind === 'password' && <><label>New password<PasswordInput
                required
                minLength={8}
                maxLength={72}
                autoComplete="new-password"
                {...field('password')}
            /></label><label>Confirm new password<PasswordInput
                required
                minLength={8}
                maxLength={72}
                autoComplete="new-password"
                {...field('password_confirmation')}
            /></label></>}
            <button disabled={busy}>{busy ? 'Saving…' : kind === 'password' ? 'Change password & sign out' : 'Save details'}</button>
            <button
                type="button"
                disabled={busy}
                onClick={onClose}
            >Cancel</button>
        </form>
    </dialog>
}
export default function AccountSettings({
    accessToken,
    onAccountUpdated,
    onLogout
}) {
    const [data, setData] = useState(null),
        [error, setError] = useState(''),
        [notice, setNotice] = useState(''),
        [modal, setModal] = useState(null)
    useEffect(() => {
        const controller = new AbortController()
        request('', accessToken, undefined, controller.signal).then(result => {
            return setData(result.data)
        }).catch(err => {
            if (err.name !== 'AbortError') {
                setError(err.message)
            }
        })
        return () => {
            return controller.abort()
        }
    }, [accessToken])
    return <div className="student-content">
        <h2 className="portal-greeting">Account Settings</h2>
        {error && <p
            role="alert"
            className="account-error"
        >{error}</p>}
        {notice && <p
            role="status"
            className="account-success"
        >{notice}</p>}
        {!data ? <p>Loading account…</p> : <><section className="account-card student-profile-card">
            <h2>Profile & Security</h2>
            <dl>{Object.entries({
                Username: data.account.username,
                Email: data.account.email,
                Role: data.account.role,
                ...(data.account.role === 'ORGANIZATION' ? {
                    Organization: data.account.organization_name,
                    'Student access': data.programs === null ? 'All programs' : data.programs.join(', ')
                } : {})
            }).map(([label, value]) => {
                return <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                </div>
            })}</dl>
            <div className="student-profile-links">
                <button onClick={() => {
                    return setModal('details')
                }}>Update details</button>
                <button onClick={() => {
                    return setModal('password')
                }}>Change password</button>
            </div>
        </section>
            {modal && <SettingsModal
                data={data.account}
                kind={modal}
                accessToken={accessToken}
                onClose={() => {
                    return setModal(null)
                }}
                onLogout={onLogout}
                onSaved={result => {
                    setData(result.data)
                    setModal(null)
                    setNotice(result.message)
                    onAccountUpdated?.(result.data.account)
                }}
            />}</>}
    </div>
}

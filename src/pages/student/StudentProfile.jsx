import PasswordInput from '../../components/PasswordInput'
import { useEffect, useRef, useState } from 'react'
import { studentRequest } from './studentApi'
function ProfileModal({
    title,
    busy,
    onClose,
    children
}) {
    const dialog = useRef(null)
    useEffect(() => {
        const element = dialog.current
        element.showModal()
        return () => {
            return element.close()
        }
    }, [])
    return <dialog
        ref={dialog}
        className="account-card student-profile-modal"
        aria-label={title}
        onCancel={event => {
            event.preventDefault()
            if (!busy) {
                onClose()
            }
        }}
    >
        <h3>{title}</h3>
        {children}
        <button
            type="button"
            className="account-link"
            disabled={busy}
            onClick={onClose}
        >Cancel</button>
    </dialog>
}
export default function StudentProfile({
    accessToken,
    onAccountUpdated,
    onPasswordChanged
}) {
    const [data, setData] = useState(null),
        [form, setForm] = useState({
            username: '',
            email: '',
            current_password: ''
        })
    const [password, setPassword] = useState({
        current_password: '',
        password: '',
        password_confirmation: ''
    })
    const [error, setError] = useState(''),
        [notice, setNotice] = useState(''),
        [busy, setBusy] = useState(false)
    const [modal, setModal] = useState(null)
    function closeModal() {
        if (busy) {
            return
        }
        setModal(null)
        setError('')
        setPassword({
            current_password: '',
            password: '',
            password_confirmation: ''
        })
        setForm({
            ...data.account,
            current_password: ''
        })
    }
    function openModal(value) {
        setError('')
        setNotice('')
        setModal(value)
    }
    const lock = useRef(false)
    useEffect(() => {
        const controller = new AbortController()
        studentRequest('account', accessToken, undefined, controller.signal).then(result => {
            setData(result.data)
            setForm({
                ...result.data.account,
                current_password: ''
            })
            setError('')
        }).catch(err => {
            if (err.name !== 'AbortError') {
                setError(err.message)
            }
        })
        return () => {
            return controller.abort()
        }
    }, [accessToken])
    async function submit(event, changePassword) {
        event.preventDefault()
        if (lock.current) {
            return
        }
        if (changePassword && password.password !== password.password_confirmation) {
            setError('Passwords do not match.')
            return
        }
        lock.current = true
        setBusy(true)
        setError('')
        setNotice('')
        try {
            const result = await studentRequest(changePassword ? 'account/password' : 'account/update', accessToken, changePassword ? password : form)
            setPassword({
                current_password: '',
                password: '',
                password_confirmation: ''
            })
            if (changePassword) {
                onPasswordChanged(result.message)
                return
            }
            setData(result.data)
            setForm({
                ...result.data.account,
                current_password: ''
            })
            setNotice(result.message)
            setModal(null)
            onAccountUpdated?.(result.data.account)
        } catch (err) {
            setError(err.message)
        } finally {
            lock.current = false
            setBusy(false)
        }
    }
    return <div className="student-profile-details">
        {error && !modal && <p
            role="alert"
            className="account-error"
        >{error}</p>}
        {notice && <p
            role="status"
            className="account-success"
        >{notice}</p>}
        {!data ? <p>Loading your profile…</p> : <>
            <section className="account-card student-profile-card">
                <h2>Student Details</h2>
                <dl>{Object.entries({
                    'Student Number': data.profile.student_number,
                    Name: data.profile.full_name,
                    Course: data.profile.course,
                    'Year Level': data.profile.year_level,
                    Section: data.profile.section,
                    Account: data.profile.account_status,
                    Activation: data.profile.activation_status
                }).map(([label, value]) => {
                    return <div key={label}>
                        <dt>{label}</dt>
                        <dd>{value}</dd>
                    </div>
                })}</dl>
                <div className="student-profile-links">
                    <button
                        type="button"
                        onClick={() => {
                            return openModal('details')
                        }}
                    >Update details</button>
                    <button
                        type="button"
                        onClick={() => {
                            return openModal('password')
                        }}
                    >Change password</button>
                </div>
            </section>
            {modal === 'details' && <ProfileModal
                title="Update Login Details"
                busy={busy}
                onClose={closeModal}
            >
                <p>School-managed details must be corrected by the administrator.</p>
                {error && <p
                    role="alert"
                    className="account-error"
                >{error}</p>}
                <form onSubmit={e => {
                    return submit(e, false)
                }}>
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
                    <label>Current password<PasswordInput
                        autoComplete="current-password"
                        required
                        maxLength={72}
                        disabled={busy}
                        value={form.current_password}
                        onChange={e => {
                            return setForm({
                                ...form,
                                current_password: e.target.value
                            })
                        }}
                    /></label>
                    <button disabled={busy}>{busy ? 'Saving…' : 'Save Account Details'}</button>
                </form>
            </ProfileModal>}
            {modal === 'password' && <ProfileModal
                title="Change Password"
                busy={busy}
                onClose={closeModal}
            >
                {error && <p
                    role="alert"
                    className="account-error"
                >{error}</p>}
                <p>Changing your password signs out all student sessions, including this one.</p>
                <form onSubmit={e => {
                    return submit(e, true)
                }}>
                    <label>Current password<PasswordInput
                        autoComplete="current-password"
                        required
                        maxLength={72}
                        disabled={busy}
                        value={password.current_password}
                        onChange={e => {
                            return setPassword({
                                ...password,
                                current_password: e.target.value
                            })
                        }}
                    /></label>
                    <label>New password<PasswordInput
                        autoComplete="new-password"
                        required
                        minLength={8}
                        maxLength={72}
                        disabled={busy}
                        value={password.password}
                        onChange={e => {
                            return setPassword({
                                ...password,
                                password: e.target.value
                            })
                        }}
                    /></label>
                    <label>Confirm new password<PasswordInput
                        autoComplete="new-password"
                        required
                        minLength={8}
                        maxLength={72}
                        disabled={busy}
                        value={password.password_confirmation}
                        onChange={e => {
                            return setPassword({
                                ...password,
                                password_confirmation: e.target.value
                            })
                        }}
                    /></label>
                    <button disabled={busy}>{busy ? 'Saving…' : 'Change Password & Sign Out'}</button>
                </form>
            </ProfileModal>}
        </>}
    </div>
}

import { apiRequest } from '../../utils/apiRequest'
import { useEffect, useRef, useState } from 'react'
import PasswordInput from '../../components/PasswordInput'
import { downloadExcel } from '../../utils/exportExcel'
import '../../css/admin/StudentManagement.css'
import '../../css/admin/OrganizationManagement.css'
const blank = {
    organization_name: '',
    username: '',
    email: '',
    organization_scope: 'COURSE',
    organization_programs: [],
    password: ''
}
function request(path, token, body, signal) {
    return apiRequest(`/api/admin/organizations${path}`, token, body || undefined, signal, {
        failureMessage: 'Unable to load organizations.'
    })
}
function OrganizationForm({
    initial,
    programs,
    accessToken,
    onClose,
    onSaved
}) {
    const [form, setForm] = useState(() => {
        return {
            ...blank,
            ...initial,
            organization_programs: initial.organization_programs || [],
            password: ''
        }
    })
    const [error, setError] = useState('')
    const [busy, setBusy] = useState(false)
    const dialog = useRef(null),
        lock = useRef(false)
    const editing = Boolean(initial.id)
    const scopeLocked = Boolean(Number(initial.scope_locked))
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
            onChange: e => {
                return setForm(current => {
                    return {
                        ...current,
                        [key]: e.target.value
                    }
                })
            },
            disabled: busy
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
            const payload = Object.fromEntries(Object.keys(blank).map(key => {
                return [key, form[key]]
            }))
            if (editing) {
                payload.id = initial.id
                delete payload.password
            }
            const result = await request(editing ? '/update' : '/create', accessToken, payload)
            onSaved(result.message)
        } catch (err) {
            setError(err.message)
        } finally {
            lock.current = false
            setBusy(false)
        }
    }
    return <dialog
        ref={dialog}
        className="org-account-modal account-card"
        aria-label={editing ? 'Edit organization' : 'Create organization'}
        onCancel={e => {
            e.preventDefault()
            if (!busy) {
                onClose()
            }
        }}
    >
        <h2>{editing ? 'Edit Organization' : 'New Organization Account'}</h2>
        <p>Set up the account and the students this organization can access.</p>
        {error && <p
            role="alert"
            className="account-error"
        >{error}</p>}
        <form onSubmit={submit}>
            <fieldset disabled={busy}>
                <legend>Account details</legend>
                <label>Organization name<input
                    required
                    maxLength={150}
                    placeholder="e.g., College of Computer Studies"
                    {...field('organization_name')}
                /></label>
                <div className="org-account-fields">
                    <label>Username<input
                        required
                        minLength={3}
                        maxLength={50}
                        pattern="[A-Za-z0-9_.\-]+"
                        autoComplete="off"
                        {...field('username')}
                    /></label>
                    <label>Email<input
                        type="email"
                        required
                        maxLength={150}
                        {...field('email')}
                    /></label>
                </div>
                {!editing && <label>Initial password<PasswordInput
                    autoComplete="new-password"
                    required
                    minLength={8}
                    maxLength={72}
                    {...field('password')}
                /></label>}
            </fieldset>
            <fieldset disabled={busy}>
                <legend>Student access</legend>
                <label>Access type<select
                    {...field('organization_scope')}
                    disabled={busy || scopeLocked}
                >
                    <option value="COURSE">Selected programs</option>
                    <option value="ALL">All programs (USG)</option>
                </select></label>
                {form.organization_scope === 'COURSE' && <><p className="org-account-note">Choose one or more programs this organization can manage.</p><div className="org-program-choices">{Object.entries(programs).map(([code, name]) => {
                    return <label
                        key={code}
                        className={form.organization_programs.includes(code) ? 'is-selected' : ''}
                    >
                        <input
                            type="checkbox"
                            disabled={busy || scopeLocked}
                            checked={form.organization_programs.includes(code)}
                            onChange={e => {
                                return setForm(current => {
                                    return {
                                        ...current,
                                        organization_programs: e.target.checked ? [...current.organization_programs, code] : current.organization_programs.filter(value => {
                                            return value !== code
                                        })
                                    }
                                })
                            }}
                        />
                        <span>
                            <strong>{code}</strong>
                            <small>{name}</small>
                        </span>
                    </label>
                })}</div><p className="org-account-note">{form.organization_programs.length} programs selected</p></>}
                {scopeLocked && <p className="org-account-note">Program access is locked because this organization already has records.</p>}
            </fieldset>
            <div className="org-account-form-actions">
                <button
                    type="button"
                    disabled={busy}
                    onClick={onClose}
                >Cancel</button>
                <button disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Create account'}</button>
            </div>
        </form>
    </dialog>
}
export default function OrganizationManagement({
    accessToken
}) {
    const [filters, setFilters] = useState({
        search: '',
        program: '',
        page: 1
    })
    const [result, setResult] = useState(null),
        [modal, setModal] = useState(null)
    const [version, setVersion] = useState(0),
        [error, setError] = useState(''),
        [notice, setNotice] = useState('')
    const [exporting, setExporting] = useState(false),
        [loading, setLoading] = useState(true)
    const query = new URLSearchParams(filters).toString()
    useEffect(() => {
        const controller = new AbortController()
        const timer = setTimeout(async () => {
            try {
                const data = await request(`?${query}`, accessToken, undefined, controller.signal)
                setResult(data)
                setError('')
            } catch (err) {
                if (err.name !== 'AbortError') {
                    setError(err.message)
                }
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false)
                }
            }
        }, 200)
        return () => {
            clearTimeout(timer)
            controller.abort()
        }
    }, [query, accessToken, version])
    function filter(key, value) {
        setFilters(current => {
            return {
                ...current,
                [key]: value,
                page: 1
            }
        })
        setLoading(true)
    }
    async function exportExcel() {
        setExporting(true)
        try {
            downloadExcel(await request(`/export?${query}`, accessToken), 'organization-accounts.xlsx')
        } catch (err) {
            setError(err.message)
        } finally {
            setExporting(false)
        }
    }
    return <div className="student-management organization-management">
        <header className="sm-head">
            <div>
                <small>ADMINISTRATION</small>
                <h1>Organizations</h1>
                <p>Manage organization accounts and their access to student records.</p>
            </div>
            <button
                onClick={() => {
                    setModal(blank)
                    setNotice('')
                }}
                disabled={!result}
            >New Organization</button>
        </header>
        {error && <p
            role="alert"
            className="sm-alert error"
        >{error}</p>}
        {notice && <p
            role="status"
            className="sm-alert success"
        >{notice}</p>}
        {result && <section className="sm-summary org-account-summary">{[['Organizations', 'total']].map(([label, key]) => {
            return <article key={key}>
                <span>{label}</span>
                <b>{result.summary[key]}</b>
            </article>
        })}</section>}
        <section className="sm-panel sm-filter-panel">
            <div className="sm-panel-head">
                <div className="sm-filter-heading">
                    <span
                        className="sm-filter-symbol"
                        aria-hidden="true"
                    >
                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.6"
                        >
                            <path d="M4 7h16M4 17h16M8 4v6m8 4v6" />
                        </svg>
                    </span>
                    <div>
                        <h2>Search & Filters</h2>
                        <p>Find an organization and check its student access.</p>
                    </div>
                </div>
                <div className="sm-actions sm-filter-actions">
                    <button
                        onClick={() => {
                            setVersion(v => {
                                return v + 1
                            })
                            setLoading(true)
                        }}
                    >Refresh</button>
                    <button
                        disabled={exporting}
                        onClick={exportExcel}
                    >{exporting ? 'Exporting…' : 'Export Excel'}</button>
                </div>
            </div>
            <div className="sm-filters org-account-filters">
                <label className="sm-search-field">Search organizations<span className="sm-search-control">
                    <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        aria-hidden="true"
                    >
                        <circle
                            cx="10.5"
                            cy="10.5"
                            r="6.5"
                        />
                        <path d="m16 16 4 4" />
                    </svg>
                    <input
                        maxLength={100}
                        placeholder="Organization, username or email"
                        value={filters.search}
                        onChange={e => {
                            return filter('search', e.target.value)
                        }}
                    />
                </span></label>
                <label>Student access<select
                    value={filters.program}
                    onChange={e => {
                        return filter('program', e.target.value)
                    }}
                >
                    <option value="">All programs</option>
                    {Object.keys(result?.programs || {}).map(program => {
                        return <option key={program}>{program}</option>
                    })}
                </select></label>
                <button
                    onClick={() => {
                        setFilters({
                            search: '',
                            program: '',
                            page: 1
                        })
                        setLoading(true)
                    }}
                >Clear</button>
            </div>
        </section>
        <section className="sm-panel">
            <div className="sm-panel-head">
                <h2>Organization Accounts</h2>
                <span>{result?.pagination.total_records ?? 0} matching organizations</span>
            </div>
            {loading ? <p>Loading organizations…</p> : !result?.data.length ? <p>No organizations match your filters.</p> : <div className="sm-table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th>Organization</th>
                            <th>Username</th>
                            <th>Email</th>
                            <th>Student access</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>{result.data.map(org => {
                        return <tr key={org.id}>
                            <td>
                                <span className="org-account-name">
                                    <span
                                        className="admin-avatar"
                                        aria-hidden="true"
                                    >{org.organization_name?.charAt(0).toUpperCase()}</span>
                                    <strong>{org.organization_name}</strong>
                                </span>
                            </td>
                            <td>{org.username}</td>
                            <td>{org.email}</td>
                            <td>
                                <span className="admin-course-tag">{org.student_access}</span>
                            </td>
                            <td>
                                <button
                                    className="sm-btn"
                                    onClick={() => {
                                        setModal(org)
                                        setNotice('')
                                    }}
                                >Edit</button>
                            </td>
                        </tr>
                    })}</tbody>
                </table>
            </div>}
            {result && <div className="sm-pagination">
                <span>Page {result.pagination.current_page} of {result.pagination.total_pages}</span>
                <div>
                    <button
                        disabled={loading || result.pagination.current_page <= 1}
                        onClick={() => {
                            setFilters(current => {
                                return {
                                    ...current,
                                    page: result.pagination.current_page - 1
                                }
                            })
                            setLoading(true)
                        }}
                    >Previous</button>
                    <button
                        disabled={loading || result.pagination.current_page >= result.pagination.total_pages}
                        onClick={() => {
                            setFilters(current => {
                                return {
                                    ...current,
                                    page: result.pagination.current_page + 1
                                }
                            })
                            setLoading(true)
                        }}
                    >Next</button>
                </div>
            </div>}
        </section>
        {modal && <OrganizationForm
            initial={modal}
            programs={result?.programs || {}}
            accessToken={accessToken}
            onClose={() => {
                return setModal(null)
            }}
            onSaved={message => {
                setModal(null)
                setNotice(message)
                setVersion(v => {
                    return v + 1
                })
                setLoading(true)
            }}
        />}
    </div>
}

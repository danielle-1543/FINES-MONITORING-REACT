import { apiRequest } from '../../utils/apiRequest'
import { money } from '../../utils/format'
import OrganizationOverview from './OrganizationOverview'
import AccountSettings from '../../components/AccountSettings'
import { useCallback, useEffect, useRef, useState } from 'react'
import '../../css/organization/Organization.css'
import { downloadExcel } from '../../utils/exportExcel'
import Payments from '../student/Payments'
import StudentRecord from './StudentRecord'
import PortalLayout from '../../components/PortalLayout'
function api(path, token, body, signal) {
    return apiRequest(`/api/org/${path}`, token, body, signal, {
        invalidResponseMessage: 'The API returned an invalid response.'
    })
}
const emptyEvent = {
    name: '',
    event_type: 'ATTENDANCE',
    violation_type_id: '',
    absence_fine_amount: '0.00',
    scan_starts_at: '',
    scan_ends_at: ''
}
function useNow() {
    const [now, setNow] = useState(Date.now)
    useEffect(() => {
        const timer = setInterval(() => {
            return setNow(Date.now())
        }, 1000)
        return () => {
            return clearInterval(timer)
        }
    }, [])
    return now
}
function windowStatus(event, now) {
    const start = new Date(event.scan_starts_at.replace(' ', 'T') + '+08:00').getTime()
    const end = new Date(event.scan_ends_at.replace(' ', 'T') + '+08:00').getTime()
    return now < start ? 'SCHEDULED' : now > end ? 'ENDED' : 'OPEN'
}
function pht(value) {
    if (!value) {
        return '—'
    }
    const date = new Date(String(value).replace(' ', 'T') + '+08:00')
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('en-PH', {
        timeZone: 'Asia/Manila'
    })
}
function Modal({
    title,
    children,
    onClose
}) {
    const ref = useRef(null)
    useEffect(() => {
        const dialog = ref.current
        dialog.showModal()
        return () => {
            return dialog.close()
        }
    }, [])
    return <dialog
        ref={ref}
        className="org-dialog"
        aria-label={title}
        onCancel={event => {
            event.preventDefault()
            onClose()
        }}
    >
        <h2>{title}</h2>
        {children}
    </dialog>
}
function DownloadExcel({
    path,
    accessToken,
    filename
}) {
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')
    return <div>
        <button
            className="secondary"
            disabled={busy}
            onClick={async () => {
                setBusy(true)
                setError('')
                try {
                    const result = await api(path, accessToken)
                    downloadExcel(result, filename)
                } catch (err) {
                    setError(err.message)
                } finally {
                    setBusy(false)
                }
            }}
        >{busy ? 'Exporting…' : 'Export Excel'}</button>
        {error && <p role="alert">{error}</p>}
    </div>
}
function Pagination({
    pagination,
    onPage
}) {
    if (!pagination) {
        return null
    }
    return <div className="org-pagination">
        <span>{pagination.total_records} records · Page {pagination.current_page} of {pagination.total_pages}</span>
        <div className="org-actions">
            <button
                className="secondary"
                disabled={pagination.current_page <= 1}
                onClick={() => {
                    return onPage(pagination.current_page - 1)
                }}
            >Previous</button>
            <button
                className="secondary"
                disabled={pagination.current_page >= pagination.total_pages}
                onClick={() => {
                    return onPage(pagination.current_page + 1)
                }}
            >Next</button>
        </div>
    </div>
}
function EventForm({
    types,
    initial = emptyEvent,
    onSave,
    saving,
    onCancel
}) {
    const [form, setForm] = useState({ ...emptyEvent, ...initial })
    const field = key => {
        return {
            value: form[key],
            onChange: event => {
                return setForm(current => {
                    return {
                        ...current,
                        [key]: event.target.value
                    }
                })
            }
        }
    }
    return <form
        className="org-form"
        onSubmit={async event => {
            event.preventDefault()
            if (await onSave(form)) {
                setForm(emptyEvent)
            }
        }}
    >
        <label>Event name<input
            required
            maxLength={150}
            {...field('name')}
        /></label>
        {form.event_type === 'VIOLATION' && <label>Legacy violation type<select
            required
            {...field('violation_type_id')}
        >
            <option value="">None / Attendance</option>
            {types.map(type => {
                return <option
                    key={type.id}
                    value={type.id}
                >{type.name} — {money(type.fine_amount)}</option>
            })}
        </select></label>}
        {form.event_type === 'ATTENDANCE' && <label>Absence fine (PHP)<input
            type="number"
            min="0"
            max="99999999.99"
            step="0.01"
            required
            {...field('absence_fine_amount')}
        /><small>Charged to rostered students marked absent after the event ends. Enter 0 for no absence fine.</small></label>}
        <label>Scanning starts<input
            type="datetime-local"
            required
            {...field('scan_starts_at')}
        /></label>
        <label>Scanning ends<input
            type="datetime-local"
            required
            min={form.scan_starts_at || undefined}
            {...field('scan_ends_at')}
        /></label>
        <div className="org-actions">
            <button
                disabled={saving}
                type="submit"
            >{initial.id ? 'Save Event Changes' : 'Create Attendance Event'}</button>
            {onCancel && <button
                type="button"
                className="secondary"
                disabled={saving}
                onClick={onCancel}
            >Cancel</button>}
        </div>
    </form>
}
function ViolationTypes({
    types,
    action,
    saving
}) {
    const [type, setType] = useState({
        name: '',
        fine_amount: ''
    })
    return <section className="org-panel">
        <h3>Create Violation Type</h3>
        <p>Create your organization's own violations and fine amounts. Other organizations manage their own lists.</p>
        <form
            className="org-form"
            onSubmit={async event => {
                event.preventDefault()
                if (await action('violation-types/create', type)) {
                    setType({
                        name: '',
                        fine_amount: ''
                    })
                }
            }}
        >
            <label>Violation name<input
                required
                maxLength={120}
                placeholder="e.g., Improper uniform"
                value={type.name}
                onChange={event => {
                    return setType({
                        ...type,
                        name: event.target.value
                    })
                }}
            /></label>
            <label>Fine amount (PHP)<input
                type="number"
                min="0"
                max="99999999.99"
                step="0.01"
                required
                value={type.fine_amount}
                onChange={event => {
                    return setType({
                        ...type,
                        fine_amount: event.target.value
                    })
                }}
            /></label>
            <button disabled={saving}>Create Violation Type</button>
        </form>
        <h4>Existing Violation Types</h4>
        {!types.length ? <p>No violation types yet.</p> : <div className="org-table">
            <table>
                <thead>
                    <tr>
                        <th>Violation</th>
                        <th>Fine (PHP)</th>
                    </tr>
                </thead>
                <tbody>{types.map(item => {
                    return <tr key={item.id}>
                        <td>{item.name}</td>
                        <td>{money(item.fine_amount)}</td>
                    </tr>
                })}</tbody>
            </table>
        </div>}
    </section>
}
function Events({
    events,
    types,
    action,
    saving,
    openScanner,
    error,
    now
}) {
    const [editing, setEditing] = useState(null)
    const [creating, setCreating] = useState(false)
    return <>
        <h2>Attendance Events</h2>
        <div className="org-actions">
            <button type="button" onClick={() => setCreating(true)}>Create new</button>
        </div>
        {creating && <Modal title="Create Attendance Event" onClose={() => {
            if (!saving) setCreating(false)
        }}>
            <p>Scanning opens and closes automatically at the scheduled times.</p>
            {error && <p role="alert" className="org-feedback error">{error}</p>}
            <EventForm types={types} saving={saving}
                onCancel={() => setCreating(false)}
                onSave={async form => {
                    if (await action('events/create', form)) {
                        setCreating(false)
                        return true
                    }
                    return false
                }} />
        </Modal>}
        <section className="org-panel">
            <h3>Manage Events</h3>
            {!events.length ? <p>No events yet.</p> : <div className="org-table">
                <table>
                    <thead>
                        <tr>
                            <th>Event</th>
                            <th>Type</th>
                            <th>Scan Window</th>
                            <th>Scanning</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>{events.map(event => {
                        return <tr key={event.id}>
                            <td>{event.name}</td>
                            <td>
                                {event.event_type}
                                {event.violation_name && <small>{event.violation_name} · {money(event.fine_amount)}</small>}
                                {event.event_type === 'ATTENDANCE' && <small>Absence fine: {money(event.absence_fine_amount)}</small>}
                            </td>
                            <td>{pht(event.scan_starts_at)}<br />to {pht(event.scan_ends_at)}</td>
                            <td>{windowStatus(event, now)}</td>
                            <td>
                                <div className="org-actions">
                                    {event.event_type === 'ATTENDANCE' && <button
                                        className="secondary"
                                        onClick={() => {
                                            return openScanner(event.id)
                                        }}
                                    >Open Attendance</button>}
                                    {!Number(event.scan_count) && <button
                                        className="secondary"
                                        onClick={() => {
                                            return setEditing({
                                                ...event,
                                                scan_starts_at: event.scan_starts_at.replace(' ', 'T').slice(0, 16),
                                                scan_ends_at: event.scan_ends_at.replace(' ', 'T').slice(0, 16),
                                                violation_type_id: event.violation_type_id || ''
                                            })
                                        }}
                                    >Edit Event</button>}
                                </div>
                            </td>
                        </tr>
                    })}</tbody>
                </table>
            </div>}
        </section>
        {editing && <Modal
            title="Edit Event"
            onClose={() => {
                if (!saving) {
                    setEditing(null)
                }
            }}
        >
            {error && <p
                role="alert"
                className="org-feedback error"
            >{error}</p>}
            <EventForm
                initial={editing}
                types={types}
                saving={saving}
                onCancel={() => {
                    return setEditing(null)
                }}
                onSave={async form => {
                    if (await action('events/edit', form)) {
                        setEditing(null)
                        return true
                    }
                    return false
                }}
            />
        </Modal>}
    </>
}
function RecordSorting({ filters, onChange }) {
    return <label className="org-field">Sort
        <select value={filters.sort || 'az'} onChange={event => onChange({ sort: event.target.value })}>
            <option value="az">A–Z</option>
            <option value="recent">Recent</option>
            <option value="za">Z–A</option>
        </select>
    </label>
}
function RecordTable({
    records,
    includeEvent = false,
    showAttendance = true
}) {
    return !records.length ? <p>No records yet.</p> : <div className="org-table">
        <table>
            <thead>
                <tr>
                    <th>Course</th>
                    <th>Year Level</th>
                    <th>Section</th>
                    <th>Name</th>
                    <th>Student Number</th>
                    {includeEvent && <th>Event</th>}
                    {showAttendance && <th>Attendance Status</th>}
                    <th>Recorded Violations</th>
                    <th>Fine (PHP)</th>
                    <th>Recorded At</th>
                </tr>
            </thead>
            <tbody>{records.map(record => {
                return <tr key={record.id}>
                    <td>{record.course}</td>
                    <td>{record.year_level}</td>
                    <td>{record.section}</td>
                    <td>{record.full_name}</td>
                    <td>{record.student_number}</td>
                    {includeEvent && <td>{record.event_name}</td>}
                    {showAttendance && <td>{record.attendance_status || '—'}</td>}
                    <td>
                        {record.record_type === 'ATTENDANCE'
                            ? record.additional_violations || 'None'
                            : [record.violation_name, record.additional_violations].filter(Boolean).join(', ') || 'None'}
                    </td>
                    <td>{money(record.total_fine ?? record.fine_amount)}</td>
                    <td>{pht(record.recorded_at)}</td>
                </tr>
            })}</tbody>
        </table>
    </div>
}
async function releaseCamera(reader, starting) {
    if (!reader) {
        return
    }
    try {
        await starting
    } catch {/* Startup failed; still release its canvas below. */ }
    try {
        if (reader.isScanning) {
            await reader.stop()
        }
    } catch {/* Device may already be disconnected. */ }
    try {
        reader.clear()
    } catch {/* The component may already be removed. */ }
}
function EventScanner({
    event = null,
    types = [],
    accessToken,
    now
}) {
    const [feedback, setFeedback] = useState('')
    const [confirmation, setConfirmation] = useState(null)
    const [pending, setPending] = useState(false)
    const [cameraBusy, setCameraBusy] = useState(false)
    const [running, setRunning] = useState(false)
    const [records, setRecords] = useState([])
    const [recordFilters, setRecordFilters] = useState({ student_number: '', section: '', year_level: '', attendance_status: '' })
    const [loading, setLoading] = useState(true)
    const [page, setPage] = useState(1)
    const [pagination, setPagination] = useState(null)
    const [selectedViolations, setSelectedViolations] = useState([])
    const [duplicateWarning, setDuplicateWarning] = useState(null)
    const eventId = event?.id
    const accepting = !event || windowStatus(event, now) === 'OPEN'
    const [refreshVersion, setRefreshVersion] = useState(0)
    useEffect(() => {
        const timer = setInterval(() => {
            return setRefreshVersion(value => {
                return value + 1
            })
        }, 15000)
        return () => {
            return clearInterval(timer)
        }
    }, [])
    const recordQuery = new URLSearchParams({
        ...(eventId ? { event_id: eventId } : { record_type: 'VIOLATION' }),
        ...recordFilters
    }).toString()
    const reader = useRef(null)
    const starting = useRef(null)
    const mounted = useRef(false)
    const busy = useRef(false)
    const cooldown = useRef(0)
    useEffect(() => {
        mounted.current = true
        const controller = new AbortController()
        api(`records?${recordQuery}&page=${page}`, accessToken, undefined, controller.signal).then(result => {
            setRecords(result.data)
            setPagination(result.pagination)
        }).catch(error => {
            if (error.name !== 'AbortError') {
                setFeedback(error.message)
            }
        }).finally(() => {
            if (!controller.signal.aborted) {
                setLoading(false)
            }
        })
        return () => {
            mounted.current = false
            controller.abort()
        }
    }, [recordQuery, page, accessToken, refreshVersion])
    useEffect(() => {
        return () => {
            void releaseCamera(reader.current, starting.current)
        }
    }, [])
    async function preview(value) {
        if (busy.current || Date.now() < cooldown.current || !mounted.current) {
            return
        }
        busy.current = true
        setPending(true)
        try {
            const token = value.trim()
            const result = await api(eventId ? 'scanner/preview' : 'violations/preview', accessToken, {
                event_id: eventId,
                qr_token: token
            })
            if (!mounted.current) {
                return
            }
            setSelectedViolations(result.data.default_violation_ids.map(Number))
            setDuplicateWarning(null)
            setConfirmation({
                ...result.data,
                token
            })
            setFeedback('Verify the student, then select Record or Cancel.')
        } catch (error) {
            if (mounted.current) {
                setFeedback(error.message)
            }
            busy.current = false
            cooldown.current = Date.now() + 1500
        } finally {
            if (mounted.current) {
                setPending(false)
            }
        }
    }
    function cancel() {
        if (pending) {
            return
        }
        setConfirmation(null)
        setDuplicateWarning(null)
        busy.current = false
        cooldown.current = Date.now() + 1500
        setFeedback('Scan canceled. Nothing was saved.')
    }
    async function record() {
        if (pending || !confirmation) {
            return
        }
        setPending(true)
        let keepConfirmation = false
        try {
            const result = await api(eventId ? 'scanner/record' : 'violations/record', accessToken, {
                event_id: eventId,
                qr_token: confirmation.token,
                violation_type_ids: selectedViolations,
                duplicate_confirmation: duplicateWarning?.duplicate_confirmation
            })
            if (!mounted.current) {
                return
            }
            if (result.requires_confirmation) {
                keepConfirmation = true
                setDuplicateWarning(result)
                setFeedback('Already recorded today. Review the existing violations before recording again.')
                return
            }
            setFeedback(result.message)
            try {
                const latest = await api(`records?${recordQuery}&page=${page}`, accessToken)
                if (mounted.current) {
                    setRecords(latest.data)
                    setPagination(latest.pagination)
                }
            } catch {
                if (mounted.current) {
                    setFeedback('Record saved. Reopen the scanner to refresh recent records.')
                }
            }
        } catch (error) {
            if (mounted.current) {
                setFeedback(error.message)
            }
        } finally {
            if (mounted.current) {
                setPending(false)
                if (!keepConfirmation) {
                    setConfirmation(null)
                    setDuplicateWarning(null)
                }
            }
            busy.current = keepConfirmation
            cooldown.current = Date.now() + 1500
        }
    }
    async function startCamera() {
        if (reader.current || cameraBusy) {
            return
        }
        setCameraBusy(true)
        try {
            const {
                Html5Qrcode
            } = await import('html5-qrcode')
            if (!mounted.current) {
                return
            }
            const scanner = new Html5Qrcode('org-qr-reader')
            reader.current = scanner
            starting.current = scanner.start({
                facingMode: 'environment'
            }, {
                fps: 10,
                qrbox: {
                    width: 250,
                    height: 250
                }
            }, value => {
                void preview(value)
            }, () => { })
            await starting.current
            if (!mounted.current) {
                return
            }
            setRunning(true)
            setFeedback('Camera started. Point it at a student QR code.')
        } catch (error) {
            await releaseCamera(reader.current, starting.current)
            reader.current = null
            if (mounted.current) {
                setFeedback(`Camera failed: ${error.message || error}. Allow camera access on localhost or HTTPS, or use the token field.`)
            }
        } finally {
            if (mounted.current) {
                setCameraBusy(false)
            }
        }
    }
    async function stopCamera() {
        setCameraBusy(true)
        await releaseCamera(reader.current, starting.current)
        reader.current = null
        if (mounted.current) {
            setRunning(false)
            setCameraBusy(false)
            setFeedback('Camera stopped.')
        }
    }
    return <>
        {event ? <p>Scanning: <strong>{windowStatus(event, now)}</strong> · {pht(event.scan_starts_at)} to {pht(event.scan_ends_at)}</p> : <p>Scan a student and choose one or more violations. This scanner is available anytime, with or without an attendance event.</p>}
        <div className="org-actions">
            <button
                onClick={startCamera}
                disabled={cameraBusy || running || !accepting}
            >{cameraBusy && !running ? 'Starting Camera…' : 'Start Camera'}</button>
            <button
                className="secondary"
                onClick={stopCamera}
                disabled={cameraBusy || !running}
            >Stop Camera</button>
        </div>
        <div
            id="org-qr-reader"
            className="org-reader"
        />
        <p
            role="status"
            aria-live="polite"
            className="org-feedback"
        >{feedback}</p>
        <div className="org-record-heading">
            <h3>{event ? `Attendance Records — ${event.name}` : 'Violation Records'}</h3>
            <DownloadExcel
                path={`records/export?${recordQuery}`}
                accessToken={accessToken}
                filename={event ? 'attendance-records.xlsx' : 'violation-records.xlsx'}
            />
        </div>
        <p>Export includes all matching records in the selected order.</p>
        <RecordSorting filters={recordFilters} onChange={changes => {
            setRecordFilters(current => ({ ...current, ...changes }))
            setPage(1)
            setLoading(true)
        }} />
        <div className="org-actions">
            {['student_number', 'section', 'year_level'].map(field => <label className="org-field" key={field}>
                {field === 'student_number' ? 'Student ID' : field === 'section' ? 'Section' : 'Year Level'}
                {field === 'year_level' ? <select value={recordFilters[field]} onChange={e => {
                    setRecordFilters(current => ({ ...current, [field]: e.target.value }))
                    setPage(1)
                    setLoading(true)
                }}>
                    <option value="">All year levels</option>
                    {['1st Year', '2nd Year', '3rd Year', '4th Year'].map(year => <option key={year}>{year}</option>)}
                </select> : <input value={recordFilters[field]} maxLength={100}
                    placeholder={field === 'student_number' ? 'Search student number' : 'e.g. F1'}
                    onChange={e => {
                        setRecordFilters(current => ({ ...current, [field]: e.target.value }))
                        setPage(1)
                        setLoading(true)
                    }} />}
            </label>)}
            {event && <label className="org-field">Attendance Status
                <select value={recordFilters.attendance_status} onChange={e => {
                    setRecordFilters(current => ({ ...current, attendance_status: e.target.value }))
                    setPage(1)
                    setLoading(true)
                }}>
                    <option value="">All statuses</option>
                    <option value="PRESENT">Present</option>
                    <option value="ABSENT">Absent</option>
                </select>
            </label>}
            {!event && <label className="org-field">Violation Type
                <select value={recordFilters.violation_name || ''} onChange={e => {
                    setRecordFilters(current => ({ ...current, violation_name: e.target.value }))
                    setPage(1)
                    setLoading(true)
                }}>
                    <option value="">All violation types</option>
                    {[...new Set(types.map(type => type.name))].map(name => <option key={name}>{name}</option>)}
                </select>
            </label>}
            <button type="button" className="secondary" onClick={() => {
                setRecordFilters({ student_number: '', section: '', year_level: '', attendance_status: '' })
                setPage(1)
            }}>Clear Filters</button>
        </div>
        {loading ? <p>Loading records…</p> : <><RecordTable
            records={records}
            includeEvent={!event}
            showAttendance={Boolean(event)}
        /><Pagination
                pagination={pagination}
                onPage={value => {
                    setPage(value)
                    setLoading(true)
                }}
            /></>}
        {confirmation && <Modal
            title={duplicateWarning ? 'Violation Already Recorded Today' : 'Confirm Scan'}
            onClose={cancel}
        >
            {Object.entries({
                'Student Number': confirmation.student.student_number,
                'Full Name': confirmation.student.full_name,
                Section: confirmation.student.section,
                Course: confirmation.student.course,
                'Year Level': confirmation.student.year_level,
                Event: confirmation.event_name,
                'Event Type': confirmation.event_type
            }).map(([label, value]) => {
                return <p key={label}>
                    <strong>{label}: </strong>
                    {value}
                </p>
            })}
            <fieldset
                className="org-violation-options"
                disabled={pending}
            >
                <legend>{eventId ? 'Violations observed (optional)' : 'Choose violations'}</legend>
                {!confirmation.violation_types.length && <p>No violation types yet. Create a violation type on the Violations page first.</p>}
                {confirmation.violation_types.map(type => {
                    return <label key={type.id}><input
                        type="checkbox"
                        checked={selectedViolations.includes(Number(type.id))}
                        disabled={confirmation.default_violation_ids.includes(Number(type.id))}
                        onChange={e => {
                            setDuplicateWarning(null)
                            return setSelectedViolations(current => {
                                return e.target.checked ? [...current, Number(type.id)] : current.filter(id => {
                                    return id !== Number(type.id)
                                })
                            })
                        }}
                    />
                        {type.name} — {money(type.fine_amount)}</label>
                })}
            </fieldset>
            <p>
                <strong>Selected fines: {money(confirmation.violation_types.filter(type => {
                    return selectedViolations.includes(Number(type.id))
                }).reduce((sum, type) => {
                    return sum + Number(type.fine_amount)
                }, 0))}</strong>
            </p>
            {duplicateWarning && <section role="alert" className="org-duplicate-warning">
                <h3>Are you sure you want to record this student again?</h3>
                <p>These selected violations were already recorded today. Continuing adds another fine for each selected violation.</p>
                <ul>
                    {duplicateWarning.existing_violations.map(item => <li key={item.record_key}>
                        <strong>{item.violation_name}</strong> — {money(item.fine_amount)}
                        <br />
                        {pht(item.recorded_at)} · {item.event_name || 'Standalone violation'}
                    </li>)}
                </ul>
                <p>Cancel saves nothing. You can also change the selected violations above.</p>
            </section>}
            <div className="org-actions">
                <button
                    disabled={pending || !accepting || !eventId && !selectedViolations.length}
                    onClick={record}
                >{pending ? 'Recording…' : duplicateWarning ? 'Yes, Record Again' : eventId ? 'Record Attendance' : 'Record Violations'}</button>
                <button
                    className="secondary"
                    disabled={pending}
                    onClick={cancel}
                >Cancel</button>
            </div>
        </Modal>}
    </>
}
function Scanner({
    events,
    selectedEvent,
    selectEvent,
    accessToken,
    now
}) {
    const event = events.find(item => {
        return String(item.id) === String(selectedEvent)
    })
    return <section className="org-panel">
        <h2>Attendance Scanner</h2>
        <label className="org-field">Event<select
            value={selectedEvent}
            onChange={e => {
                return selectEvent(e.target.value)
            }}
        >
            <option value="">Select event</option>
            {events.filter(item => {
                return item.event_type === 'ATTENDANCE'
            }).map(item => {
                return <option
                    key={item.id}
                    value={item.id}
                >{item.name} ({windowStatus(item, now)})</option>
            })}
        </select></label>
        {event ? <EventScanner
            key={event.id}
            event={event}
            accessToken={accessToken}
            now={now}
        /> : <p>Select an event to scan students and see its records.</p>}
    </section>
}
function Records({
    kind,
    accessToken,
    events
}) {
    const [eventId, setEventId] = useState('')
    const [filters, setFilters] = useState({ search: '', section: '', year_level: '', attendance_status: '' })
    const query = new URLSearchParams({ record_type: kind, event_id: eventId, ...filters }).toString()
    const [records, setRecords] = useState([])
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(true)
    const [page, setPage] = useState(1)
    const [pagination, setPagination] = useState(null)
    useEffect(() => {
        const controller = new AbortController()
        api(`records?${query}&page=${page}`, accessToken, undefined, controller.signal).then(result => {
            setRecords(result.data)
            setPagination(result.pagination)
        }).catch(err => {
            if (err.name !== 'AbortError') {
                setError(err.message)
            }
        }).finally(() => {
            if (!controller.signal.aborted) {
                setLoading(false)
            }
        })
        return () => {
            return controller.abort()
        }
    }, [query, page, accessToken])
    return <section className="org-panel">
        <h2>{kind === 'ATTENDANCE' ? 'Attendance' : 'Violations'}</h2>
        <div className="org-actions">
            {['search', 'section', 'year_level', 'attendance_status'].map(field => <label className="org-field" key={field}>
                {{ search: 'Search student', section: 'Section', year_level: 'Year Level', attendance_status: 'Attendance Status' }[field]}
                {['search', 'section'].includes(field) ? <input value={filters[field]}
                    placeholder={field === 'search' ? 'Student number or name' : 'e.g. F1'} maxLength={100}
                    onChange={e => {
                        setFilters(current => ({ ...current, [field]: e.target.value }))
                        setPage(1)
                        setLoading(true)
                    }} /> : <select value={filters[field]} onChange={e => {
                    setFilters(current => ({ ...current, [field]: e.target.value }))
                    setPage(1)
                    setLoading(true)
                }}>
                    <option value="">All</option>
                    {(field === 'year_level' ? ['1st Year', '2nd Year', '3rd Year', '4th Year'] : ['PRESENT', 'ABSENT']).map(value => <option key={value}>{value}</option>)}
                </select>}
            </label>)}
            <button type="button" className="secondary" onClick={() => {
                setFilters({ search: '', section: '', year_level: '', attendance_status: '' })
                setPage(1)
            }}>Clear Filters</button>
        </div>
        <RecordSorting filters={filters} onChange={changes => {
            setFilters(current => ({ ...current, ...changes }))
            setPage(1)
            setLoading(true)
        }} />
        <label className="org-field">Event<select
            value={eventId}
            onChange={e => {
                setEventId(e.target.value)
                setPage(1)
                setError('')
                setLoading(true)
                setRecords([])
            }}
        >
            <option value="">All events</option>
            {events.filter(event => {
                return event.event_type === kind
            }).map(event => {
                return <option
                    key={event.id}
                    value={event.id}
                >{event.name}</option>
            })}
        </select></label>
        {error && <p
            role="alert"
            className="org-feedback error"
        >{error}</p>}
        <DownloadExcel
            path={`records/export?${query}`}
            accessToken={accessToken}
            filename="attendance-records.xlsx"
        />
        {loading ? <p>Loading records…</p> : <><RecordTable
            records={records}
            includeEvent
        /><Pagination
                pagination={pagination}
                onPage={value => {
                    setPage(value)
                    setLoading(true)
                }}
            /></>}
    </section>
}
function StudentRecords({
    accessToken,
    scope
}) {
    const [filters, setFilters] = useState({
        search: '',
        course: '',
        year_level: '',
        section: '',
        page: 1
    })
    const [selectedStudent, setSelectedStudent] = useState(null)
    const [options, setOptions] = useState({ course: [], year_level: [] })
    const [result, setResult] = useState(null)
    const [error, setError] = useState('')
    const query = new URLSearchParams(filters).toString()
    useEffect(() => {
        const controller = new AbortController()
        const timer = setTimeout(() => {
            api(`students?${query}`, accessToken, undefined, controller.signal).then(response => {
                setResult(response)
                setOptions(response.filter_options)
                setError('')
            }).catch(err => {
                if (err.name !== 'AbortError') {
                    setError(err.message)
                }
            })
        }, 250)
        return () => {
            clearTimeout(timer)
            controller.abort()
        }
    }, [query, accessToken])
    return <section className="org-panel">
        <div className="org-record-heading">
            <h2>Student Records</h2>
            <DownloadExcel
                path={`students/export?${query}`}
                accessToken={accessToken}
                filename="student-records.xlsx"
            />
        </div>
        <p>{scope?.all_courses ? 'USG can view students from every course.' : `Student access: ${(scope?.courses || []).join(', ')} only.`}</p>
        <label className="org-field">Search students<input
            value={filters.search}
            placeholder="Student number, name, or section"
            onChange={e => {
                setFilters({
                    ...filters,
                    search: e.target.value,
                    page: 1
                })
                setResult(null)
                setError('')
            }}
        /></label>
        <div className="org-actions">
            {['course', 'year_level'].map(field => <label className="org-field" key={field}>
                {field === 'course' ? 'Course' : 'Year Level'}
                <select value={filters[field]} onChange={event => {
                    setFilters({ ...filters, [field]: event.target.value, page: 1 })
                    setResult(null)
                }}>
                    <option value="">All</option>
                    {(field === 'year_level' ? ['1st Year', '2nd Year', '3rd Year', '4th Year']
                        : scope?.all_courses ? options.course || [] : scope?.courses || []).filter(Boolean).map(value => <option key={value} value={value}>{value}</option>)}
                </select>
            </label>)}
            <label className="org-field">Section<input placeholder="e.g. F1" value={filters.section} maxLength={100}
                onChange={event => {
                    setFilters({ ...filters, section: event.target.value, page: 1 })
                    setResult(null)
                }} /></label>
            <button className="secondary" onClick={() => {
                setFilters({ search: '', course: '', year_level: '', section: '', page: 1 })
            }}>Clear Filters</button>
        </div>
        <RecordSorting filters={filters} onChange={changes => {
            setFilters(current => ({ ...current, ...changes, page: 1 }))
            setResult(null)
        }} />
        {error ? <p role="alert">{error}</p> : !result ? <p>Loading students…</p> : <>
            {!result.data.length ? <p>No students found.</p> : <div className="org-table">
                <table>
                    <thead>
                        <tr>
                            <th>Course</th>
                            <th>Year Level</th>
                            <th>Section</th>
                            <th>Full Name</th>
                            <th>Student Number</th>
                            <th>Account</th>
                            <th>Activation</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>{result.data.map(student => {
                        return <tr key={student.student_number}>
                            <td>{student.course}</td>
                            <td>{student.year_level}</td>
                            <td>{student.section}</td>
                            <td>{student.full_name}</td>
                            <td>{student.student_number}</td>
                            <td>{student.account_status}</td>
                            <td>{student.activation_status}</td>
                            <td><button onClick={() => setSelectedStudent(student.id)}>View Record</button></td>
                        </tr>
                    })}</tbody>
                </table>
            </div>}
            <Pagination
                pagination={result.pagination}
                onPage={page => {
                    setFilters(current => {
                        return {
                            ...current,
                            page
                        }
                    })
                    setResult(null)
                }}
            />
        </>}
        {selectedStudent && <StudentRecord studentId={selectedStudent} accessToken={accessToken} onClose={() => setSelectedStudent(null)} />}
    </section>
}
export default function OrganizationDashboard({
    user,
    accessToken,
    onLogout,
    onAccountUpdated
}) {
    const [page, setPage] = useState('dashboard')
    const [data, setData] = useState({
        events: [],
        types: []
    })
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [notice, setNotice] = useState('')
    const [selectedEvent, setSelectedEvent] = useState('')
    const saveLock = useRef(false)
    const now = useNow()
    const load = useCallback(async signal => {
        const result = await api('events', accessToken, undefined, signal)
        setData(result.data)
    }, [accessToken])
    useEffect(() => {
        const controller = new AbortController()
        api('events', accessToken, undefined, controller.signal).then(result => {
            return setData(result.data)
        }).catch(err => {
            if (err.name !== 'AbortError') {
                setError(err.message)
            }
        }).finally(() => {
            if (!controller.signal.aborted) {
                setLoading(false)
            }
        })
        return () => {
            return controller.abort()
        }
    }, [accessToken])
    async function action(path, body) {
        if (saveLock.current) {
            return false
        }
        saveLock.current = true
        setSaving(true)
        setError('')
        setNotice('')
        try {
            const result = await api(path, accessToken, body)
            setNotice(result.message)
            try {
                await load()
            } catch (err) {
                setError(`Saved, but unable to refresh: ${err.message}`)
            }
            return true
        } catch (err) {
            setError(err.message)
            return false
        } finally {
            saveLock.current = false
            setSaving(false)
        }
    }
    const nav = [['dashboard', 'Dashboard'], ['students', 'Student Records'], ['events', 'Events'], ['attendance', 'Attendance'], ['violations', 'Violations'], ['payments', 'Payments'], ['profile', 'Account Settings']]
    return <PortalLayout
        className="org-shell"
        role="Organization"
        account={user.organization_name || user.username}
        items={nav}
        page={page}
        onNavigate={key => {
            setPage(key)
            setError('')
            setNotice('')
        }}
        onLogout={onLogout}
    >
        <div className="org-content">
            {error && <p
                role="alert"
                className="org-feedback error"
            >{error}</p>}
            {notice && <p
                role="status"
                className="org-feedback success"
            >{notice}</p>}
            {loading ? <p>Loading organization records…</p> : <>
                {page === 'dashboard' && <OrganizationOverview
                    accessToken={accessToken}
                    username={user.username}
                    onNavigate={setPage}
                />}
                {page === 'profile' && <AccountSettings
                    accessToken={accessToken}
                    onAccountUpdated={onAccountUpdated}
                    onLogout={onLogout}
                />}
                {page === 'payments' && <Payments
                    accessToken={accessToken}
                    organization
                />}
                {page === 'students' && <StudentRecords
                    accessToken={accessToken}
                    scope={data.scope}
                />}
                {page === 'events' && <Events
                    {...data}
                    action={action}
                    saving={saving}
                    error={error}
                    now={now}
                    openScanner={id => {
                        setSelectedEvent(String(id))
                        setPage('attendance')
                        setError('')
                        setNotice('')
                    }}
                />}
                {page === 'attendance' && <><Scanner
                    events={data.events}
                    selectedEvent={selectedEvent}
                    selectEvent={setSelectedEvent}
                    accessToken={accessToken}
                    now={now}
                />
                    {!selectedEvent && <Records
                        kind="ATTENDANCE"
                        events={data.events}
                        accessToken={accessToken}
                    />}</>}
                {page === 'violations' && <><details
                    className="org-types"
                    open
                >
                    <summary>Create / manage your organization's violations</summary>
                    <ViolationTypes
                        types={data.types}
                        action={action}
                        saving={saving}
                    />
                </details>
                    <section className="org-panel">
                        <h2>Violation Scanner</h2>
                        <EventScanner
                            types={data.types}
                            accessToken={accessToken}
                            now={now}
                        />
                    </section></>}
            </>}
        </div>
    </PortalLayout>
}

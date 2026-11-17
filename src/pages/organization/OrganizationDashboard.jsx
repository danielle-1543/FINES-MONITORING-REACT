import RecordStatus from '../../components/RecordStatus'
import AcademicPeriodSelect from '../../components/AcademicPeriodSelect'
import FineArchives from '../../components/FineArchives'
import { apiRequest } from '../../utils/apiRequest'
import CalendarInput from '../../components/CalendarInput'
import { money } from '../../utils/format'
import OrganizationOverview from './OrganizationOverview'
import AccountSettings from '../../components/AccountSettings'
import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import '../../css/organization/Organization.css'
import { downloadExcel } from '../../utils/exportExcel'
import Payments from '../student/Payments'
import StudentRecord from './StudentRecord'
import PortalLayout from '../../components/PortalLayout'
import { startQrCamera } from '../../utils/qrCamera'
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
    accessToken,
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
        <AcademicPeriodSelect accessToken={accessToken} value={form.academic_period_id || ''} onChange={value => setForm(current => ({ ...current, academic_period_id: value }))} required openOnly defaultCurrent readOnly />
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
        <label>Scanning starts<CalendarInput
            type="datetime-local"
            required
            {...field('scan_starts_at')}
        /></label>
        <label>Scanning ends<CalendarInput
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
            <table className="system-table">
                <thead>
                    <tr>
                        <th>Violation</th>
                        <th className="table-number">Fine (PHP)</th>
                    </tr>
                </thead>
                <tbody>{types.map(item => {
                    return <tr key={item.id}>
                        <td>{item.name}</td>
                        <td className="table-number">{money(item.fine_amount)}</td>
                    </tr>
                })}</tbody>
            </table>
        </div>}
    </section>
}
function Events({
    accessToken,
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
            <EventForm accessToken={accessToken} types={types} saving={saving}
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
                <table className="system-table">
                    <thead>
                        <tr>
                            <th>Event</th>
                            <th>Type</th>
                            <th>Scan Window</th>
                            <th>Scanning</th>
                            <th className="table-actions">Actions</th>
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
                            <td><RecordStatus value={windowStatus(event, now)} /></td>
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
            <EventForm accessToken={accessToken}
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
    return <label className="org-field record-sort-field">Sort
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
        <table className="system-table">
            <thead>
                <tr>
                    <th>Course</th>
                    <th>Year Level</th>
                    <th>Section</th>
                    <th>Name</th>
                    <th>Student Number</th>
                    {includeEvent && <th>Event / Semester</th>}
                    {showAttendance && <th>Attendance Status</th>}
                    <th>Recorded Violations</th>
                    <th className="table-number">Fine (PHP)</th>
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
                    {includeEvent && <td>{record.event_name}<small className="payment-window">{record.academic_period_label}</small></td>}
                    {showAttendance && <td><RecordStatus value={record.attendance_status} /></td>}
                    <td>
                        {record.record_type === 'ATTENDANCE'
                            ? record.additional_violations || 'None'
                            : [record.violation_name, record.additional_violations].filter(Boolean).join(', ') || 'None'}
                    </td>
                    <td className="table-number">{money(record.total_fine ?? record.fine_amount)}</td>
                    <td>{pht(record.recorded_at)}</td>
                </tr>
            })}</tbody>
        </table>
    </div>
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
    const previewHandler = useRef(null)
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
    const camera = useRef(null)
    const cameraToken = useRef(0)
    const cameraMounted = useRef(false)
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
    const stopCamera = useCallback(async () => {
        cameraToken.current += 1
        const handle = camera.current
        camera.current = null
        if (!handle) {
            return
        }
        await handle.stop()
        if (cameraMounted.current) {
            setRunning(false)
            setCameraBusy(false)
            setFeedback('Camera stopped.')
        }
    }, [])
    const startCamera = useCallback(async () => {
        if (camera.current || cameraBusy) {
            return
        }
        const token = ++cameraToken.current
        setCameraBusy(true)
        setFeedback('Starting camera…')
        try {
            const handle = await startQrCamera({
                containerId: 'org-qr-reader',
                onScan: value => {
                    void previewHandler.current?.(value)
                }
            })
            if (token !== cameraToken.current || !cameraMounted.current) {
                await handle.stop()
                return
            }
            camera.current = handle
            setRunning(true)
            setFeedback('Camera started. Point it at a student QR code.')
        } catch (error) {
            if (token === cameraToken.current && cameraMounted.current) {
                setFeedback(error.message || String(error))
            }
        } finally {
            if (cameraMounted.current) {
                setCameraBusy(false)
            }
        }
    }, [cameraBusy])
    useEffect(() => {
        previewHandler.current = preview
    })
    useEffect(() => {
        cameraMounted.current = true
        return () => {
            cameraMounted.current = false
            void stopCamera()
        }
    }, [stopCamera])
    useEffect(() => {
        if (!accepting) {
            void stopCamera()
        }
    }, [accepting, stopCamera])
    return <>
        <section className={event ? 'attendance-scanner-controls' : 'org-panel violation-scanner-panel'}>
        {!event && <h2>Violation Scanner</h2>}
        {event ? <p>Scanning: <strong>{windowStatus(event, now)}</strong> · {pht(event.scan_starts_at)} to {pht(event.scan_ends_at)}</p> : <p>Scan a student and choose one or more violations. Available with or without an attendance event.</p>}
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
        </section>
        <section className={event ? 'attendance-records-panel' : 'org-panel violation-records-panel'}>
        <div className="org-record-heading">
            <h3>{event ? `Attendance Records — ${event.name}` : 'Violation Records'}</h3>
        </div>
        <p>Export includes all matching records in the selected order.</p>

        <div className="org-actions org-event-record-filters org-filter-toolbar" role="group" aria-label="Search and filter records">
            {['student_number', 'section', 'year_level'].map(field => <label className={`org-field ${field === 'student_number' ? 'org-filter-search' : ''}`} key={field}>
                {field === 'student_number' ? 'Student ID' : field === 'section' ? 'Section' : 'Year Level'}
                {field === 'year_level' ? <select value={recordFilters[field]} onChange={e => {
                    setRecordFilters(current => ({ ...current, [field]: e.target.value }))
                    setPage(1)
                    setLoading(true)
                }}>
                    <option value="">All year levels</option>
                    {['1st Year', '2nd Year', '3rd Year', '4th Year', 'Graduating'].map(year => <option key={year}>{year}</option>)}
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
        <RecordSorting filters={recordFilters} onChange={changes => {
            setRecordFilters(current => ({ ...current, ...changes }))
            setPage(1)
            setLoading(true)
        }} />
        </div>
            <div className="org-record-filter-actions org-record-page-actions" role="group" aria-label="Record actions">
            <button type="button" className="secondary" onClick={() => {
                setRecordFilters({ student_number: '', section: '', year_level: '', attendance_status: '' })
                setPage(1)
            }}>Clear Filters</button>
            <DownloadExcel path={`records/export?${recordQuery}`} accessToken={accessToken}
                filename={event ? 'attendance-records.xlsx' : 'violation-records.xlsx'} />
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
        </section>
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
                {confirmation.fines_locked ? <p>New fines are locked while your payment window is open. You can record attendance without adding a fine.</p> : !confirmation.violation_types.length && <p>No violation types yet. Create a violation type on the Violations page first.</p>}
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
    const [refreshVersion, setRefreshVersion] = useState(0)
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
    }, [query, page, accessToken, refreshVersion])
    return <section className="org-panel">
        <h2>{kind === 'ATTENDANCE' ? 'Attendance' : 'Violations'}</h2>
        <div className="org-record-filters org-filter-toolbar" role="group" aria-label="Search and filter records">
            <label className="org-field org-filter-event">Event<select value={eventId} onChange={event => {
                setEventId(event.target.value); setPage(1); setError(''); setLoading(true); setRecords([])
            }}>
                <option value="">All events</option>
                {events.filter(event => event.event_type === kind).map(event => <option key={event.id} value={event.id}>{event.name}</option>)}
            </select></label>
            {['search', 'section', 'year_level', 'attendance_status'].map(field => <label className={`org-field ${field === 'search' ? 'org-filter-search' : ''}`} key={field}>
                {{ search: 'Search student', section: 'Section', year_level: 'Year level', attendance_status: 'Attendance status' }[field]}
                {['search', 'section'].includes(field) ? <input value={filters[field]} placeholder={field === 'search' ? 'Student number or name' : 'e.g. F1'} maxLength={100}
                    onChange={event => { setFilters(current => ({ ...current, [field]: event.target.value })); setPage(1); setLoading(true); setError('') }} />
                    : <select value={filters[field]} onChange={event => { setFilters(current => ({ ...current, [field]: event.target.value })); setPage(1); setLoading(true); setError('') }}>
                        <option value="">{field === 'year_level' ? 'All year levels' : 'All statuses'}</option>
                        {(field === 'year_level' ? ['1st Year', '2nd Year', '3rd Year', '4th Year', 'Graduating'] : ['PRESENT', 'ABSENT']).map(value => <option key={value}>{value}</option>)}
                    </select>}
            </label>)}
            <RecordSorting filters={filters} onChange={changes => { setFilters(current => ({ ...current, ...changes })); setPage(1); setLoading(true); setError('') }} />
        </div>
            <div className="org-record-filter-actions org-record-page-actions" role="group" aria-label="Record actions">
                <button type="button" className="secondary" onClick={() => { setFilters({ search: '', section: '', year_level: '', attendance_status: '' }); setEventId(''); setPage(1); setLoading(true); setError(''); setRefreshVersion(value => value + 1) }}>Clear filters</button>
                <DownloadExcel path={`records/export?${query}`} accessToken={accessToken} filename={kind === 'ATTENDANCE' ? 'attendance-records.xlsx' : 'violation-records.xlsx'} />
            </div>
        {error && <p role="alert" className="org-feedback error">{error}</p>}
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
function StudentRecords({ accessToken, scope }) {
    const emptyFilters = {
        search: '', course: '', year_level: '', section: '',
        account_status: '', activation_status: '', sort: 'az'
    }
    const [filters, setFilters] = useState(emptyFilters)
    const [students, setStudents] = useState(null)
    const [page, setPage] = useState(1)
    const [perPage, setPerPage] = useState(50)
    const [selectedStudent, setSelectedStudent] = useState(null)
    const [error, setError] = useState('')
    const [exporting, setExporting] = useState(false)
    const [version, setVersion] = useState(0)

    useEffect(() => {
        const controller = new AbortController()
        async function loadStudents() {
            // The existing endpoint enforces organization scope on every page.
            const first = await api('students?page=1', accessToken, undefined, controller.signal)
            const rows = [...first.data]
            for (let next = 2; next <= first.pagination.total_pages; next++) {
                const response = await api(`students?page=${next}`, accessToken, undefined, controller.signal)
                rows.push(...response.data)
            }
            if (!controller.signal.aborted) {
                setError('')
                setStudents(Array.from(new Map(rows.map(student => [student.id, student])).values()))
                setPerPage(first.pagination.per_page || 50)
            }
        }
        loadStudents().catch(err => {
            if (err.name !== 'AbortError') setError(err.message)
        })
        return () => controller.abort()
    }, [accessToken, version])

    function matches(student) {
        const search = filters.search.trim().toLocaleLowerCase()
        return (!search || `${student.full_name} ${student.student_number}`.toLocaleLowerCase().includes(search))
            && ['course', 'year_level', 'account_status', 'activation_status'].every(field => !filters[field] || student[field] === filters[field])
            && (!filters.section.trim() || student.section?.toLocaleLowerCase() === filters.section.trim().toLocaleLowerCase())
    }
    function compare(left, right) {
        if (filters.sort === 'recent') {
            const dates = String(right.registered_at || '').localeCompare(String(left.registered_at || ''))
            if (dates) return dates
            return Number(right.id) - Number(left.id)
        }
        const names = left.full_name.localeCompare(right.full_name, undefined, { sensitivity: 'base' })
        return (filters.sort === 'za' ? -names : names)
            || left.student_number.localeCompare(right.student_number)
    }
    const matching = (students || []).filter(matches).sort(compare)
    const pages = Math.max(1, Math.ceil(matching.length / perPage))
    const currentPage = Math.min(page, pages)
    const visible = matching.slice((currentPage - 1) * perPage, currentPage * perPage)
    const courses = scope?.all_courses
        ? [...new Set((students || []).map(student => student.course))].filter(Boolean).sort()
        : scope?.courses || []
    const summary = [
        ['Total Students', students?.length],
        ['Active Accounts', students?.filter(student => student.account_status === 'ACTIVE').length],
        ['Inactive Accounts', students?.filter(student => student.account_status === 'INACTIVE').length],
        ['Pending Activations', students?.filter(student => student.activation_status === 'PENDING').length]
    ]
    function updateFilters(changes) {
        setFilters(current => ({ ...current, ...changes }))
        setPage(1)
    }
    async function exportStudents() {
        setExporting(true)
        setError('')
        try {
            const query = new URLSearchParams({
                course: filters.course, year_level: filters.year_level,
                section: filters.section.trim(), sort: filters.sort
            })
            const result = await api(`students/export?${query}`, accessToken)
            // Apply UI-only status filters to fresh export rows, not just the visible page.
            const rows = result.data.filter(matches).sort(compare)
            const totals = { full_name: 'GRAND TOTAL' }
            for (const field of ['violation_fines', 'absence_fines', 'fine_amount', 'outstanding']) {
                totals[field] = rows.reduce((sum, row) => sum + Math.round(Number(row[field] || 0) * 100), 0) / 100
            }
            downloadExcel({ ...result, data: rows, totals }, 'student-records.xlsx')
        } catch (err) {
            setError(err.message)
        } finally {
            setExporting(false)
        }
    }
    return <section className="org-panel org-student-directory">
        <header className="org-record-heading">
            <div>
                <h2>Student Records</h2>
                <p className="org-directory-scope">{scope?.all_courses ? 'All university courses' : courses.join(' · ')}</p>
            </div>
        </header>
        <div className="org-directory-summary" aria-label="Organization student totals">
            {summary.map(([label, value]) => <div key={label}>
                <span>{label}</span>
                <strong>{value === undefined ? '—' : value.toLocaleString()}</strong>
            </div>)}
        </div>
        <div className="org-filter-toolbar" aria-label="Student search and filters">
            <label className="org-field org-search-field">Search students
                <input value={filters.search} placeholder="Name or student number" maxLength={100}
                    onChange={event => updateFilters({ search: event.target.value })} />
            </label>
            <label className="org-field">Course
                <select value={filters.course} onChange={event => updateFilters({ course: event.target.value })}>
                    <option value="">All assigned courses</option>
                    {courses.map(course => <option key={course}>{course}</option>)}
                </select>
            </label>
            <label className="org-field">Year level
                <select value={filters.year_level} onChange={event => updateFilters({ year_level: event.target.value })}>
                    <option value="">All years</option>
                    {['1st Year', '2nd Year', '3rd Year', '4th Year', 'Graduating'].map(year => <option key={year}>{year}</option>)}
                </select>
            </label>
            <label className="org-field">Section
                <input value={filters.section} placeholder="e.g. F1" maxLength={100}
                    onChange={event => updateFilters({ section: event.target.value })} />
            </label>
            <label className="org-field">Account status
                <select value={filters.account_status} onChange={event => updateFilters({ account_status: event.target.value })}>
                    <option value="">All accounts</option>
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                </select>
            </label>
            <label className="org-field">Activation status
                <select value={filters.activation_status} onChange={event => updateFilters({ activation_status: event.target.value })}>
                    <option value="">All activations</option>
                    <option value="ACTIVATED">Activated</option>
                    <option value="PENDING">Pending</option>
                </select>
            </label>
            <RecordSorting filters={filters} onChange={updateFilters} />
            <div className="org-filter-buttons">
                <button type="button" className="secondary" onClick={() => updateFilters(emptyFilters)}>Clear</button>
                <button type="button" disabled={exporting || !students} onClick={exportStudents}>{exporting ? 'Exporting…' : 'Export Excel'}</button>
                <button type="button" className="secondary" disabled={!students && !error} onClick={() => {
                    setStudents(null)
                    setError('')
                    setVersion(value => value + 1)
                }}>Refresh</button>
            </div>
        </div>
        {error && <p role="alert" className="org-feedback error">{error}</p>}
        {!students ? <p role="status">{error ? 'Student records could not be loaded.' : 'Loading student records…'}</p> : <>
            <div className="org-table org-directory-table" role="region" aria-label="Student records" tabIndex={0}>
                <table className="system-table">
                    <thead><tr>
                        <th scope="col">Student</th>
                        <th scope="col">Year / Section</th>
                        <th scope="col">Account Status</th>
                        <th scope="col">Activation Status</th>
                        <th scope="col">Actions</th>
                    </tr></thead>
                    <tbody>{visible.length ? visible.map(student => <tr key={student.id}>
                        <td><strong>{student.full_name}</strong><small>{student.student_number} · {student.course}</small></td>
                        <td>{student.year_level} · {student.section}</td>
                        <td><span className={`org-status-badge ${student.account_status === 'ACTIVE' ? 'is-active' : 'is-inactive'}`}>
                            {student.account_status === 'ACTIVE' ? 'Active' : 'Inactive'}
                        </span></td>
                        <td><span className={`org-status-badge ${student.activation_status === 'ACTIVATED' ? 'is-active' : 'is-pending'}`}>
                            {student.activation_status === 'ACTIVATED' ? 'Activated' : 'Pending'}
                        </span></td>
                        <td><button type="button" onClick={() => setSelectedStudent(student.id)}>View Record</button></td>
                    </tr>) : <tr><td colSpan={5} className="org-empty-state">
                        <strong>No students match these filters.</strong><small>Try a different name, student number, or clear the filters.</small>
                    </td></tr>}</tbody>
                </table>
            </div>
            <Pagination pagination={{ current_page: currentPage, total_pages: pages, total_records: matching.length }} onPage={setPage} />
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
    const [loadError, setLoadError] = useState('')
    const load = useCallback(async signal => {
        const result = await api('events', accessToken, undefined, signal)
        if (signal?.aborted) return
        setData(result.data)
        setLoadError('')
        setSelectedEvent(previous => result.data.events.some(event => String(event.id) === previous) ? previous : '')
    }, [accessToken])
    useEffect(() => {
        const controller = new AbortController()
        const refresh = () => {
            load(controller.signal).catch(error => {
                if (error.name !== 'AbortError') setLoadError(error.message)
            })
        }
        const timer = setInterval(refresh, 15000)
        window.addEventListener('focus', refresh)
        return () => {
            controller.abort()
            clearInterval(timer)
            window.removeEventListener('focus', refresh)
        }
    }, [load])
    useEffect(() => {
        const controller = new AbortController()
        api('events', accessToken, undefined, controller.signal).then(result => {
            if (controller.signal.aborted) return
            setData(result.data)
            setLoadError('')
        }).catch(err => {
            if (err.name !== 'AbortError') {
                setLoadError(err.message)
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
    const nav = [['dashboard', 'Dashboard'], ['students', 'Student Records'], ['events', 'Events'], ['attendance', 'Attendance'], ['violations', 'Violations'], ['payments', 'Payments'], ['archives', 'Fine Archives'], ['profile', 'Account Settings']]
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
            {loadError && <p role="alert" className="org-feedback error">{loadError}</p>}
            {error && <p
                role="alert"
                className="org-feedback error"
            >{error}</p>}
            {notice && <p
                role="status"
                className="org-feedback success"
            >{notice}</p>}
            {!loading && <p className="student-note">{loadError
                ? 'Academic semester could not be loaded. Retrying automatically.'
                : data.academic_period
                    ? `${data.academic_period.label} · Current semester`
                    : 'No current academic semester configured'}</p>}
            {loading ? <p>Loading organization records…</p> : <Fragment key={data.academic_period?.id || 'none'}>
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
                {page === 'archives' && <FineArchives accessToken={accessToken} role="ORGANIZATION" />}
                {page === 'students' && <StudentRecords
                    accessToken={accessToken}
                    scope={data.scope}
                />}
                {page === 'events' && <Events accessToken={accessToken}
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
                        <EventScanner
                            types={data.types}
                            accessToken={accessToken}
                            now={now}
                        />
                    </>}
            </Fragment>}
        </div>
    </PortalLayout>
}

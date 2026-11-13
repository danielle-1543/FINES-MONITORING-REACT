import AcademicPeriodSelect from '../../components/AcademicPeriodSelect'
import SemesterEnrollment from '../../components/SemesterEnrollment'
import { apiFetch } from '../../utils/apiFetch'
import { confirmSensitive } from '../../utils/confirmation'
import { useCallback, useEffect, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import QRCode from 'qrcode'
import { jsPDF } from 'jspdf'
import '../../css/admin/StudentManagement.css'
const API = '/api/admin/students'
const years = ['1st Year', '2nd Year', '3rd Year', '4th Year']
const updateReasons = {
    PROMOTION: 'Year-level update / Promotion',
    RETAINED: 'Retained year level',
    SECTION_CHANGE: 'Change section',
    SHIFT_COURSE: 'Shift course',
    TRANSFERRED_OUT: 'Transferred out',
    DROPPED_OUT: 'Dropped out',
    OTHER_CORRECTION: 'Other correction',
    DEACTIVATE: 'Deactivate account',
    REACTIVATE: 'Reactivate account'
}
const updateFields = {
    PROMOTION: ['year_level', 'section'], RETAINED: ['year_level', 'section'],
    SECTION_CHANGE: ['section'], SHIFT_COURSE: ['course', 'year_level', 'section'],
    OTHER_CORRECTION: ['student_number', 'full_name', 'year_level', 'section']
}
const fieldLabels = {
    student_number: 'Student number', full_name: 'Full name', course: 'Course',
    year_level: 'Year level', section: 'Section', account_status: 'Account access',
}
function changesLabel(before, after) {
    return Object.keys(fieldLabels).filter(key => before[key] !== after[key]).map(key => {
        const display = value => value || '—'
        return `${fieldLabels[key]}: ${display(before[key])} → ${display(after[key])}`
    }).join('; ') || 'Academic details unchanged; reason recorded.'
}
const blank = {
    student_number: '',
    full_name: '',
    section: '',
    course: '',
    year_level: ''
}
function Modal({
    title,
    onClose,
    children,
    className = ''
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
        className={`sm-modal ${className}`}
        aria-label={title}
        onCancel={event => {
            event.preventDefault()
            onClose()
        }}
        onClick={event => {
            if (event.target === event.currentTarget) {
                onClose()
            }
        }}
    >
        <button
            type="button"
            className="close"
            aria-label="Close dialog"
            onClick={onClose}
        >×</button>
        <h2>{title}</h2>
        {children}
    </dialog>
}
function datePHT(value, detailed = false) {
    if (!value) {
        return '—'
    }
    const date = new Date(String(value).replace(' ', 'T') + (/[Z+]|-\d\d:\d\d$/.test(String(value)) ? '' : '+08:00'))
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('en-PH', {
        timeZone: 'Asia/Manila',
        ...(detailed ? {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        } : {})
    })
}
async function req(url, token, method = 'GET', body = null) {
    await confirmSensitive(url, body)
    const response = await apiFetch(url, {
        method,
        headers: {
            Accept: 'application/json',
            ...(token ? {
                Authorization: `Bearer ${token}`
            } : {}),
            ...(body ? {
                'Content-Type': 'application/json'
            } : {})
        },
        ...(body ? {
            body: JSON.stringify(body)
        } : {}),
        cache: 'no-store'
    })
    const data = await response.json().catch(() => {
        throw new Error(`The student API returned an invalid response (${response.status}). Check that the API server is running.`)
    })
    if (!response.ok || data.success === false) {
        throw new Error(data.message || data.error || `Request failed (${response.status})`)
    }
    return data
}
function Badge({
    value
}) {
    const status = value || 'UNKNOWN'
    const color = ['ACTIVE', 'ACTIVATED'].includes(status) ? 'active' : ['INACTIVE', 'REVOKED'].includes(status) ? 'inactive' : 'pending'
    return <span className={`sm-badge ${color}`}>
        {status}
    </span>
}
export default function StudentManagement({
    accessToken
}) {
    const [rows, setRows] = useState([])
    const [summary, setSummary] = useState({})
    const [opts, setOpts] = useState({
        courses: [],
        year_levels: [],
        sections: []
    })
    const [filters, setFilters] = useState({
        search: '',
        account_status: '',
        activation_status: '',
        qr_status: '',
        course: '',
        year_level: '',
        section: '',
        sort: 'recent',
        page: 1,
        per_page: 10
    })
    const courses = opts.courses
    const [pagination, setPagination] = useState({
        current_page: 1,
        total_pages: 1,
        total_records: 0,
        per_page: 10
    })
    const [registrationPeriod, setRegistrationPeriod] = useState('')
    const [importPeriod, setImportPeriod] = useState('')
    const [form, setForm] = useState(blank)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [notice, setNotice] = useState('')
    const [secret, setSecret] = useState(null)
    const [profile, setProfile] = useState(null)
    const [multipleEdits, setMultipleEdits] = useState(false)
    const profileVersion = useRef(0)
    const [formOpen, setFormOpen] = useState(false)
    const [importOpen, setImportOpen] = useState(false)
    const [deleteStudent, setDeleteStudent] = useState(null)
    const [exporting, setExporting] = useState(false)
    const [selectedIds, setSelectedIds] = useState([])
    const [allMatching, setAllMatching] = useState(false)
    const [selectingMatching, setSelectingMatching] = useState(false)
    const selectionVersion = useRef(0)
    const hasMatchingFilter = ['search', 'section', 'year_level', 'course', 'activation_status', 'account_status', 'academic_period_id'].some(key => String(filters[key] || '').trim() !== '')
    const [updateTarget, setUpdateTarget] = useState(null)
    const [updateReason, setUpdateReason] = useState('')
    const [updateChanges, setUpdateChanges] = useState({})
    const [updateNote, setUpdateNote] = useState('')
    const [updateReview, setUpdateReview] = useState(null)
    const [updateBusy, setUpdateBusy] = useState(false)
    const [updateError, setUpdateError] = useState('')
    const [history, setHistory] = useState(null)
    const requestVersion = useRef(0)
    const load = useCallback(async () => {
        const version = ++requestVersion.current
        setLoading(true)
        setError('')
        try {
            const query = new URLSearchParams()
            Object.entries(filters).forEach(([key, value]) => {
                if (value !== '' && value !== null && value !== undefined) {
                    query.set(key, String(value))
                }
            })
            const data = await req(`${API}?${query.toString()}`, accessToken)
            if (version !== requestVersion.current) {
                return
            }
            setRows(data.data || [])
            setPagination(data.pagination || {})
        } catch (err) {
            if (version !== requestVersion.current) {
                return
            }
            setError(err.message)
            setRows([])
        } finally {
            if (version === requestVersion.current) {
                setLoading(false)
            }
        }
    }, [accessToken, filters])
    const meta = useCallback(async () => {
        try {
            const [summaryResponse, filterResponse] = await Promise.all([req(`${API}/summary`, accessToken), req(`${API}/filter-options`, accessToken)])
            setSummary(summaryResponse.data || {})
            setOpts(filterResponse.data || {
                courses: [],
                year_levels: [],
                sections: []
            })
        } catch (err) {
            setError(err.message)
        }
    }, [accessToken])
    useEffect(() => {
        let active = true
        const version = ++requestVersion.current
        const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => {
            return value !== '' && value !== null && value !== undefined
        }))
        req(`${API}?${query}`, accessToken).then(data => {
            if (!active || version !== requestVersion.current) {
                return
            }
            setRows(data.data || [])
            setPagination(data.pagination || {})
            setError('')
        }).catch(err => {
            if (active && version === requestVersion.current) {
                setError(err.message)
                setRows([])
            }
        }).finally(() => {
            if (active && version === requestVersion.current) {
                setLoading(false)
            }
        })
        return () => {
            active = false
        }
    }, [accessToken, filters])
    useEffect(() => {
        let active = true
        Promise.all([req(`${API}/summary`, accessToken), req(`${API}/filter-options`, accessToken)]).then(([summaryResponse, filterResponse]) => {
            if (!active) {
                return
            }
            setSummary(summaryResponse.data || {})
            setOpts(filterResponse.data || {
                courses: [],
                year_levels: [],
                sections: []
            })
        }).catch(err => {
            if (active) {
                setError(err.message)
            }
        })
        return () => {
            active = false
        }
    }, [accessToken])
    function clearStudentSelection() {
        ++selectionVersion.current
        setSelectingMatching(false)
        setSelectedIds([])
        setAllMatching(false)
    }
    async function selectMatchingStudents() {
        if (!hasMatchingFilter) return
        const version = ++selectionVersion.current
        setSelectingMatching(true)
        setError('')
        try {
            const query = new URLSearchParams(filters)
            const result = await req(`${API}/matching?${query}`, accessToken)
            if (version !== selectionVersion.current) return
            setSelectedIds(result.data.student_ids)
            setAllMatching(true)
        } catch (err) {
            if (version === selectionVersion.current) {
                setSelectedIds([])
                setAllMatching(false)
                setError(err.message)
            }
        } finally {
            if (version === selectionVersion.current) setSelectingMatching(false)
        }
    }
    function filter(key, value) {
        clearStudentSelection()
        setLoading(true)
        setFilters(current => {
            return {
                ...current,
                [key]: value,
                page: 1
            }
        })
    }
    function openUpdate(student = null, reason = '') {
        const ids = student ? [Number(student.id)] : selectedIds
        setUpdateTarget(student ? { student_ids: ids, count: 1, label: student.full_name, existing: student, departure: student.departure_reason, account: student.account_status } : {
            student_ids: ids, all_matching: false, filters: { ...filters },
            count: ids.length,
            label: allMatching ? 'All students matching the current filters' : 'Selected students'
        })
        setUpdateReason(reason)
        setUpdateChanges({})
        setUpdateNote('')
        setUpdateReview(null)
        setUpdateError('')
    }
    async function reviewUpdate() {
        setUpdateBusy(true)
        setUpdateError('')
        try {
            const payload = { ...updateTarget, reason: updateReason, changes: updateChanges, note: updateNote, preview: true }
            const result = await req(`${API}/update`, accessToken, 'POST', payload)
            setUpdateReview({ ...result.data, payload })
        } catch (err) {
            setUpdateError(err.message)
        } finally {
            setUpdateBusy(false)
        }
    }
    async function confirmUpdate() {
        setUpdateBusy(true)
        setUpdateError('')
        try {
            const result = await req(`${API}/update`, accessToken, 'POST', {
                ...updateReview.payload, all_matching: false, preview: false,
                student_ids: updateReview.students.map(student => student.id), fingerprint: updateReview.fingerprint
            })
            setUpdateTarget(null)
            setSelectedIds([])
            setAllMatching(false)
            setNotice(result.message)
            await Promise.all([load(), meta()])
            if (profile) await openProfile(profile.student)
        } catch (err) {
            setUpdateError(err.message)
            setUpdateReview(null)
        } finally {
            setUpdateBusy(false)
        }
    }
    async function showHistory(student) {
        setHistory({ id: student.id, name: student.full_name, rows: [], loading: true, error: '' })
        try {
            const result = await req(`${API}/change-history?id=${student.id}`, accessToken)
            setHistory(current => current?.id === student.id ? { ...current, rows: result.data, loading: false } : current)
        } catch (err) {
            setHistory(current => current?.id === student.id ? { ...current, loading: false, error: err.message } : current)
        }
    }
    async function action(path, body) {
        setError('')
        setNotice('')
        try {
            const data = await req(`${API}/${path}`, accessToken, 'POST', body)
            setNotice(data.message || 'Completed.')
            if (data.data?.activation_code) {
                setSecret(data.data)
            }
            await Promise.all([load(), meta()])
            return data
        } catch (err) {
            setError(err.message)
            return null
        }
    }
    async function save(event) {
        event.preventDefault()
        const data = await action('create', { ...form, academic_period_id: registrationPeriod })
        if (data) {
            setForm(blank)
            setFormOpen(false)
        }
    }
    async function importFile(event) {
        const file = event.target.files?.[0]
        event.target.value = ''
        if (!file) {
            return
        }
        try {
            if (!importPeriod) throw new Error('Choose the academic year and semester before importing.')
            if (!/\.xlsx$/i.test(file.name) || file.size > 5242880) {
                throw new Error('Choose an .xlsx file up to 5 MB.')
            }
            const workbook = XLSX.read(await file.arrayBuffer(), {
                type: 'array'
            })
            const sheet = workbook.Sheets[workbook.SheetNames[0]]
            if (!sheet) {
                throw new Error('The workbook has no worksheets.')
            }
            const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1')
            if (range.e.c >= 30 || range.e.r > 500) {
                throw new Error('Maximum 500 student rows plus a header, and 30 columns per workbook.')
            }
            Object.values(sheet).forEach(cell => {
                if (cell && typeof cell === 'object' && cell.f) {
                    cell.v = ''
                    delete cell.w
                }
            })
            const header = (XLSX.utils.sheet_to_json(sheet, {
                header: 1,
                defval: '',
                range: 0
            })[0] || []).map(value => {
                return String(value).trim().toLowerCase()
            })
            if (new Set(header).size !== header.length || Object.keys(blank).some(key => {
                return !header.includes(key)
            })) {
                throw new Error('Excel row 1 must contain unique headers: student_number, full_name, section, course, year_level.')
            }
            const source = XLSX.utils.sheet_to_json(sheet, {
                defval: '',
                raw: false
            })
            if (source.length > 500) {
                throw new Error('Maximum 500 rows per import.')
            }
            const dataRows = source.map(row => {
                const normalized = {}
                Object.entries(row).forEach(([key, value]) => {
                    normalized[key.trim().toLowerCase()] = String(value ?? '').trim()
                })
                return {
                    student_number: normalized.student_number || '',
                    full_name: normalized.full_name || '',
                    section: normalized.section || '',
                    course: normalized.course || '',
                    year_level: normalized.year_level || ''
                }
            })
            const result = await action('bulk-import', {
                rows: dataRows, academic_period_id: importPeriod
            })
            if (result?.data) {
                setImportOpen(false)
                setNotice(`Import complete: ${result.data.created} created, ` + `${result.data.enrolled || 0} existing students enrolled, ${result.data.skipped} skipped. ` + `${(result.data.errors || []).join(' ')}`)
            }
        } catch (err) {
            setError(err.message)
        }
    }
    async function openProfile(student) {
        const version = ++profileVersion.current
        setProfile({ student, loading: true, image: '', code: null, error: '', qrError: '', codeError: '', copyMessage: '' })
        try {
            const details = await req(`${API}/profile?id=${student.id}`, accessToken)
            const current = details.data
            const [qrResult, codeResult] = await Promise.allSettled([
                current.qr_token_status === 'ACTIVE' ? req(`${API}/qr-details`, accessToken, 'POST', { id: student.id })
                    .then(result => QRCode.toDataURL(result.data.qr_token, { width: 300, margin: 2 })) : Promise.resolve(''),
                current.activation_status === 'PENDING' ? req(`${API}/reveal-code`, accessToken, 'POST', { id: student.id }).then(result => result.data) : Promise.resolve(null)
            ])
            if (version !== profileVersion.current) return
            setProfile({ student: current, loading: false, error: '', copyMessage: '',
                image: qrResult.status === 'fulfilled' ? qrResult.value : '',
                qrError: qrResult.status === 'rejected' ? qrResult.reason.message : '',
                code: codeResult.status === 'fulfilled' ? codeResult.value : null,
                codeError: codeResult.status === 'rejected' ? codeResult.reason.message : '' })
        } catch (err) {
            if (version === profileVersion.current) setProfile(current => current && { ...current, loading: false, error: err.message })
        }
    }
    function closeProfile() {
        ++profileVersion.current
        setProfile(null)
    }
    async function copyProfileCode() {
        try {
            if (!navigator.clipboard?.writeText) throw new Error('Copy is unavailable. Select the displayed code and copy it manually.')
            await navigator.clipboard.writeText(profile.code.activation_code)
            setProfile(current => current && { ...current, copyMessage: 'Activation code copied.' })
        } catch (err) {
            setProfile(current => current && { ...current, copyMessage: err.message || 'Unable to copy the activation code.' })
        }
    }
    async function resetProfileCode() {
        const student = profile.student
        const version = profileVersion.current
        setProfile(current => ({ ...current, loading: true, error: '' }))
        try {
            await req(`${API}/reset-code`, accessToken, 'POST', { id: student.id })
            if (version !== profileVersion.current) return
            await openProfile(student)
            await load()
        } catch (err) {
            setProfile(current => current && { ...current, loading: false, error: err.message })
        }
    }
    async function exportPDF() {
        setExporting(true)
        setError('')
        try {
            const result = await req(`${API}/export-qr-batch`, accessToken, 'POST', filters)
            const pdf = new jsPDF({
                unit: 'mm',
                format: [215.9, 330.2]
            })
            const cellW = 195.9 / 4
            const cellH = (330.2 - 21 - 8) / 5
            for (let index = 0; index < result.data.length; index++) {
                const student = result.data[index]
                if (index % 20 === 0) {
                    if (index) {
                        pdf.addPage()
                    }
                    pdf.setFont('helvetica', 'bold')
                    pdf.setFontSize(11)
                    pdf.text('STUDENT QR + ACTIVATION CODES', 10, 12)
                    pdf.setFont('helvetica', 'normal')
                    pdf.setFontSize(7)
                    pdf.text('PRIVATE - Distribute to the matching student. Print at 100% on 8.5 x 13 inch paper.', 10, 18)
                }
                const slot = index % 20
                const x = 10 + slot % 4 * cellW
                const y = 21 + Math.floor(slot / 4) * cellH
                const image = await QRCode.toDataURL(student.qr_token, {
                    width: 300,
                    margin: 2
                })
                pdf.setDrawColor(204, 213, 225)
                pdf.rect(x, y, cellW, cellH)
                pdf.addImage(image, 'PNG', x + (cellW - 31) / 2, y + 2, 31, 31)
                pdf.setFont('helvetica', 'bold')
                pdf.setFontSize(8)
                pdf.text(student.student_number, x + cellW / 2, y + 38, {
                    align: 'center'
                })
                pdf.setFont('helvetica', 'normal')
                pdf.setFontSize(7)
                let name = student.full_name
                while (pdf.getTextWidth(name) > cellW - 4) {
                    name = name.slice(0, -1)
                }
                pdf.text(name, x + cellW / 2, y + 43, {
                    align: 'center'
                })
                pdf.text('ACTIVATION CODE', x + cellW / 2, y + 48, {
                    align: 'center'
                })
                pdf.setFont('courier', 'bold')
                pdf.setFontSize(12)
                pdf.text(student.activation_code, x + cellW / 2, y + 54, {
                    align: 'center'
                })
            }
            pdf.save('Student-QR-Activation-Codes.pdf')
        } catch (err) {
            setError(err.message)
        } finally {
            setExporting(false)
        }
    }
    return <main className="student-management">
        <header className="sm-head">
            <div>
                <small>ADMINISTRATION</small>
                <h1>Student Management</h1>
                <p>
                    Register and manage student accounts, activation
                    codes, and QR tokens.
                </p>
            </div>

            <div className="sm-actions">
                <button
                    className="sm-btn dark"
                    onClick={() => {
                        setForm(blank)
                        setFormOpen(true)
                    }}
                >Individual Registration</button>
                <button
                    className="sm-btn"
                    onClick={() => {
                        return setImportOpen(true)
                    }}
                >Bulk Import (Excel)</button>
            </div>
        </header>

        {error && <div className="sm-alert error">
            {error}
        </div>}

        {notice && <div className="sm-alert success">
            {notice}
        </div>}

        <section className="sm-summary">
            {[['Total Students', 'total_students'], ['Active Accounts', 'active_students'], ['Inactive Accounts', 'inactive_students'], ['Pending Activation', 'pending_students'], ['Activated Accounts', 'activated_students']].map(([label, key]) => {
                return <article key={key}>
                    <span>{label}</span>
                    <b>
                        {Number(summary[key] || 0).toLocaleString()}
                    </b>
                </article>
            })}
        </section>

        {profile && !updateTarget && !history && !deleteStudent && <Modal title="Student Profile" className="sm-profile-modal" onClose={closeProfile}>
            <p className="sm-profile-subtitle">Student account information and management</p>
            <div className="sm-profile-heading">
                <div className="sm-profile-avatar" aria-hidden="true">
                    {profile.student.full_name?.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('') || 'S'}
                </div>
                <div className="sm-profile-identity">
                    <h3>{profile.student.full_name}</h3>
                    <p>{[profile.student.student_number, profile.student.course, profile.student.year_level, profile.student.section].filter(Boolean).join(' · ')}</p>
                    <p>Username: <strong>{profile.student.username || 'Not set up yet'}</strong></p>
                    <div className="sm-profile-badges">
                        <span className={`sm-profile-badge ${profile.student.account_status === 'ACTIVE' ? 'positive' : 'negative'}`}>
                            {profile.student.account_status === 'ACTIVE' ? 'Active account' : 'Inactive account'}
                        </span>
                        <span className={`sm-profile-badge ${profile.student.activation_status === 'ACTIVATED' ? 'positive' : 'pending'}`}>
                            {profile.student.activation_status === 'ACTIVATED' ? 'Activated' : 'Pending activation'}
                        </span>
                    </div>
                </div>
            </div>
            {profile.error && <p role="alert" className="sm-alert error">{profile.error}</p>}
            {profile.loading && <p role="status">Loading student details, QR, and activation information…</p>}
            <SemesterEnrollment key={profile.student.id} student={profile.student} accessToken={accessToken} courses={courses} onSaved={async () => { await openProfile(profile.student); await load() }} />
            <div className="sm-profile-layout">
                <section className="sm-profile-credentials" aria-label="Student QR and activation">
                    <h3>QR Code Management</h3>
                    <span className={`sm-profile-badge ${profile.student.qr_token_status === 'ACTIVE' ? 'positive' : 'negative'}`}>
                        QR {profile.student.qr_token_status || 'unavailable'}
                    </span>
                    <figure className="sm-profile-qr-preview">
                        {profile.image ? <>
                            <img src={profile.image} width="240" height="240" alt={`QR for ${profile.student.full_name}`} />
                            <figcaption>Current QR Code</figcaption>
                        </> : <p>{profile.loading ? 'Loading QR code…' : profile.qrError || 'No active QR is available.'}</p>}
                    </figure>
                    {profile.image && <a className="sm-btn" href={profile.image} download={`QR-${profile.student.student_number}.png`}>Download QR</a>}
                    <div className="sm-actions">
                        {['REVOKE', 'REGENERATE'].map(action => <button type="button" className="sm-btn" key={action}
                            disabled={profile.loading || (action === 'REVOKE' && profile.student.qr_token_status !== 'ACTIVE')}
                            onClick={async () => {
                                setProfile(current => ({ ...current, loading: true }))
                                try {
                                    await req(`${API}/qr-status`, accessToken, 'POST', { id: profile.student.id, full_name: profile.student.full_name, action })
                                    await openProfile(profile.student)
                                    await load()
                                } catch (error) {
                                    setNotice(error.message)
                                    setProfile(current => ({ ...current, loading: false }))
                                }
                            }}>{action === 'REVOKE' ? 'Revoke QR Code' : 'Generate New QR Code'}</button>)}
                    </div>
                    <dl className="sm-profile-qr-dates">
                        <div><dt>First generated</dt><dd>{datePHT(profile.student.qr_first_generated_at || profile.student.qr_token_generated_at, true)}</dd></div>
                        <div><dt>Last regenerated</dt><dd>{datePHT(profile.student.qr_last_regenerated_at, true)}</dd></div>
                        <div><dt>Current QR generated</dt><dd>{datePHT(profile.student.qr_token_generated_at, true)}</dd></div>
                    </dl>
                    {profile.student.activation_status === 'PENDING' ? <>
                        <h3>Activation code</h3>
                        {profile.code ? <>
                            <div className="sm-profile-code"><code>{profile.code.activation_code}</code>
                                <button type="button" className="sm-btn" onClick={copyProfileCode}>Copy code</button></div>
                            <p>Expires: {datePHT(profile.code.activation_code_expires_at, true)}</p>
                        </> : !profile.loading && <p>{profile.codeError || 'No readable activation code is available.'}</p>}
                        <button type="button" className="sm-btn" disabled={profile.loading || Boolean(profile.student.user_id)} onClick={resetProfileCode}>Generate replacement code</button>
                    </> : <p>This account is already activated. No activation code is displayed.</p>}
                    {profile.copyMessage && <p role="status">{profile.copyMessage}</p>}
                </section>
                <div className="sm-profile-information">
                    {[
                        ['Student Information', [
                            ['Full name', profile.student.full_name], ['Student number', profile.student.student_number],
                            ['Course', profile.student.course], ['Year level', profile.student.year_level], ['Section', profile.student.section]
                        ]],
                        ['Account Information', [
                            ['Activation status', profile.student.activation_status === 'ACTIVATED' ? 'Activated' : 'Pending activation'],
                            ['Account access', profile.student.account_status === 'ACTIVE' ? 'Active' : 'Deactivated'],
                            ['Username', profile.student.username || (profile.student.user_id ? 'Not provided' : 'Not set up yet')],
                            ['Email', profile.student.email || (profile.student.user_id ? 'Not provided' : 'Not set up yet')]
                        ]],
                        ['Important dates', [
                            ['Registered', datePHT(profile.student.registered_at, true)],
                            ['Activated', profile.student.activated_at ? datePHT(profile.student.activated_at, true) : 'Not activated yet'],
                            ['Last updated', datePHT(profile.student.updated_at, true)]
                        ]]
                    ].map(([heading, fields]) => <section className="sm-profile-section" key={heading}>
                        <h3>{heading}</h3>
                        <dl className="sm-profile-details">
                            {fields.map(([label, value]) => <div key={label}>
                                <dt>{label}</dt>
                                <dd>{['Activation status', 'Account access'].includes(label)
                                    ? <span className={`sm-profile-badge ${['Activated', 'Active'].includes(value) ? 'positive' : value === 'Pending activation' ? 'pending' : 'negative'}`}>{value}</span>
                                    : value || 'Not provided'}</dd>
                            </div>)}
                        </dl>
                    </section>)}
                </div>
            </div>
            <div className="sm-actions sm-profile-footer">
                <button type="button" className="sm-btn" disabled={profile.loading} onClick={() => showHistory(profile.student)}>Edit history</button>
                {profile.student.account_status === 'ACTIVE' ? <button type="button" className="sm-btn"
                    disabled={profile.loading || !['TRANSFERRED_OUT', 'DROPPED_OUT'].includes(profile.student.departure_reason)}
                    onClick={() => openUpdate(profile.student, 'DEACTIVATE')}>Deactivate account</button>
                    : <button type="button" className="sm-btn" disabled={profile.loading} onClick={() => openUpdate(profile.student, 'REACTIVATE')}>Reactivate account</button>}
                {profile.student.activation_status === 'PENDING' && !profile.student.user_id && <button type="button" className="sm-btn" disabled={profile.loading}
                    onClick={() => setDeleteStudent(profile.student)}>Delete unused registration</button>}
                <button type="button" className="sm-btn" onClick={closeProfile}>Close</button>
                <button type="button" className="sm-btn dark" disabled={profile.loading || Boolean(profile.error)} onClick={() => openUpdate(profile.student)}>Edit Profile</button>
            </div>
        </Modal>}
        {updateTarget && <Modal title={updateReview ? 'Review student updates' : 'Update students'} onClose={() => {
            if (!updateBusy) setUpdateTarget(null)
        }}>
            <p><strong>{updateReview?.count ?? updateTarget.count} student(s)</strong> · {updateTarget.label}</p>
            <p>Updates apply when confirmed. Existing accounts, QR tokens, activation, fines, and payments are preserved.</p>
            {updateError && <p className="sm-alert error" role="alert">{updateError}</p>}
            {!updateReview ? <form className="sm-update-form" onSubmit={event => {
                event.preventDefault()
                void reviewUpdate()
            }}>
                <label>Reason for update<select required value={updateReason} disabled={updateBusy} onChange={event => {
                    setUpdateReason(event.target.value)
                    setUpdateChanges({})
                }}>
                    <option value="">Choose a reason</option>
                    {Object.entries(updateReasons).map(([key, label]) => <option key={key} value={key}
                        disabled={key === 'DEACTIVATE' && updateTarget.count === 1 && updateTarget.departure !== undefined
                            && !['TRANSFERRED_OUT', 'DROPPED_OUT'].includes(updateTarget.departure)}>{label}</option>)}
                </select></label>
                {(updateFields[updateReason] || []).filter(field => updateTarget.count === 1 || !['student_number', 'full_name'].includes(field)).map(field => <label key={field}>
                    {fieldLabels[field]}
                    {field === 'course' || field === 'year_level' ? <select
                        value={updateChanges[field] ?? updateTarget.existing?.[field] ?? ''} required={field === 'course'} disabled={updateBusy}
                        onChange={event => setUpdateChanges(current => ({ ...current, [field]: event.target.value }))}>
                        <option value="">{field === 'course' ? 'Choose destination course' : 'Choose year level'}</option>
                        {(field === 'course' ? Array.from(new Set([...courses, ...opts.courses])) : years).map(value => <option key={value}>{value}</option>)}
                    </select> : <input value={updateChanges[field] ?? updateTarget.existing?.[field] ?? ''} placeholder={updateTarget.count > 1 ? "Leave blank to preserve each student’s value" : field === "section" ? "F1" : "Enter value"}
                        maxLength={field === 'section' ? 50 : field === 'full_name' ? 150 : 30} disabled={updateBusy}
                        onChange={event => setUpdateChanges(current => ({ ...current, [field]: event.target.value }))} />}
                </label>)}
                {['TRANSFERRED_OUT', 'DROPPED_OUT'].includes(updateReason) && <p className="sm-alert">Records this departure reason and enables the separate Deactivate account action. It does not deactivate the account automatically.</p>}
                {updateReason === 'DEACTIVATE' && <p className="sm-alert error">Students will lose login access and existing sessions will be revoked. Records and QR identities are kept. Every selected student must already have a recorded transfer-out or dropout reason.</p>}
                {updateReason === 'REACTIVATE' && <p className="sm-alert">Restores account access, clears the departure reason, and requires a fresh login.</p>}
                <label>Additional note (optional)
                    <textarea rows="3" maxLength="1000" value={updateNote} disabled={updateBusy}
                        onChange={event => setUpdateNote(event.target.value)} />
                </label>
                <div className="sm-actions"><button className="sm-btn" type="button" disabled={updateBusy} onClick={() => setUpdateTarget(null)}>Cancel</button>
                    <button className="sm-btn dark" disabled={updateBusy || !updateReason}>{updateBusy ? 'Preparing preview…' : 'Review changes'}</button></div>
            </form> : <>
                <p><strong>{updateReasons[updateReason]}</strong></p>
                {updateNote && <p className="sm-update-note">Note: {updateNote}</p>}
                {updateReason === 'DEACTIVATE' && <p role="alert" className="sm-alert error">Confirming revokes login access and current sessions for all students below. Their records remain saved.</p>}
                <div className="sm-table-wrap sm-update-preview"><table><thead><tr><th>Student</th><th>Proposed change</th></tr></thead><tbody>
                    {updateReview.students.map(student => <tr key={student.id}><td>{student.before.full_name}<br />{student.before.student_number}</td>
                        <td>{changesLabel(student.before, student.after)}</td></tr>)}
                </tbody></table></div>
                <div className="sm-actions"><button className="sm-btn" disabled={updateBusy} onClick={() => setUpdateReview(null)}>Back</button>
                    <button className="sm-btn dark" disabled={updateBusy} onClick={confirmUpdate}>{updateBusy ? 'Saving…' : updateReason === 'DEACTIVATE' ? 'Confirm deactivation' : 'Confirm updates'}</button></div>
            </>}
        </Modal>}
        {history && <Modal title={`Edit history · ${history.name}`} onClose={() => setHistory(null)}>
            {history.error && <p role="alert" className="sm-alert error">{history.error}</p>}
            {history.loading ? <p>Loading history…</p> : !history.rows.length ? <p>No recorded edits yet. Edits made before this feature are not included.</p> : <div className="sm-update-preview">
                {history.rows.map(entry => <article className="sm-history-entry" key={entry.id}>
                    <strong>{updateReasons[entry.reason] || entry.reason}</strong>
                    <p>{datePHT(entry.changed_at)} · {entry.changed_by || 'Administrator'}</p>
                    <p>{changesLabel(entry.before_values, entry.after_values)}</p>
                    {entry.note && <p className="sm-update-note">Note: {entry.note}</p>}
                </article>)}
                <p>Showing up to 100 most recent changes.</p>
            </div>}
        </Modal>}
        {formOpen && <Modal
            title="Individual Student Registration"
            onClose={() => {
                return setFormOpen(false)
            }}
        >
            {error && <p
                role="alert"
                className="sm-alert error"
            >{error}</p>}
            <section id="sm-form">
                <div className="sm-panel-head">
                    <div>
                        <h2>
                            Register Student
                        </h2>

                        <p>
                            Registration creates a QR token and one-time activation code.
                        </p>
                    </div>


                </div>

                <form
                    className="sm-form"
                    onSubmit={save}
                >
                    <AcademicPeriodSelect accessToken={accessToken} value={registrationPeriod} onChange={setRegistrationPeriod} required openOnly defaultCurrent />
                    <label>
                        Student Number
                        <input
                            required
                            pattern="MCC-[0-9]{4}-[0-9]{5}"
                            maxLength="14"
                            placeholder="MCC-2026-00001"
                            value={form.student_number}
                            onChange={event => {
                                return setForm({
                                    ...form,
                                    student_number: event.target.value.toUpperCase()
                                })
                            }}
                        />
                    </label>

                    <label>
                        Full Name
                        <input
                            required
                            maxLength="150"
                            value={form.full_name}
                            onChange={event => {
                                return setForm({
                                    ...form,
                                    full_name: event.target.value
                                })
                            }}
                        />
                    </label>

                    <label>
                        Section
                        <input
                            required
                            maxLength="50"
                            placeholder="e.g., F1 — program letter + section"
                            pattern="[A-Za-z]+[1-9][0-9]*"
                            value={form.section}
                            onChange={event => {
                                return setForm({
                                    ...form,
                                    section: event.target.value
                                })
                            }}
                        />
                    </label>

                    <label>
                        Course
                        <select
                            required
                            value={form.course}
                            onChange={event => {
                                return setForm({
                                    ...form,
                                    course: event.target.value
                                })
                            }}
                        >
                            <option value="">Select course</option>

                            {(form.course && !courses.includes(form.course) ? [form.course, ...courses] : courses).map(course => {
                                return <option
                                    key={course}
                                    value={course}
                                >
                                    {course}
                                </option>
                            })}
                        </select>
                    </label>

                    <label>
                        Year Level
                        <select
                            required
                            value={form.year_level}
                            onChange={event => {
                                return setForm({
                                    ...form,
                                    year_level: event.target.value
                                })
                            }}
                        >
                            <option value="">Select year</option>

                            {years.map(year => {
                                return <option
                                    key={year}
                                    value={year}
                                >
                                    {year}
                                </option>
                            })}
                        </select>
                    </label>

                    <button
                        className="sm-btn dark"
                        type="submit"
                    >
                        Register Student
                    </button>
                </form>
            </section>

        </Modal>}
        {importOpen && <Modal
            title="Bulk Import Students (Excel)"
            onClose={() => {
                return setImportOpen(false)
            }}
        >
            <p>Upload an .xlsx file up to 5 MB with at most 500 students. Existing student numbers are enrolled in the chosen semester without creating another account or QR.</p>
            <AcademicPeriodSelect accessToken={accessToken} value={importPeriod} onChange={setImportPeriod} required openOnly defaultCurrent />
            <p>
                <a
                    className="sm-btn"
                    href={`${import.meta.env.BASE_URL}student_import_template.xlsx`}
                    download="student_import_template.xlsx"
                >Download Excel Template</a>
            </p>
            <p>Required row 1 headers: student_number, full_name, section, course, year_level.</p>
            {error && <p
                role="alert"
                className="sm-alert error"
            >{error}</p>}
            <input
                disabled={!importPeriod}
                aria-label="Student Excel file"
                type="file"
                accept=".xlsx"
                onChange={importFile}
            />
        </Modal>}
        <AcademicPeriodSelect accessToken={accessToken} value={filters.academic_period_id || ''} onChange={value => filter('academic_period_id', value === 'all' ? '' : value)} includeAll />
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
                            strokeLinecap="round"
                        >
                            <path d="M4 7h16M4 17h16M8 4v6m8 4v6" />
                        </svg>
                    </span>
                    <div>
                        <h2>Search &amp; Filters</h2>
                        <p>Find students by name, number, course, year, or section.</p>
                    </div>
                </div>
                <div className="sm-actions sm-filter-actions">
                    <button
                        className="sm-btn"
                        onClick={() => {
                            load()
                            meta()
                        }}
                    ><svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                    >
                            <path d="M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 12-1l2 3M4 15l2 3a7 7 0 0 0 12-1" />
                        </svg>Refresh</button>
                    <button
                        className="sm-btn dark"
                        onClick={exportPDF}
                        disabled={exporting}
                    >
                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.7"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                        >
                            <path d="M12 3v12m-4-4 4 4 4-4M4 15v5h16v-5" />
                        </svg>
                        {exporting ? 'Preparing PDF...' : 'Export QR + Activation Codes PDF'}
                    </button>
                </div>
            </div>
            <div className="sm-filters">
                <label className="sm-search-field">Search students
                    <span className="sm-search-control">
                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
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
                            aria-label="Search students"
                            placeholder="Search number, name, section..."
                            value={filters.search}
                            onChange={event => {
                                return filter('search', event.target.value)
                            }}
                        />
                    </span>
                </label>

                {[['section', 'Section', null], ['year_level', 'Year level', opts.year_levels], ['course', 'Course', courses], ['activation_status', 'Account status', ['PENDING', 'ACTIVATED']], ['account_status', 'Account access', ['ACTIVE', 'INACTIVE']]].map(([key, label, values]) => {
                    return <label key={key}>
                        {label}
                        {key === 'section' ? <input
                            placeholder="e.g., F1"
                            value={filters.section}
                            onChange={event => {
                                return filter('section', event.target.value)
                            }}
                        /> : <select
                            aria-label={label}
                            value={filters[key]}
                            onChange={event => {
                                return filter(key, event.target.value)
                            }}
                        >
                            <option value="">All {label}</option>

                            {(values || []).map(value => {
                                return <option
                                    key={value}
                                    value={value}
                                >
                                    {key === 'activation_status' ? (value === 'ACTIVATED' ? 'Activated' : 'Pending activation') : key === 'account_status' ? (value === 'ACTIVE' ? 'Active' : 'Deactivated') : value}
                                </option>
                            })}
                        </select>}
                    </label>
                })}

                <button
                    className="sm-btn"
                    onClick={() => {
                        clearStudentSelection()
                        return setFilters({
                            search: '',
                            account_status: '',
                            activation_status: '',
                            qr_status: '',
                            course: '',
                            year_level: '',
                            section: '',
                            sort: 'recent',
                            page: 1,
                            per_page: 10
                        })
                    }}
                >
                    Clear
                </button>
            </div>

        </section>
        <section className="sm-panel">
            <div className="sm-panel-head">
                <h2>Student Records</h2>
                <span>{pagination.total_records || 0} matching students</span>
            </div>
            <div className="sm-selection-toolbar">
                <button type="button" className="sm-btn" aria-pressed={multipleEdits} onClick={() => {
                    setMultipleEdits(current => !current)
                    clearStudentSelection()
                }}>{multipleEdits ? 'Finish multiple edits' : 'Allow multiple edits'}</button>
                {multipleEdits && <>
                <label><input type="checkbox" aria-label="Select students on this page" disabled={loading || selectingMatching || !rows.length}
                    checked={rows.length > 0 && rows.every(student => selectedIds.includes(Number(student.id)))}
                    onChange={event => {
                        setAllMatching(false)
                        const pageIds = rows.map(student => Number(student.id))
                        setSelectedIds(current => event.target.checked ? Array.from(new Set([...current, ...pageIds])) : current.filter(id => !pageIds.includes(id)))
                    }} />Select this page</label>
                <span>{selectedIds.length} selected</span>
                {!hasMatchingFilter && <span>Apply a filter to select all matching records.</span>}
                <button type="button" className="sm-btn" disabled={loading || selectingMatching || !hasMatchingFilter || !pagination.total_records || pagination.total_records > 2000}
                    onClick={selectMatchingStudents}>{selectingMatching ? 'Selecting matching records…' : `Select all ${pagination.total_records || 0} matching students`}</button>
                <button type="button" className="sm-btn dark" disabled={loading || selectingMatching || !selectedIds.length} onClick={() => openUpdate()}>Update selected students</button>
                {(allMatching || selectedIds.length > 0) && <button type="button" className="sm-btn" onClick={clearStudentSelection}>Clear selection</button>}
                {pagination.total_records > 2000 && <span>Narrow filters to update at most 2,000 students per batch.</span>}
                </>}
            </div>
            <div className="sm-table-wrap">
                <table>
                    <thead>
                        <tr>
                            {multipleEdits && <th>Select</th>}
                            {['Student Number', 'Full Name', 'Section', 'Course', 'Year', 'Account', 'Activation', 'Registered At', 'Activated At', 'Actions'].map(heading => {
                                return <th key={heading}>{heading}</th>
                            })}
                        </tr>
                    </thead>

                    <tbody>
                        {loading ? <tr>
                            <td
                                colSpan={multipleEdits ? 11 : 10}
                                className="empty"
                            >
                                Loading...
                            </td>
                        </tr> : !rows.length ? <tr>
                            <td
                                colSpan={multipleEdits ? 11 : 10}
                                className="empty"
                            >
                                No student records found.
                            </td>
                        </tr> : rows.map(student => {
                            return <tr key={student.id}>
                                {multipleEdits && <td><input type="checkbox" aria-label={`Select ${student.full_name}`} disabled={selectingMatching} checked={selectedIds.includes(Number(student.id))}
                                    onChange={event => {
                                        setAllMatching(false)
                                        setSelectedIds(current => event.target.checked ? [...current, Number(student.id)] : current.filter(id => id !== Number(student.id)))
                                    }} /></td>}
                                <td>
                                    <b>{student.student_number}</b>
                                </td>

                                <td>{student.full_name}</td>
                                <td>{student.section || '—'}</td>
                                <td>{student.course}</td>
                                <td>{student.year_level}</td>

                                <td>
                                    <Badge value={student.account_status} />
                                </td>

                                <td>
                                    <Badge value={student.activation_status} />
                                </td>

                                <td>
                                    {datePHT(student.registered_at)}
                                </td>
                                <td>{datePHT(student.activated_at)}</td>
                                <td>
                                    <div className="sm-row-actions">
                                        <button onClick={() => openProfile(student)}>View / Edit profile</button>
                                    </div>
                                </td>
                            </tr>
                        })}
                    </tbody>
                </table>
            </div>

            <footer className="sm-pagination">
                <span>
                    {pagination.total_records || 0} records
                </span>

                <div>
                    <button
                        className="sm-btn"
                        disabled={loading || pagination.current_page <= 1}
                        onClick={() => {
                            return setFilters(current => {
                                return {
                                    ...current,
                                    page: Number(pagination.current_page) - 1
                                }
                            })
                        }}
                    >
                        Previous
                    </button>

                    <span>
                        Page {pagination.current_page || 1} of{' '}
                        {Math.max(1, pagination.total_pages || 1)}
                    </span>

                    <button
                        className="sm-btn"
                        disabled={loading || !pagination.total_pages || pagination.current_page >= pagination.total_pages}
                        onClick={() => {
                            return setFilters(current => {
                                return {
                                    ...current,
                                    page: Number(pagination.current_page) + 1
                                }
                            })
                        }}
                    >
                        Next
                    </button>
                </div>
            </footer>
        </section>

        {deleteStudent && <Modal
            title="Delete Student"
            onClose={() => {
                return setDeleteStudent(null)
            }}
        >
            <p>Delete {deleteStudent.full_name} ({deleteStudent.student_number})? Only pending, unlinked students can be deleted.</p>
            {error && <p
                role="alert"
                className="sm-alert error"
            >{error}</p>}
            <button
                className="sm-btn"
                onClick={() => {
                    return setDeleteStudent(null)
                }}
            >Cancel</button>
            <button
                className="sm-btn dark"
                onClick={async () => {
                    const result = await action('delete', {
                        id: deleteStudent.id
                    })
                    if (result) {
                        setDeleteStudent(null)
                        closeProfile()
                    }
                }}
            >Delete Student</button>
        </Modal>}
        {secret && <div
            className="sm-overlay"
            onClick={() => {
                return setSecret(null)
            }}
        >
            <div
                className="sm-modal"
                onClick={event => {
                    return event.stopPropagation()
                }}
            >
                <button
                    className="close"
                    onClick={() => {
                        return setSecret(null)
                    }}
                >
                    ×
                </button>

                <h2>Activation Code</h2>

                <p>
                    {secret.full_name} · {secret.student_number}
                </p>

                <strong className="sm-code">
                    {secret.activation_code}
                </strong>

                <p>
                    Expires: {secret.activation_code_expires_at}
                </p>

                <button
                    className="sm-btn dark"
                    onClick={() => {
                        return navigator.clipboard?.writeText(secret.activation_code)
                    }}
                >
                    Copy Code
                </button>
            </div>
        </div>}

    </main>
}

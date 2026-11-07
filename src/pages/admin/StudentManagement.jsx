import { useCallback, useEffect, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import QRCode from 'qrcode'
import { jsPDF } from 'jspdf'
import '../../css/admin/StudentManagement.css'
const API = '/api/admin/students'
const courses = ['AB ENGLISH', 'ABPSYCH', 'BSHM', 'BSTM', 'BSIT', 'BSCRIM', 'BSED', 'BTVTED', 'BTLED']
const years = ['1st Year', '2nd Year', '3rd Year', '4th Year']
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
        className="sm-modal"
        aria-label={title}
        onCancel={onClose}
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
function datePHT(value) {
    if (!value) {
        return '—'
    }
    const date = new Date(String(value).replace(' ', 'T') + (/[Z+]|-\d\d:\d\d$/.test(String(value)) ? '' : '+08:00'))
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('en-PH', {
        timeZone: 'Asia/Manila'
    })
}
async function req(url, token, method = 'GET', body = null) {
    const response = await fetch(url, {
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
    const [pagination, setPagination] = useState({
        current_page: 1,
        total_pages: 1,
        total_records: 0,
        per_page: 10
    })
    const [form, setForm] = useState(blank)
    const [editId, setEditId] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [notice, setNotice] = useState('')
    const [secret, setSecret] = useState(null)
    const [qr, setQr] = useState(null)
    const [formOpen, setFormOpen] = useState(false)
    const [importOpen, setImportOpen] = useState(false)
    const [deleteStudent, setDeleteStudent] = useState(null)
    const [exporting, setExporting] = useState(false)
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
    function filter(key, value) {
        setLoading(true)
        setFilters(current => {
            return {
                ...current,
                [key]: value,
                page: 1
            }
        })
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
        const data = await action(editId ? 'update' : 'create', editId ? {
            id: editId,
            ...form
        } : form)
        if (data) {
            if (!editId && data.data?.activation_code) {
                setSecret(data.data)
            }
            setForm(blank)
            setEditId(null)
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
                rows: dataRows
            })
            if (result?.data) {
                setImportOpen(false)
                setNotice(`Import complete: ${result.data.created} created, ` + `${result.data.skipped} skipped. ` + `${(result.data.errors || []).join(' ')}`)
            }
        } catch (err) {
            setError(err.message)
        }
    }
    async function showQR(student) {
        try {
            const result = await req(`${API}/qr-details`, accessToken, 'POST', {
                id: student.id
            })
            const image = await QRCode.toDataURL(result.data.qr_token, {
                width: 300,
                margin: 2
            })
            setQr({
                ...result.data,
                image
            })
        } catch (err) {
            setError(err.message)
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
                        setEditId(null)
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

        {formOpen && <Modal
            title={editId ? 'Edit Student' : 'Individual Student Registration'}
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
                            {editId ? 'Edit Student' : 'Register Student'}
                        </h2>

                        <p>
                            {editId ? 'Existing QR token is preserved.' : 'Registration creates a QR token and one-time activation code.'}
                        </p>
                    </div>

                    {editId && <button
                        className="sm-btn"
                        onClick={() => {
                            setEditId(null)
                            setForm(blank)
                            setFormOpen(false)
                        }}
                    >
                        Cancel
                    </button>}
                </div>

                <form
                    className="sm-form"
                    onSubmit={save}
                >
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
                            placeholder="e.g., 1F1 — year + program letter + section"
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
                        {editId ? 'Save Changes' : 'Register Student'}
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
            <p>Upload an .xlsx file up to 5 MB with at most 500 students.</p>
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
                aria-label="Student Excel file"
                type="file"
                accept=".xlsx"
                onChange={importFile}
            />
        </Modal>}
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

                {[['activation_status', 'Activation status', ['PENDING', 'ACTIVATED']], ['course', 'Course', courses], ['year_level', 'Year level', opts.year_levels], ['section', 'Section', null]].map(([key, label, values]) => {
                    return <label key={key}>
                        {label}
                        {key === 'section' ? <input
                            placeholder="e.g., 1F1"
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
                                    {value}
                                </option>
                            })}
                        </select>}
                    </label>
                })}

                <button
                    className="sm-btn"
                    onClick={() => {
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
            <div className="sm-table-wrap">
                <table>
                    <thead>
                        <tr>
                            {['Student Number', 'Full Name', 'Section', 'Course', 'Year', 'Account', 'Activation', 'Registered At (PHT)', 'Activated At (PHT)', 'Actions'].map(heading => {
                                return <th key={heading}>{heading}</th>
                            })}
                        </tr>
                    </thead>

                    <tbody>
                        {loading ? <tr>
                            <td
                                colSpan="10"
                                className="empty"
                            >
                                Loading...
                            </td>
                        </tr> : !rows.length ? <tr>
                            <td
                                colSpan="10"
                                className="empty"
                            >
                                No student records found.
                            </td>
                        </tr> : rows.map(student => {
                            return <tr key={student.id}>
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
                                        <button
                                            onClick={() => {
                                                setEditId(student.id)
                                                setForm({
                                                    student_number: student.student_number,
                                                    full_name: student.full_name,
                                                    section: student.section,
                                                    course: student.course,
                                                    year_level: student.year_level
                                                })
                                                setFormOpen(true)
                                            }}
                                        >
                                            Edit
                                        </button>

                                        {student.qr_token_status === 'ACTIVE' && <button
                                            onClick={() => {
                                                return showQR(student)
                                            }}
                                        >View QR</button>}

                                        {student.activation_status === 'PENDING' && <button
                                            onClick={() => {
                                                return action('reveal-code', {
                                                    id: student.id
                                                })
                                            }}
                                        >
                                            View Code
                                        </button>}

                                        {student.activation_status === 'PENDING' && <button
                                            onClick={() => {
                                                setDeleteStudent(student)
                                            }}
                                        >
                                            Delete
                                        </button>}

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

        {qr && <div
            className="sm-overlay"
            onClick={() => {
                return setQr(null)
            }}
        >
            <div
                className="sm-modal qr-modal"
                onClick={event => {
                    return event.stopPropagation()
                }}
            >
                <button
                    className="close"
                    onClick={() => {
                        return setQr(null)
                    }}
                >
                    ×
                </button>

                <h2>Student QR Code</h2>

                <p>
                    {qr.full_name} · {qr.student_number}
                </p>

                <img
                    src={qr.image}
                    alt="Student QR"
                />

                <button
                    className="sm-btn dark"
                    onClick={() => {
                        const link = document.createElement('a')
                        link.href = qr.image
                        link.download = `QR-${qr.student_number}.png`
                        link.click()
                    }}
                >
                    Download PNG
                </button>
            </div>
        </div>}
    </main>
}

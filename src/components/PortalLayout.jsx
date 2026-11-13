import { useEffect, useRef, useState } from 'react'
import { trackEvent } from '../config/posthog'
import './PortalLayout.css'

// Outline SVG paths adapted from Heroicons (Tailwind Labs), MIT licensed.
// https://github.com/tailwindlabs/heroicons
const paths = {
    notifications: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4',
    dashboard: 'M3.75 3.75h6v6h-6z M14.25 3.75h6v6h-6z M3.75 14.25h6v6h-6z M14.25 14.25h6v6h-6z',
    students: 'M18 18.72a9.1 9.1 0 0 0 3.74-.48 3 3 0 0 0-4.68-2.5 M6 18.72a9.1 9.1 0 0 1-3.74-.48 3 3 0 0 1 4.68-2.5 M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM20.25 9a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0ZM8.25 9a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0ZM12 14.25a6 6 0 0 0-6 6v.75a17.9 17.9 0 0 0 12 0v-.75a6 6 0 0 0-6-6Z',
    organizations: 'M3 21h18M3 10.5h18M4.5 21V10.5m5 10.5V10.5m5 10.5V10.5m5 10.5V10.5M3 7.5l9-5.25 9 5.25v3H3v-3Z',
    events: 'M6.75 3v2.25m10.5-2.25v2.25M3 9h18M5.25 4.5h13.5A2.25 2.25 0 0 1 21 6.75v12A2.25 2.25 0 0 1 18.75 21H5.25A2.25 2.25 0 0 1 3 18.75v-12A2.25 2.25 0 0 1 5.25 4.5ZM7.5 13.5h3m3 0h3m-9 3h3',
    attendance: 'm9 12 2.25 2.25L15 9M9 3.75H6.75A2.25 2.25 0 0 0 4.5 6v13.5a2.25 2.25 0 0 0 2.25 2.25h10.5a2.25 2.25 0 0 0 2.25-2.25V6a2.25 2.25 0 0 0-2.25-2.25H15M9 2.25h6v3H9z',
    violations: 'M12 9v3.75m0 3h.008M10.05 4.1 2.4 17.35A2.25 2.25 0 0 0 4.35 20.7h15.3a2.25 2.25 0 0 0 1.95-3.35L13.95 4.1a2.25 2.25 0 0 0-3.9 0Z',
    fines: 'M2.25 6.75h19.5v12H2.25zM2.25 9.75a3 3 0 0 0 3-3m13.5 0a3 3 0 0 0 3 3m0 6a3 3 0 0 0-3 3m-13.5 0a3 3 0 0 0-3-3M15 12.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
    payments: 'M2.25 8.25h19.5M2.25 10.5h19.5M6 15.75h3M4.5 4.5h15a2.25 2.25 0 0 1 2.25 2.25v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75A2.25 2.25 0 0 1 4.5 4.5Z',
    qr: 'M3.75 3.75h6v6h-6zM14.25 3.75h6v6h-6zM3.75 14.25h6v6h-6zM14.25 14.25h3v3h3v3h-6zM20.25 14.25v.008',
    profile: 'M15.75 8.25a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.5 20.12a7.5 7.5 0 0 1 15 0A17.93 17.93 0 0 1 12 21.75a17.93 17.93 0 0 1-7.5-1.63Z',
    logout: 'M9 8.25V6A2.25 2.25 0 0 1 11.25 3.75h6A2.25 2.25 0 0 1 19.5 6v12a2.25 2.25 0 0 1-2.25 2.25h-6A2.25 2.25 0 0 1 9 18v-2.25M15 12H3m0 0 3-3m-3 3 3 3',
    brand: 'M12 3 2.25 8.25 12 13.5l9.75-5.25L12 3ZM5.25 10v6.5L12 20.25l6.75-3.75V10M21.75 8.25v7.5',
    menu: 'M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5',
    close: 'm6 6 12 12M6 18 18 6'
}
function Icon({
    name
}) {
    return <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
    >
        <path d={paths[name] || paths.dashboard} />
    </svg>
}
export default function PortalLayout({
    role,
    account,
    items,
    badges = {},
    page,
    onNavigate,
    onLogout,
    className = '',
    pageDescription,
    children
}) {
    const [open, setOpen] = useState(() => {
        return !window.matchMedia('(max-width: 800px)').matches
    })
    const [mobile, setMobile] = useState(() => {
        return window.matchMedia('(max-width: 800px)').matches
    })
    const toggle = useRef(null)
    const sidebar = useRef(null)
    useEffect(() => {
        const media = window.matchMedia('(max-width: 800px)')
        const update = event => {
            setMobile(event.matches)
            setOpen(!event.matches)
        }
        media.addEventListener('change', update)
        return () => {
            return media.removeEventListener('change', update)
        }
    }, [])
    useEffect(() => {
        if (open && mobile) {
            sidebar.current?.querySelector('button')?.focus()
        }
    }, [open, mobile])
    function closeMenu() {
        setOpen(false)
        toggle.current?.focus()
    }
    return <div
        className={`portal-layout ${open ? 'sidebar-open' : 'sidebar-closed'} ${className}`}
        onKeyDown={event => {
            if (event.key === 'Escape' && open) {
                closeMenu()
            }
        }}
    >
        {open && mobile && <button
            className="portal-overlay"
            aria-label="Close navigation"
            onClick={closeMenu}
        />}
        <aside
            ref={sidebar}
            inert={!open}
            className={`portal-sidebar ${open ? 'is-open' : ''}`}
            id="portal-navigation"
            onKeyDown={event => {
                if (!mobile || !open || event.key !== 'Tab') {
                    return
                }
                const buttons = sidebar.current.querySelectorAll('button')
                const first = buttons[0],
                    last = buttons[buttons.length - 1]
                if (event.shiftKey && document.activeElement === first) {
                    event.preventDefault()
                    last.focus()
                } else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault()
                    first.focus()
                }
            }}
        >
            <div className="portal-brand">
                <img
                    src="/mindoro-state-university-logo.jpg"
                    alt="MinSU logo"
                    width="38"
                    height="38"
                />
                <strong>MINSU-MCCS</strong>
            </div>
            {role.toUpperCase() === 'ADMIN' && <section className="portal-profile" aria-label="Administrator account">
                <span className="portal-avatar">{account?.slice(0, 2).toUpperCase()}</span>
                <div><strong>{account}</strong><small>Administrator</small></div>
            </section>}
            <nav aria-label={`${role} navigation`}>
                <ul>{items.map(([key, label]) => {
                    return <li key={key}>
                        <button
                            type="button"
                            aria-current={page === key ? 'page' : undefined}
                            onClick={() => {
                                if (key !== page) {
                                    trackEvent('feature_used', {
                                        role,
                                        feature: key,
                                        source: 'sidebar'
                                    })
                                }

                                onNavigate(key)

                                if (mobile) {
                                    closeMenu()
                                }
                            }}
                        >
                            <Icon name={key} />
                            <span>{label}</span>
                            {badges[key] > 0 && <span className="portal-nav-badge">{badges[key] > 99 ? '99+' : badges[key]}</span>}
                        </button>
                    </li>
                })}</ul>
            </nav>
            <div className="portal-sidebar-footer">
                <button
                    type="button"
                    onClick={onLogout}
                >
                    <Icon name="logout" />
                    <span>Log Out</span>
                </button>
            </div>
        </aside>
        <div className="portal-main">
            <header className="portal-topbar">
                <button
                    ref={toggle}
                    className="portal-menu-toggle"
                    aria-label={open ? 'Collapse sidebar' : 'Expand sidebar'}
                    title={open ? 'Collapse sidebar' : 'Expand sidebar'}
                    aria-expanded={open}
                    aria-controls="portal-navigation"
                    onClick={() => {
                        return setOpen(value => {
                            return !value
                        })
                    }}
                >
                    <Icon name="menu" />
                </button>
                <div className="portal-page-title">
                    <span className="portal-breadcrumb">MINSU-MCCS <span aria-hidden="true">/</span></span>
                    <h1>{items.find(([key]) => {
                        return key === page
                    })?.[1] || 'Dashboard'}</h1>
                    {pageDescription && <p>{pageDescription}</p>}
                    {role !== 'Admin' && <p>{role} · {account}</p>}
                </div>
                <time
                    className="portal-today"
                    dateTime={new Date().toLocaleDateString('en-CA', {
                        timeZone: 'Asia/Manila'
                    })}
                >{new Date().toLocaleDateString('en-PH', {
                    timeZone: 'Asia/Manila',
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                })}</time>
            </header>
            <main className="portal-content">{children}</main>
        </div>
    </div>
}

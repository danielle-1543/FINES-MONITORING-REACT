import { useState } from 'react'
export default function PasswordInput(props) {
    const [visible, setVisible] = useState(false)
    return <span className="password-control">
        <input
            {...props}
            type={visible ? 'text' : 'password'}
        />
        <button
            className="password-toggle"
            type="button"
            disabled={props.disabled}
            aria-label={visible ? 'Hide password' : 'Show password'}
            aria-pressed={visible}
            onClick={() => {
                return setVisible(value => {
                    return !value
                })
            }}
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
                {visible ? <><path
                    d="m3 3 18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.2A11 11 0 0 1 12 5c5.5 0 9 7 9 7a18 18 0 0 1-3.1 3.9M6.1 6.1A18 18 0 0 0 3 12s3.5 7 9 7a11 11 0 0 0 5.9-1.9"
                /></> : <><path d="M3 12s3.5-7 9-7 9 7 9 7-3.5 7-9 7-9-7-9-7Z" /><circle
                    cx="12"
                    cy="12"
                    r="3"
                /></>}
            </svg>
        </button>
    </span>
}

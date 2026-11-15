import { useId, useState } from 'react'
import { passwordRequirements } from '../utils/emailOtp'
export default function PasswordInput({ showStrength = false, ...props }) {
    const [visible, setVisible] = useState(false)
    const feedbackId = useId()
    const rules = showStrength ? passwordRequirements(props.value) : []
    const hasValue = typeof props.value === 'string' && props.value.length > 0
    const met = rules.slice(0, 5).filter(rule => rule.met).length
    const valid = rules.length > 0 && rules.every(rule => rule.met)
    const score = !hasValue ? 0 : valid ? 4 : !rules[0]?.met || !rules[5]?.met ? 1 : met >= 4 ? 3 : 2
    const strength = ['Not entered', 'Weak', 'Fair', 'Good', 'Strong'][score]
    return <span className="password-field">
        <span className="password-control">
        <input
            {...props}
            aria-describedby={[props['aria-describedby'], showStrength ? feedbackId : null].filter(Boolean).join(' ') || undefined}
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
        {showStrength && <span id={feedbackId} className={`password-feedback password-feedback--${score}`}>
            <span className="password-strength-label" role="status" aria-live="polite">Password strength: <strong>{strength}</strong></span>
            <span className="password-strength-track" role="meter" aria-label="Password strength" aria-valuemin={0} aria-valuemax={4} aria-valuenow={score} aria-valuetext={strength}>
                <span className="password-strength-fill" style={{ width: `${score * 25}%` }} />
            </span>
            <span className="password-requirements" role="group" aria-label="Password requirements">
                {rules.map(rule => <span key={rule.label} className={`password-requirement${rule.met ? ' is-met' : ''}`}>
                    <span className="password-rule-status">{rule.met ? 'Met: ' : 'Needed: '}</span>
                    {rule.label}
                </span>)}
            </span>
        </span>}
    </span>
}

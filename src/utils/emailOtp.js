import { apiFetch } from './apiFetch'

export async function otpRequest(path, body, token) {
    const response = await apiFetch(path, {
        method: 'POST', cache: 'no-store',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(body)
    })
    const result = await response.json()
    if (!response.ok || !result.success) throw new Error(result.message || 'Verification failed.')
    return result
}

// Uses the same native dialog pattern as the application's confirmation prompts.
export async function withEmailOtp({ request, challenge, verify, message = 'Enter the six-digit code sent to your email.' }) {
    let current = challenge || await request()
    return new Promise((resolve, reject) => {
        const previous = document.activeElement
        const dialog = document.createElement('dialog')
        dialog.className = 'action-confirmation'
        dialog.setAttribute('aria-label', 'Verify your email')
        const heading = document.createElement('h2')
        heading.textContent = 'Verify your email'
        const description = document.createElement('p')
        description.textContent = `${message} Codes expire in 10 minutes.`
        const form = document.createElement('form')
        const label = document.createElement('label')
        label.textContent = 'Six-digit email code'
        const input = document.createElement('input')
        input.type = 'text'; input.inputMode = 'numeric'; input.autocomplete = 'one-time-code'
        input.pattern = '[0-9]{6}'; input.maxLength = 6; input.required = true
        label.append(input)
        const error = document.createElement('p')
        error.setAttribute('role', 'alert')
        const submit = document.createElement('button')
        submit.type = 'submit'; submit.textContent = 'Verify and continue'
        const resend = document.createElement('button')
        resend.type = 'button'
        const cancel = document.createElement('button')
        cancel.type = 'button'; cancel.textContent = 'Cancel'
        let busy = false, finished = false, availableAt = Date.now() + 60000
        function updateResend() {
            const seconds = Math.max(0, Math.ceil((availableAt - Date.now()) / 1000))
            resend.disabled = busy || seconds > 0 || !request
            resend.textContent = seconds ? `Resend in ${seconds}s` : 'Resend code'
        }
        const timer = window.setInterval(updateResend, 1000)
        function finish(result, failure) {
            if (finished) return
            finished = true
            window.clearInterval(timer)
            dialog.close(); dialog.remove(); previous?.focus()
            if (failure) reject(failure)
            else resolve(result)
        }
        function setBusy(value) {
            busy = value; submit.disabled = value; cancel.disabled = value; input.disabled = value
            updateResend()
        }
        form.onsubmit = async event => {
            event.preventDefault()
            if (busy) return
            const otp = input.value
            setBusy(true); error.textContent = ''
            try { finish(await verify({ challenge_id: current.challenge_id, otp })) }
            catch (err) { error.textContent = err.message; setBusy(false); input.focus() }
        }
        resend.onclick = async () => {
            setBusy(true); error.textContent = ''
            try { current = await request(); availableAt = Date.now() + 60000; input.value = '' }
            catch (err) { error.textContent = err.message }
            finally { setBusy(false) }
        }
        cancel.onclick = () => finish(null, new Error('Email verification cancelled.'))
        dialog.oncancel = event => { event.preventDefault(); if (!busy) cancel.click() }
        form.append(label, error, submit, resend, cancel)
        dialog.append(heading, description, form)
        document.body.append(dialog); updateResend(); dialog.showModal(); input.focus()
    })
}

export async function authorizeAccountChange(path, token, body, submit) {
    const purpose = /\/password$/.test(path) ? 'password_change' : 'email_change'
    return withEmailOtp({
        request: () => otpRequest('/api/auth/otp/request', { purpose, email: body.email || '', current_password: body.current_password }, token),
        message: purpose === 'email_change' ? 'Enter the code sent to your new email address.' : 'Enter the code sent to your current email address.',
        verify: otp => submit({ ...body, ...otp })
    })
}

export const PASSWORD_REQUIREMENTS = 'Use at least 12 characters with an uppercase letter, a lowercase letter, a number, and a symbol (maximum 72 UTF-8 bytes).'

export function passwordRequirements(password) {
    const value = typeof password === 'string' ? password : ''
    return [
        { label: 'At least 12 characters', met: Array.from(value).length >= 12 },
        { label: 'An uppercase letter (A–Z)', met: /[A-Z]/.test(value) },
        { label: 'A lowercase letter (a–z)', met: /[a-z]/.test(value) },
        { label: 'A number (0–9)', met: /[0-9]/.test(value) },
        { label: 'A symbol (for example !, @, #)', met: /[^\p{L}\p{N}\s]/u.test(value) && !value.includes('\0') },
        { label: 'No more than 72 UTF-8 bytes', met: value.length > 0 && new TextEncoder().encode(value).length <= 72 }
    ]
}

export function passwordError(password) {
    if (typeof password !== 'string' || !passwordRequirements(password).every(rule => rule.met)) return PASSWORD_REQUIREMENTS
    return ''
}

let active = false

export function askConfirmation({ title = 'Confirm action', message, confirmLabel = 'Confirm' }) {
    if (active) {
        return Promise.resolve(false)
    }
    active = true
    return new Promise(resolve => {
        const previous = document.activeElement
        const dialog = document.createElement('dialog')
        dialog.className = 'action-confirmation'
        dialog.setAttribute('aria-labelledby', 'confirmation-title')
        dialog.setAttribute('aria-describedby', 'confirmation-message')
        const heading = document.createElement('h2')
        heading.id = 'confirmation-title'
        heading.textContent = title
        const description = document.createElement('p')
        description.id = 'confirmation-message'
        description.textContent = message
        const actions = document.createElement('div')
        actions.className = 'confirmation-actions'
        const cancel = document.createElement('button')
        cancel.textContent = 'Cancel'
        const confirm = document.createElement('button')
        confirm.textContent = confirmLabel
        let finished = false
        function finish(value) {
            if (finished) return
            finished = true
            confirm.disabled = true
            dialog.close()
            dialog.remove()
            active = false
            previous?.focus()
            resolve(value)
        }
        cancel.onclick = () => finish(false)
        confirm.onclick = () => finish(true)
        dialog.oncancel = event => {
            event.preventDefault()
            finish(false)
        }
        actions.append(cancel, confirm)
        dialog.append(heading, description, actions)
        document.body.append(dialog)
        dialog.showModal()
        cancel.focus()
    })
}

export async function confirmSensitive(path, body) {
    if (!body) return
    const values = body instanceof FormData ? Object.fromEntries(body) : body
    if (values.preview === true) return
    const action = path.split('?')[0].split('/').at(-1)
    if (!['update', 'edit', 'delete', 'password', 'reset-code', 'qr-status', 'review', 'vouchers', 'cancel', 'complete', 'activate', 'deactivate', 'periods'].includes(action)) return
    const subject = values.full_name || values.student_number || values.organization_name || values.username
        || (values.student_ids ? `${values.student_ids.length} selected student(s)` : values.student_id ? `student #${values.student_id}` : values.id ? `record #${values.id}` : 'your account / selected information')
    let message = `Are you sure you want to ${action === 'password' ? 'change the password for' : 'update'} ${subject}?`
    if (action === 'delete') message = `Delete ${subject}? This removes the selected record and cannot be undone.`
    if (action === 'qr-status') message = `${values.action === 'REVOKE' ? 'Revoke the QR code' : 'Generate a replacement QR code'} for ${subject}? The previous QR will immediately stop working. The student account and all records will be preserved.`
    if (action === 'review') message = `${values.decision || values.status || 'Verify'} payment ${subject}? Confirmed payments change the student's balance.`
    if (action === 'vouchers') message = `Apply this discount to ${subject}? It will reduce existing fines and permanently record the supplied reason.`
    if (action === 'reset-code') message = `Replace the activation code for ${subject}? The previous activation code will stop working.`
    if (action === 'complete') message = 'Activate this student account with the details shown?'
    if (action === 'cancel') message = `Cancel payment claim ${subject}? It will no longer be submitted for verification.`
    if (action === 'periods') message = `Save the payment schedule for ${values.label || subject}? These dates determine when students can submit payments.`
    if (!await askConfirmation({ message })) {
        throw new Error('Action cancelled. Nothing was changed.')
    }
}

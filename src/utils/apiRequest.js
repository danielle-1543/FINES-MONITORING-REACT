import { apiFetch } from './apiFetch'
import { confirmSensitive } from './confirmation'
import { authorizeAccountChange } from './emailOtp'

export async function apiRequest(path, token, body, signal, {
    failureMessage = 'Request failed.',
    invalidResponseMessage
} = {}) {
    const hasBody = body !== undefined
    if (hasBody && !body.challenge_id && /^\/api\/(student\/)?account\/(update|password)$/.test(path)) {
        const account = /\/student\//.test(path) ? '/api/student/account' : '/api/account'
        const current = await apiRequest(account, token)
        if (/\/password$/.test(path) || body.email?.trim().toLowerCase() !== current.data.account.email.toLowerCase()) {
            return authorizeAccountChange(path, token, body, verified => apiRequest(path, token, verified, signal, { failureMessage, invalidResponseMessage }))
        }
    }
    await confirmSensitive(path, body)
    const response = await apiFetch(path, {
        method: hasBody ? 'POST' : 'GET',
        cache: 'no-store',
        signal,
        headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
            ...(hasBody ? { 'Content-Type': 'application/json' } : {})
        },
        body: hasBody ? JSON.stringify(body) : undefined
    })
    const result = await response.json().catch(error => {
        throw invalidResponseMessage ? new Error(invalidResponseMessage) : error
    })
    if (!response.ok || !result.success) {
        throw new Error(result.message || result.error || failureMessage)
    }
    return result
}

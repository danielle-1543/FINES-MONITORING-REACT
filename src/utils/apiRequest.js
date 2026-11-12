import { apiFetch } from './apiFetch'
import { confirmSensitive } from './confirmation'

export async function apiRequest(path, token, body, signal, {
    failureMessage = 'Request failed.',
    invalidResponseMessage
} = {}) {
    const hasBody = body !== undefined
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

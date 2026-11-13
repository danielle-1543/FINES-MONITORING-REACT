export function apiUrl(path, configuredBase = import.meta.env.VITE_API_URL) {
    if (typeof path !== 'string' || (path !== '/api' && !path.startsWith('/api/'))) {
        return path
    }

    // Accept either the API origin or its /api base without duplicating /api.
    const base = (configuredBase || '').trim().replace(/\/+$/, '').replace(/\/api$/i, '')
    return `${base}${path}`
}

export async function apiFetch(path, options = {}) {
    const { responseType = 'json', ...fetchOptions } = options
    const url = apiUrl(path)
    const controller = new AbortController()
    const cancel = () => controller.abort(options.signal.reason)
    if (options.signal?.aborted) cancel()
    else options.signal?.addEventListener('abort', cancel, { once: true })
    let timedOut = false
    const timeout = window.setTimeout(() => {
        timedOut = true
        controller.abort()
    }, 45000)
    const method = (options.method || 'GET').toUpperCase()
    const uncertainWrite = !['GET', 'HEAD'].includes(method)
        ? ' The change may have reached the server. Refresh the records before submitting it again.' : ''
    try {
        const response = await fetch(url, { ...fetchOptions, signal: controller.signal })
        const contentType = response.headers.get('content-type') || ''
        if (response.status === 204) {
            throw new Error('The API returned an empty response instead of the expected data. Please contact the administrator.')
        }
        if (responseType === 'blob' && response.ok && /^(?:image\/(?:jpeg|png|webp)|application\/pdf)(?:;|$)/i.test(contentType)) {
            return new Response(await response.blob(), { status: response.status, statusText: response.statusText, headers: response.headers })
        }
        if (response.status !== 204 && !/\bapplication\/(?:[\w.-]+\+)?json\b/i.test(contentType)) {
            const endpoint = new URL(response.url || url, window.location.origin)
            const sameOrigin = endpoint.origin === window.location.origin
            throw new Error(
                `The API returned ${contentType.includes('html') ? 'an HTML page' : 'a non-JSON response'} (HTTP ${response.status}) from ${endpoint.origin}${endpoint.pathname}. ` +
                (sameOrigin
                    ? 'Check the frontend VITE_API_URL setting on Render; it must point to the PHP API, then rebuild the frontend.'
                    : 'Check the backend Render logs for this request and verify the deployed API route.')
            )
        }
        if (response.status !== 204) {
            let result
            try {
                result = await response.json()
            } catch (error) {
                if (controller.signal.aborted) throw error
                throw new Error(`The API returned incomplete or invalid JSON (HTTP ${response.status}). Please try again or contact the administrator.`, { cause: error })
            }
            if (!result || typeof result !== 'object' || Array.isArray(result)) {
                throw new Error('The API returned an unexpected response format. Please contact the administrator.')
            }
            if (!response.ok || result.success === false) {
                const defaults = {
                    401: 'Your session has expired. Please sign in again.',
                    403: 'You do not have permission to perform this action.',
                    404: 'The requested API route or record was not found.',
                    409: 'This record has changed. Refresh before trying again.',
                    413: 'The upload is too large. Choose a smaller file.',
                    422: 'Check the information you entered.',
                    429: 'Too many requests. Please wait before trying again.',
                    503: 'The server is temporarily unavailable. Please try again shortly.'
                }
                const detail = typeof result.message === 'string' ? result.message
                    : typeof result.error === 'string' ? result.error : null
                const reference = typeof result.request_id === 'string' && /^[a-zA-Z0-9-]{1,80}$/.test(result.request_id)
                    ? ` Reference: ${result.request_id}.` : ''
                const message = (detail || defaults[response.status] || 'The server could not complete the request.') + reference
                result = { ...result, success: false, message, error: message }
            }
            // Existing callers keep the Response/status contract and receive one
            // validated JSON object; the timeout includes reading the response body.
            response.json = async () => result
        }
        return response
    } catch (error) {
        if (options.signal?.aborted) throw new DOMException('Request cancelled.', 'AbortError')
        if (timedOut) throw new Error('The server took too long to respond. Please try again.' + uncertainWrite, { cause: error })
        if (error instanceof TypeError) {
            throw new Error((navigator.onLine === false
                ? 'You are offline. Check your internet connection.'
                : 'Unable to reach the API. Check your connection; the server may be unavailable or rejecting this website’s connection.') + uncertainWrite, { cause: error })
        }
        throw error
    } finally {
        window.clearTimeout(timeout)
        options.signal?.removeEventListener('abort', cancel)
    }
}

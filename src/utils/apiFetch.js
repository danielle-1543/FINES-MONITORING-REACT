export function apiUrl(path, configuredBase = import.meta.env.VITE_API_URL) {
    if (typeof path !== 'string' || (path !== '/api' && !path.startsWith('/api/'))) {
        return path
    }

    // Accept either the API origin or its /api base without duplicating /api.
    const base = (configuredBase || '').trim().replace(/\/+$/, '').replace(/\/api$/i, '')
    return `${base}${path}`
}

export function apiFetch(path, options) {
    return fetch(apiUrl(path), options)
}

export async function studentRequest(path, accessToken, body, signal) {
    const response = await fetch(`/api/student/${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        cache: 'no-store',
        signal,
        headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${accessToken}`,
            ...(body === undefined ? {} : {
                'Content-Type': 'application/json'
            })
        },
        body: body === undefined ? undefined : JSON.stringify(body)
    })
    const result = await response.json().catch(() => {
        throw new Error('Unable to read the API response.')
    })
    if (!response.ok || !result.success) {
        throw new Error(result.message || result.error || 'Request failed.')
    }
    return result
}

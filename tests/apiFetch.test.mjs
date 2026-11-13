import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'

async function client(fetch, { offline = false, timeoutMs = 200 } = {}) {
    const context = vm.createContext({
        fetch, URL, Response, AbortController, DOMException, TypeError,
        navigator: { onLine: !offline },
        window: { location: { origin: 'https://frontend.example' },
            setTimeout: fn => setTimeout(fn, timeoutMs), clearTimeout }
    })
    const module = new vm.SourceTextModule(await readFile(new URL('../src/utils/apiFetch.js', import.meta.url), 'utf8'), {
        context, initializeImportMeta(meta) { meta.env = { VITE_API_URL: 'https://backend.example/api' } }
    })
    await module.link(() => {})
    await module.evaluate()
    return module.namespace
}
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

test('normalizes API bases and preserves successful JSON and HTTP errors', async () => {
    const api = await client(async url => { assert.equal(url, 'https://backend.example/api/org/dashboard'); return json({ success: true, data: {} }) })
    assert.equal(api.apiUrl('/api/org/dashboard', 'https://backend.example/api/'), 'https://backend.example/api/org/dashboard')
    assert.equal((await (await api.apiFetch('/api/org/dashboard')).json()).success, true)
    for (const status of [401, 403, 404, 409, 413, 422, 429, 500, 503]) {
        const api = await client(async () => json({ request_id: 'abc-123' }, status))
        const response = await api.apiFetch('/api/test')
        assert.equal(response.status, status)
        const body = await response.json()
        assert.equal(body.success, false)
        assert.match(body.message, /Reference: abc-123/)
    }
})
test('rejects HTML, malformed JSON, empty JSON, and unexpected shapes', async () => {
    for (const response of [new Response('<!DOCTYPE html>', { headers: { 'Content-Type': 'text/html' } }),
        new Response('{bad', { headers: { 'Content-Type': 'application/json' } }), new Response(null, { status: 204 }), json(null), json([])]) {
        const api = await client(async () => response)
        await assert.rejects(api.apiFetch('/api/test'), /HTML|invalid JSON|unexpected response|empty response/)
    }
})
test('reports network failures without retrying writes', async () => {
    let calls = 0
    const api = await client(async () => { calls++; throw new TypeError('fetch failed') }, { offline: true })
    await assert.rejects(api.apiFetch('/api/payments', { method: 'POST' }), /offline.*Refresh the records/)
    assert.equal(calls, 1)
})
test('times out stalled requests and preserves caller cancellation', async () => {
    const api = await client((_, { signal }) => new Promise((resolve, reject) => {
        if (signal.aborted) reject(new DOMException('cancelled', 'AbortError'))
        signal.addEventListener('abort', () => reject(new DOMException('cancelled', 'AbortError')))
    }), { timeoutMs: 15 })
    await assert.rejects(api.apiFetch('/api/test'), /too long/)
    const controller = new AbortController()
    const request = api.apiFetch('/api/test', { signal: controller.signal })
    controller.abort()
    await assert.rejects(request, { name: 'AbortError' })
})
test('accepts payment proof downloads and keeps JSON errors readable', async () => {
    const api = await client(async () => new Response('pdf content', { headers: { 'Content-Type': 'application/pdf' } }))
    assert.equal(await (await api.apiFetch('/api/payments/proof?id=1', { responseType: 'blob' })).text(), 'pdf content')
    const failed = await client(async () => json({ error: 'Proof unavailable.' }, 403))
    assert.equal((await (await failed.apiFetch('/api/payments/proof?id=1', { responseType: 'blob' })).json()).message, 'Proof unavailable.')
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { xenditCheckoutUrl } from '../src/utils/xenditCheckout.js'

test('opens only approved HTTPS Xendit checkout hosts', () => {
    assert.equal(xenditCheckoutUrl('https://dev.xen.to/demo'), 'https://dev.xen.to/demo')
    assert.equal(xenditCheckoutUrl('https://checkout-staging.xendit.co/sessions/ps-demo'), 'https://checkout-staging.xendit.co/sessions/ps-demo')
    for (const value of ['javascript:alert(1)', 'http://dev.xen.to/demo', 'https://dev.xen.to.evil.example/', 'https://user@dev.xen.to/', 'https://evil.example/']) {
        assert.throws(() => xenditCheckoutUrl(value))
    }
})

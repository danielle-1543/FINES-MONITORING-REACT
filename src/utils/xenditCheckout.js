export function xenditCheckoutUrl(value) {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password || url.port ||
        !['dev.xen.to', 'xen.to', 'checkout-staging.xendit.co', 'checkout.xendit.co'].includes(url.hostname)) {
        throw new Error('The server returned an invalid Xendit checkout link.')
    }
    return url.href
}

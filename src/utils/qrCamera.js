// Shared QR camera startup: rear camera first, no device picker, no fragile
// "video is ready right now" check. Browsers (especially mobile Safari) can
// take a moment to deliver the first frame after getUserMedia resolves.
const CAMERA_CONFIGS = [
    { facingMode: 'environment' },
    { facingMode: 'user' }
]
const FRAME_TIMEOUT_MS = 10000

function friendlyError(error) {
    const message = typeof error === 'string' ? error : error?.message || ''
    if (/notallowed|permission denied|permission/i.test(message)) {
        return 'Camera permission was denied. Allow camera access in your browser settings, then reload.'
    }
    if (/notfound|no camera|requested device not found/i.test(message)) {
        return 'No camera was found on this device.'
    }
    if (/notreadable|could not start|in use|busy/i.test(message)) {
        return 'The camera is busy. Close other apps using the camera, then reload.'
    }
    if (/secure context|https|medianotfound|medianotsupported|mediadevices/i.test(message)) {
        return 'Camera access needs HTTPS. Open this page over HTTPS or on localhost.'
    }
    return message || 'The camera could not be started.'
}

function waitForVideo(containerId) {
    return new Promise((resolve, reject) => {
        const startedAt = Date.now()
        let timer
        const check = () => {
            const video = document.querySelector(`#${containerId} video`)
            if (video) {
                // html5-qrcode normally sets these, but enforce them for mobile
                // autoplay policies before trying to nudge playback.
                video.muted = true
                video.playsInline = true
                if (video.videoWidth > 0 && video.videoHeight > 0) {
                    clearTimeout(timer)
                    resolve(video)
                    return
                }
                if (video.paused) {
                    try {
                        const playing = video.play()
                        if (playing?.catch) playing.catch(() => { })
                    } catch { /* The next poll will try again. */ }
                }
            }
            if (Date.now() - startedAt >= FRAME_TIMEOUT_MS) {
                clearTimeout(timer)
                reject(new Error('The camera opened but no video frames arrived. Close other camera apps and reload.'))
                return
            }
            timer = setTimeout(check, 100)
        }
        check()
    })
}

async function release(reader) {
    if (!reader) {
        return
    }
    try {
        if (reader.isScanning) {
            await reader.stop()
        }
    } catch { /* Stream may already be gone. */ }
    try {
        reader.clear()
    } catch { /* Container may already be removed. */ }
}

export async function startQrCamera({ containerId, onScan, formatsToSupport, qrbox }) {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera access needs HTTPS. Open this page over HTTPS or on localhost.')
    }
    const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode')
    let lastError
    for (const facing of CAMERA_CONFIGS) {
        let reader
        try {
            reader = new Html5Qrcode(containerId, {
                formatsToSupport: formatsToSupport || [Html5QrcodeSupportedFormats.QR_CODE],
                useBarCodeDetectorIfSupported: false,
                verbose: false
            })
            await reader.start(facing, {
                fps: 10,
                ...(qrbox ? { qrbox } : {})
            }, onScan, () => { })
            await waitForVideo(containerId)
            let stopped = false
            return {
                reader,
                stop: async () => {
                    if (stopped) {
                        return
                    }
                    stopped = true
                    await release(reader)
                }
            }
        } catch (error) {
            lastError = error
            await release(reader)
        }
    }
    throw new Error(friendlyError(lastError))
}

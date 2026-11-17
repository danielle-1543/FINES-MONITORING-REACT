// Shared QR camera startup. Android Chrome uses its native camera + QR
// detector with a video element we control, because the third-party scanner's
// video surface can show a black preview while the camera is actually on.
// Other browsers keep the html5-qrcode fallback.
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

function waitForVideoElement(video) {
    return new Promise((resolve, reject) => {
        const startedAt = Date.now()
        let timer
        const check = () => {
            if (video.paused) {
                try {
                    const playing = video.play()
                    if (playing?.catch) playing.catch(() => { })
                } catch { /* Retry on the next poll. */ }
            }
            if (video.videoWidth > 0 && video.videoHeight > 0) {
                clearTimeout(timer)
                resolve(video)
                return
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

function styleVideo(video) {
    video.muted = true
    video.playsInline = true
    video.setAttribute('autoplay', '')
    video.setAttribute('muted', '')
    video.setAttribute('playsinline', '')
    Object.assign(video.style, {
        display: 'block',
        width: '100%',
        height: 'auto',
        maxWidth: '100%',
        objectFit: 'contain'
    })
}

async function startNativeCamera({ containerId, onScan }) {
    if (typeof window.BarcodeDetector !== 'function') {
        throw new Error('BarcodeDetector is not available')
    }
    const container = document.getElementById(containerId)
    if (!container) {
        throw new Error('Camera preview container is missing')
    }
    const detector = new window.BarcodeDetector({ formats: ['qr_code'] })
    const video = document.createElement('video')
    styleVideo(video)
    container.replaceChildren(video)
    const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' } }
    })
    video.srcObject = stream
    const playing = video.play()
    if (playing?.catch) playing.catch(() => { })
    await waitForVideoElement(video)
    let stopped = false
    let frame
    let lastScan = 0
    const tick = async now => {
        if (stopped) {
            return
        }
        frame = requestAnimationFrame(tick)
        if (now - lastScan < 100 || video.readyState < 2) {
            return
        }
        lastScan = now
        try {
            const codes = await detector.detect(video)
            if (codes.length && !stopped) {
                onScan(codes[0].rawValue)
            }
        } catch { /* A frame may be unreadable; keep scanning. */ }
    }
    frame = requestAnimationFrame(tick)
    return {
        reader: null,
        stop: async () => {
            if (stopped) {
                return
            }
            stopped = true
            cancelAnimationFrame(frame)
            stream.getTracks().forEach(track => track.stop())
            video.remove()
        }
    }
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
    let lastNativeError
    if (typeof window.BarcodeDetector === 'function') {
        try {
            return await startNativeCamera({ containerId, onScan })
        } catch (error) {
            // Fall through to html5-qrcode if the native camera cannot start.
            lastNativeError = error
        }
    }
    const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode')
    const container = document.getElementById(containerId)
    if (container) {
        // An empty .org-reader is display:none, which would give the library a
        // zero-width container and a broken preview.
        container.style.display = 'block'
    }
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
            const video = document.querySelector(`#${containerId} video`)
            if (video) {
                styleVideo(video)
                await waitForVideoElement(video)
            }
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
    throw new Error(friendlyError(lastError || lastNativeError))
}

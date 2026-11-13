import { apiFetch } from './apiFetch'
let sdkPromise

export function getPushSDK() {
    if (sdkPromise) {
        return sdkPromise
    }

    sdkPromise = new Promise((resolve, reject) => {
        const appId = import.meta.env.VITE_ONESIGNAL_APP_ID?.trim()

        if (!appId) {
            reject(new Error('Notifications are not configured in this deployment. Set VITE_ONESIGNAL_APP_ID in the frontend build environment, then rebuild and redeploy.'))
            return
        }

        if (!window.isSecureContext) {
            reject(new Error('Notifications require HTTPS. Open the deployed HTTPS website; a phone accessing an HTTP local-network address cannot enable push.'))
            return
        }

        window.OneSignalDeferred = window.OneSignalDeferred || []

        const timeout = window.setTimeout(() => {
            reject(new Error(
                'OneSignal could not load. Check your connection or browser blocker, then reload.'
            ))
        }, 20000)

        window.OneSignalDeferred.push(async OneSignal => {
            try {
                await OneSignal.init({
                    appId,
                    allowLocalhostAsSecureOrigin: [
                        'localhost',
                        '127.0.0.1'
                    ].includes(window.location.hostname),
                    serviceWorkerPath: '/OneSignalSDKWorker.js',
                    notifyButton: {
                        enable: false
                    },
                    welcomeNotification: {
                        disable: true
                    },
                    autoResubscribe: false,
                    promptOptions: {
                        slidedown: {
                            prompts: [
                                {
                                    type: 'push',
                                    autoPrompt: false
                                }
                            ]
                        }
                    }
                })

                window.clearTimeout(timeout)
                resolve(OneSignal)
            } catch (error) {
                window.clearTimeout(timeout)
                reject(error)
            }
        })

        const script = document.createElement('script')
        script.src =
            'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js'
        script.defer = true
        script.onerror = () => {
            window.clearTimeout(timeout)
            reject(new Error('Unable to download the OneSignal SDK.'))
        }

        document.head.appendChild(script)
    })

    return sdkPromise
}

const pushPreferences = new Map()

function preferenceKey(identity) {
    return `fines-push-preference:${import.meta.env.VITE_ONESIGNAL_APP_ID}:${identity}`
}

function readPushPreference(identity) {
    if (!identity) return null
    const key = preferenceKey(identity)
    if (pushPreferences.has(key)) return pushPreferences.get(key)
    try {
        const saved = localStorage.getItem(key)
        if (saved === 'enabled' || saved === 'disabled') {
            return saved === 'enabled'
        }
    } catch { /* Keep notifications usable when browser storage is restricted. */ }
    return null
}

export function rememberPushPreference(sdk, enabled) {
    const identity = sdk.User.externalId
    if (!identity) throw new Error('Link your account before changing notifications.')
    const key = preferenceKey(identity)
    pushPreferences.set(key, enabled)
    try {
        localStorage.setItem(key, enabled ? 'enabled' : 'disabled')
    } catch { /* The preference remains available for this page session. */ }
}

function preserveExistingPreference(sdk) {
    if (sdk.User.externalId && readPushPreference(sdk.User.externalId) === null) {
        rememberPushPreference(sdk, Boolean(sdk.User.PushSubscription.optedIn))
    }
}

let identityQueue = Promise.resolve()
let identityVersion = 0

export function syncPushIdentity(accessToken, enabledPreference) {
    const version = ++identityVersion

    const operation = identityQueue.then(async () => {
        // Do not download the SDK for visitors who have never used it.
        if (!accessToken && !sdkPromise) {
            return
        }

        const sdk = await getPushSDK()

        if (version !== identityVersion) {
            return
        }

        if (!accessToken) {
            preserveExistingPreference(sdk)
            await sdk.User.PushSubscription.optOut()
            await sdk.logout()
            return
        }

        try {
            const response = await apiFetch('/api/student/push/identity', {
                headers: {
                    Accept: 'application/json',
                    Authorization: `Bearer ${accessToken}`
                },
                cache: 'no-store'
            })

            const result = await response.json()

            if (!response.ok || !result.success) {
                throw new Error(
                    result.error ||
                    result.message ||
                    'Unable to link push notifications to your account.'
                )
            }

            if (
                result.data.app_id !==
                import.meta.env.VITE_ONESIGNAL_APP_ID?.trim()
            ) {
                throw new Error(
                    'The frontend and backend OneSignal App IDs do not match.'
                )
            }

            if (version !== identityVersion) {
                return
            }

            const nextIdentity = result.data.external_id
            const previousIdentity = sdk.User.externalId

            preserveExistingPreference(sdk)

            // Each student has a separate preference on this browser.
            if (previousIdentity !== nextIdentity) {
                await sdk.User.PushSubscription.optOut()
                if (previousIdentity) await sdk.logout()
                await sdk.login(nextIdentity)
            }

            if (version !== identityVersion) return

            // Save explicit changes inside the identity queue so a background
            // token refresh cannot restore the old preference after a click.
            if (typeof enabledPreference === 'boolean') {
                rememberPushPreference(sdk, enabledPreference)
            }

            if (readPushPreference(nextIdentity) === true && sdk.Notifications.permission) {
                await sdk.User.PushSubscription.optIn()
            } else {
                await sdk.User.PushSubscription.optOut()
            }
        } catch (error) {
            // Stop account notifications if account linking fails.
            await sdk.User.PushSubscription.optOut()
            await sdk.logout()
            throw error
        }
    })

    // A failed request must not prevent later login/logout operations.
    identityQueue = operation.catch(() => {})

    return operation
}

export function isPushEnabled(sdk) {
    const subscription = sdk.User.PushSubscription
    return Boolean(sdk.Notifications.permission && subscription.optedIn &&
        subscription.id && subscription.token)
}

export async function withPushTimeout(operation, stage, timeoutMs = 20000) {
    let timeout
    try {
        return await Promise.race([
            operation(),
            new Promise((_, reject) => {
                timeout = window.setTimeout(() => {
                    const error = new Error(`${stage} timed out. Reload before trying again. If the console shows OneSignal 401 Unauthorized, ask the administrator to check OneSignal Settings > Keys & IDs > Identity Verification and the app configuration.`)
                    error.code = 'PUSH_TIMEOUT'
                    reject(error)
                }, timeoutMs)
            })
        ])
    } finally {
        window.clearTimeout(timeout)
    }
}

export function waitForPushSubscription(sdk, timeoutMs = 15000) {
    if (isPushEnabled(sdk)) return Promise.resolve()

    return new Promise((resolve, reject) => {
        const subscription = sdk.User.PushSubscription
        const finish = () => {
            if (!isPushEnabled(sdk)) return
            window.clearTimeout(timeout)
            subscription.removeEventListener('change', finish)
            resolve()
        }
        const timeout = window.setTimeout(() => {
            subscription.removeEventListener('change', finish)
            reject(new Error('Browser permission is allowed, but push registration did not finish. Reload and try Enable notifications again. If this continues, check the OneSignal Site URL and that /OneSignalSDKWorker.js is served as JavaScript on this website.'))
        }, timeoutMs)
        subscription.addEventListener('change', finish)
        finish()
    })
}

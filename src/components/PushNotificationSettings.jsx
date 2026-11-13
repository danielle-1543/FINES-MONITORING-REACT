import { useEffect, useState } from 'react'
import { getPushSDK, isPushEnabled, syncPushIdentity, waitForPushSubscription } from '../utils/pushNotifications'

export default function PushNotificationSettings({ accessToken }) {
    const [sdk, setSdk] = useState(null)
    const [enabled, setEnabled] = useState(false)
    const [permission, setPermission] = useState('unknown')
    const [busy, setBusy] = useState(true)
    const [error, setError] = useState('')
    const [message, setMessage] = useState('')

    useEffect(() => {
        let active = true
        let removeListeners = () => {}

        getPushSDK()
            .then(oneSignal => {
                if (!active) return

                if (!oneSignal.Notifications.isPushSupported()) {
                    throw new Error(
                        'Push notifications are unavailable in this browser. On iPhone or iPad, add this website to your Home Screen and open it from there.'
                    )
                }

                const update = () => {
                    if (!active) return
                    const nativePermission = window.Notification?.permission
                    setPermission(nativePermission || (oneSignal.Notifications.permission ? 'granted' : 'default'))
                    setEnabled(isPushEnabled(oneSignal))
                }

                oneSignal.User.PushSubscription.addEventListener(
                    'change',
                    update
                )
                oneSignal.Notifications.addEventListener(
                    'permissionChange',
                    update
                )
                window.addEventListener('focus', update)
                document.addEventListener('visibilitychange', update)

                removeListeners = () => {
                    window.removeEventListener('focus', update)
                    document.removeEventListener('visibilitychange', update)
                    oneSignal.User.PushSubscription.removeEventListener(
                        'change',
                        update
                    )
                    oneSignal.Notifications.removeEventListener(
                        'permissionChange',
                        update
                    )
                }

                setSdk(() => oneSignal)
                update()
                setBusy(false)
            })
            .catch(err => {
                if (!active) return
                setError(err.message)
                setBusy(false)
            })

        return () => {
            active = false
            removeListeners()
        }
    }, [])

    async function toggleNotifications() {
        if (!sdk) return

        setBusy(true)
        setError('')
        setMessage('')

        try {
            if (enabled) {
                await syncPushIdentity(accessToken, false)
                setEnabled(false)
                setMessage('Notifications are disabled on this browser.')
            } else {
                // This also registers a missing push token when permission was
                // already granted. optIn alone only toggles the opt-out flag.
                // Keep this before network requests to preserve the tap gesture.
                await sdk.Notifications.requestPermission()

                const currentPermission = window.Notification?.permission || (sdk.Notifications.permission ? 'granted' : 'default')
                setPermission(currentPermission)
                if (currentPermission !== 'granted') {
                    setMessage(currentPermission === 'denied'
                        ? `This browser blocks notifications for ${window.location.hostname}. Allow notifications for this exact website in browser site settings, then reload. The phone’s general notification switch is separate.`
                        : 'Permission has not been granted yet. Tap Enable notifications and accept the browser prompt. On iPhone/iPad, open the installed Home Screen app first.')
                    return
                }

                await syncPushIdentity(accessToken, true)
                await waitForPushSubscription(sdk)
                setEnabled(isPushEnabled(sdk))
                setMessage('Notifications are enabled on this browser.')
            }
        } catch (err) {
            setError(err.message || 'Unable to change notifications.')
        } finally {
            setBusy(false)
        }
    }

    return (
        <section className="student-panel">
            <h2>Push notifications</h2>

            <p>
                Choose whether this browser can receive notifications.
                You can keep using the system with notifications disabled.
            </p>

            <p>
                Status: <strong>{enabled ? 'Enabled' : 'Disabled'}</strong>
            </p>
            <p>
                Browser permission: <strong>{{ granted: 'Allowed', denied: 'Blocked', default: 'Not yet allowed', unknown: 'Checking' }[permission]}</strong>
                <br />Website: {window.location.hostname}
            </p>

            <button
                type="button"
                onClick={toggleNotifications}
                disabled={busy || !sdk}
            >
                {busy
                    ? 'Please wait…'
                    : enabled
                        ? 'Disable notifications'
                        : 'Enable notifications'}
            </button>

            {message && <p role="status">{message}</p>}
            {error && <p role="alert">{error}</p>}
        </section>
    )
    
}

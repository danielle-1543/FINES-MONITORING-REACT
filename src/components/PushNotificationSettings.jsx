import { useEffect, useState } from 'react'
import { getPushSDK, rememberPushPreference, syncPushIdentity } from '../utils/pushNotifications'

export default function PushNotificationSettings({ accessToken }) {
    const [sdk, setSdk] = useState(null)
    const [enabled, setEnabled] = useState(false)
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

                    setEnabled(Boolean(
                        oneSignal.Notifications.permission &&
                        oneSignal.User.PushSubscription.optedIn
                    ))
                }

                oneSignal.User.PushSubscription.addEventListener(
                    'change',
                    update
                )
                oneSignal.Notifications.addEventListener(
                    'permissionChange',
                    update
                )

                removeListeners = () => {
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
                await syncPushIdentity(accessToken)
                await sdk.User.PushSubscription.optOut()
                rememberPushPreference(sdk, false)
                setEnabled(false)
                setMessage('Notifications are disabled on this browser.')
            } else {
                await sdk.Notifications.requestPermission()

                if (!sdk.Notifications.permission) {
                    setMessage(
                        'Notifications were not allowed. If blocked, open the site permissions beside the browser address bar, allow notifications, and reload.'
                    )
                    return
                }

                await syncPushIdentity(accessToken)
                await sdk.User.PushSubscription.optIn()
                rememberPushPreference(sdk, true)
                setEnabled(Boolean(
                    sdk.User.PushSubscription.optedIn
                ))
                setMessage(
                    'Permission granted. The browser subscription may take a few seconds to finish.'
                )
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

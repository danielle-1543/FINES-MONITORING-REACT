import posthog from 'posthog-js'

const projectToken = import.meta.env.VITE_POSTHOG_KEY
const apiHost = import.meta.env.VITE_POSTHOG_HOST

const analyticsEnabled = Boolean(projectToken && apiHost)

function cleanUrl(value) {
    if (!value) return value

    try {
        const url = new URL(value)

        // Exclude query strings, fragments, and embedded credentials.
        return `${url.origin}${url.pathname}`
    } catch {
        return undefined
    }
}

if (analyticsEnabled) {
    posthog.init(projectToken, {
        api_host: apiHost,

        // Start with anonymous browser-level analytics.
        person_profiles: 'never',

        // Track portal pages explicitly because they use React state.
        capture_pageview: false,
        capture_pageleave: false,

        autocapture: false,
        disable_session_recording: true,

        before_send: event => {
            if (!event) return event

            const properties = event.properties || {}

            for (const key of [
                '$current_url',
                '$initial_current_url',
                '$referrer',
                '$initial_referrer'
            ]) {
                if (properties[key]) {
                    properties[key] = cleanUrl(properties[key])
                }
            }

            event.properties = properties

            return event
        }
    })
}

export function trackEvent(eventName, properties = {}) {
    if (!analyticsEnabled) return

    try {
        posthog.capture(eventName, {
            ...properties,
            environment:
                import.meta.env.VITE_POSTHOG_ENVIRONMENT ||
                import.meta.env.MODE
        })
    } catch {
        // Analytics must never interrupt application actions.
    }
}


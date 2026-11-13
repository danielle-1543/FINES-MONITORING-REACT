import { useEffect, useState } from 'react'
import { calendarMinimum } from '../utils/calendarDates'

export default function CalendarInput({ type = 'date', min, onChange, onFocus, ...props }) {
    const [now, setNow] = useState(() => new Date())
    useEffect(() => {
        const refresh = () => setNow(new Date())
        const timer = window.setInterval(refresh, 30000)
        window.addEventListener('focus', refresh)
        return () => {
            window.clearInterval(timer)
            window.removeEventListener('focus', refresh)
        }
    }, [])
    return <input {...props} type={type} min={calendarMinimum(type, min, now)}
        onFocus={event => {
            event.currentTarget.min = calendarMinimum(type, min)
            setNow(new Date())
            onFocus?.(event)
        }}
        onChange={event => {
            const input = event.currentTarget
            input.min = calendarMinimum(type, min)
            input.setCustomValidity('')
            if (input.value && input.value < input.min) {
                input.setCustomValidity('Choose today or a later date, within the allowed date range.')
                input.reportValidity()
                return
            }
            onChange?.(event)
        }} />
}

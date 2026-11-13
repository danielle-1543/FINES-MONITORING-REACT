
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import AppErrorBoundary from './components/AppErrorBoundary.jsx'
import AppErrorNotice from './components/AppErrorNotice.jsx'
import './theme.css'

import './config/posthog.js'

createRoot(document.getElementById('root')).render(
    <StrictMode>
        <AppErrorBoundary>
            <AppErrorNotice />
            <App />
        </AppErrorBoundary>
    </StrictMode>
)

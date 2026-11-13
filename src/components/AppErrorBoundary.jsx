import { Component } from 'react'

export default class AppErrorBoundary extends Component {
    state = { failed: false }

    static getDerivedStateFromError() {
        return { failed: true }
    }

    componentDidCatch(error, info) {
        console.error('Application render failed:', error, info.componentStack)
    }

    render() {
        if (this.state.failed) {
            return <main className="app-error-fallback" role="alert">
                <h1>This page could not be displayed</h1>
                <p>Reload to try again. If you were saving a payment or record, check its status before submitting it again.</p>
                <button type="button" onClick={() => window.location.reload()}>Reload page</button>
                <p>If this continues, contact the administrator with the page you were using and what happened.</p>
            </main>
        }
        return this.props.children
    }
}

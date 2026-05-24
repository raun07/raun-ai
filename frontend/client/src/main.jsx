import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import AppShell from './components/AppShell.jsx'
import ErrorFallback from './components/ErrorFallback.jsx'
import './index.css'

const sentryDsn = import.meta.env.VITE_SENTRY_DSN

async function bootstrap() {
  let content = <AppShell />

  if (sentryDsn) {
    try {
      const sentryModuleName = '@sentry/react'
      const Sentry = await import(/* @vite-ignore */ sentryModuleName)
      Sentry.init({
        dsn: sentryDsn,
        tracesSampleRate: 0.1,
      })
      content = (
        <Sentry.ErrorBoundary fallback={<ErrorFallback />}>
          <AppShell />
        </Sentry.ErrorBoundary>
      )
    } catch (error) {
      console.warn('Sentry frontend SDK unavailable, continuing without browser monitoring.', error)
    }
  }

  createRoot(document.getElementById('root')).render(
    <StrictMode>{content}</StrictMode>,
  )
}

bootstrap()

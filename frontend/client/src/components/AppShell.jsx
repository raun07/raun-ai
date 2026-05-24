import { ClerkProvider } from '@clerk/clerk-react'
import { BrowserRouter } from 'react-router-dom'
import App from '../AuthApp.jsx'
import MissingClerkConfig from './MissingClerkConfig.jsx'

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

// Initialise Sentry if a DSN is configured
const sentryDsn = import.meta.env.VITE_SENTRY_DSN
if (sentryDsn) {
  import('@sentry/react').then(({ init, browserTracingIntegration }) => {
    init({ dsn: sentryDsn, integrations: [browserTracingIntegration()], tracesSampleRate: 0.1 })
  }).catch(() => { /* sentry optional */ })
}

function AppShell() {
  return publishableKey ? (
    <ClerkProvider publishableKey={publishableKey} afterSignOutUrl="/login">
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ClerkProvider>
  ) : (
    <MissingClerkConfig />
  )
}

export default AppShell;
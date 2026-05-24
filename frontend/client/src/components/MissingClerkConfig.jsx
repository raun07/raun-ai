function MissingClerkConfig() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: '#09070c',
        color: '#fff',
        padding: '24px',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <div style={{ maxWidth: '540px', textAlign: 'center' }}>
        <h1>Clerk configuration missing</h1>
        <p>
          Add <code>VITE_CLERK_PUBLISHABLE_KEY</code> to <code>frontend/client/.env</code>
          {' '}or copy it from <code>.env.example</code>, then restart Vite.
        </p>
      </div>
    </div>
  )
}

export default MissingClerkConfig;
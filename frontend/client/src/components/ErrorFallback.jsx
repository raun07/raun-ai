function ErrorFallback() {
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
        <h1>Something went wrong</h1>
        <p>Please refresh the page. If the issue keeps happening, it has been captured for review.</p>
      </div>
    </div>
  )
}

export default ErrorFallback;
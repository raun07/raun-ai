export default function ProgressBar({ progress, statusMessage, status }) {
  return (
    <section className="status-card">
      <div className="status-head">
        <span className="status-tag">{status === "queued" ? "Queued" : status === "processing" ? "Processing" : status === "failed" ? "Failed" : "In progress"}</span>
        <span className="status-percent">{Math.min(Math.max(progress, 0), 100)}%</span>
      </div>
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }} />
      </div>
      <p className="progress-message">{statusMessage || "Waiting for updates..."}</p>
    </section>
  );
}

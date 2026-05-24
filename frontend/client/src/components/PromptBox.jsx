export default function PromptBox({ prompt, onPromptChange, onGenerate, disabled, isLoading }) {
  return (
    <section className="prompt-card">
      <label className="prompt-label" htmlFor="prompt">
        Describe your reel
      </label>
      <textarea
        id="prompt"
        className="prompt-field"
        rows="5"
        placeholder="Describe your reel..."
        value={prompt}
        onChange={(event) => onPromptChange(event.target.value)}
        disabled={disabled}
      />
      <div className="prompt-actions">
        <button
          className="primary-button"
          onClick={onGenerate}
          disabled={disabled}
          type="button"
        >
          {isLoading ? "Generating..." : "Generate Reel"}
        </button>
      </div>
      <p className="note-text">Use cinematic terms like “cinematic”, “epic”, “vibrant”, or “slow motion”.</p>
    </section>
  );
}

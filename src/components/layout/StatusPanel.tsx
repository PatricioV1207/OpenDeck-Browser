export function StatusPanel() {
  return (
    <footer className="status-panel" aria-label="Application status">
      <span className="status-panel__item">
        <span className="status-panel__indicator" aria-hidden="true" />
        UI shell ready
      </span>
      <span className="status-panel__divider" aria-hidden="true" />
      <span className="status-panel__item">No native commands</span>
    </footer>
  );
}

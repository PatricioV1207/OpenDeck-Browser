export function TopBar() {
  return (
    <header className="top-bar">
      <div className="top-bar__identity">
        <span className="top-bar__title">OpenDeck Browser</span>
        <span className="top-bar__build">Foundation build</span>
      </div>
      <div className="top-bar__local-status">
        <span className="top-bar__status-dot" aria-hidden="true" />
        <span>Local only</span>
      </div>
    </header>
  );
}

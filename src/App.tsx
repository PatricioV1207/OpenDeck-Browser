import "./App.css";

function App() {
  return (
    <main className="foundation">
      <section className="foundation__panel" aria-labelledby="foundation-title">
        <p className="foundation__product">OpenDeck Browser</p>
        <p className="foundation__label">Foundation build</p>
        <h1 id="foundation-title">
          A secure starting point for maintainer workflows.
        </h1>
        <p className="foundation__summary">
          This build establishes the minimal Tauri 2, React, TypeScript, and
          Rust application foundation.
        </p>
        <div className="foundation__status" role="status">
          <span>Current status</span>
          <strong>Ready for focused feature work</strong>
        </div>
        <p className="foundation__note">
          Workspace, settings, tabs, GitHub, and AI features are not enabled in
          this foundation build.
        </p>
      </section>
    </main>
  );
}

export default App;

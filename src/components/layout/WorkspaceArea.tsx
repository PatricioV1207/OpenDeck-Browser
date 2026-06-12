export function WorkspaceArea() {
  return (
    <main className="workspace">
      <div className="workspace__tab-placeholder">
        <span className="workspace__tab-mark" aria-hidden="true" />
        <span>Future tab area</span>
        <span className="workspace__tab-note">No tabs are active</span>
      </div>

      <section className="workspace__content" aria-labelledby="workspace-title">
        <p className="workspace__eyebrow">Application shell</p>
        <h1 id="workspace-title">The main layout foundation is ready.</h1>
        <p className="workspace__summary">
          The sidebar, top bar, workspace, future tab area, and status panel are
          now separated into small layout components.
        </p>

        <div className="workspace__readiness" aria-label="Foundation status">
          <div>
            <span>UI boundary</span>
            <strong>Static and local</strong>
          </div>
          <div>
            <span>Native access</span>
            <strong>Not enabled</strong>
          </div>
          <div>
            <span>Feature state</span>
            <strong>Not implemented</strong>
          </div>
        </div>

        <p className="workspace__note">
          Workspaces, settings, tabs, GitHub, and AI remain deferred to focused
          implementation steps.
        </p>
      </section>
    </main>
  );
}

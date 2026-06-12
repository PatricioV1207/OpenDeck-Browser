const plannedViews = [
  { initial: "H", label: "Home" },
  { initial: "P", label: "Projects" },
  { initial: "S", label: "Settings" },
  { initial: "A", label: "About" },
];

export function Sidebar() {
  return (
    <aside className="sidebar" aria-label="OpenDeck Browser sidebar">
      <div className="sidebar__brand">
        <span className="sidebar__brand-mark" aria-hidden="true">
          OD
        </span>
        <span className="sidebar__brand-name">OpenDeck Browser</span>
      </div>

      <section
        className="sidebar__navigation"
        aria-labelledby="planned-views-title"
      >
        <p className="sidebar__section-label" id="planned-views-title">
          Planned views
        </p>
        <ul className="sidebar__items">
          {plannedViews.map((view) => (
            <li className="sidebar__item" key={view.label}>
              <span className="sidebar__item-mark" aria-hidden="true">
                {view.initial}
              </span>
              <span className="sidebar__item-label">{view.label}</span>
            </li>
          ))}
        </ul>
      </section>

      <p className="sidebar__note">Navigation is not enabled in this build.</p>
    </aside>
  );
}

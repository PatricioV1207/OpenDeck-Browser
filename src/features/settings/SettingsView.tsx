import { StatusBadge } from "../../components/ui/StatusBadge";
import { ViewHeader } from "../../components/ui/ViewHeader";
import { ViewSection } from "../../components/ui/ViewSection";
import { useAppData } from "../../state/AppDataProvider";
import {
  createSettingsPresentation,
  type SettingsPresentation,
} from "./settingsPresentation";

const securityBoundaries = [
  {
    name: "Credential storage",
    detail: "No GitHub, AI, or other provider credentials are requested or stored.",
  },
  {
    name: "Remote data sharing",
    detail: "No repository content or application data is sent to remote services.",
  },
];

export function SettingsView() {
  const appData = useAppData();
  const presentation = createSettingsPresentation(appData);

  return (
    <div className="internal-view">
      <ViewHeader
        eyebrow="Settings"
        title="Preferences will stay explicit, local, and reviewable."
        summary="Settings reads non-sensitive stored preferences from the validated in-memory app-data snapshot without applying or changing them."
        status="Read-only view"
      />

      <SettingsContent presentation={presentation} />

      <ViewSection
        title="Privacy and security"
        intro="Sensitive integrations remain disabled by default."
      >
        <dl className="settings-list">
          {securityBoundaries.map((boundary) => (
            <div className="settings-list__row" key={boundary.name}>
              <dt>{boundary.name}</dt>
              <dd className="settings-list__description">{boundary.detail}</dd>
              <dd className="settings-list__aside">
                <StatusBadge tone="protected">Protected by default</StatusBadge>
              </dd>
            </div>
          ))}
        </dl>
      </ViewSection>

      <p className="view-disclaimer">
        Stored preferences are read-only. Editing and application remain
        deferred to separately approved implementation steps.
      </p>
    </div>
  );
}

function SettingsContent({
  presentation,
}: {
  presentation: SettingsPresentation;
}) {
  if (presentation.status === "loading") {
    return (
      <section
        className="empty-state settings-state"
        aria-labelledby="settings-loading-title"
        aria-busy="true"
      >
        <StatusBadge tone="foundation">Loading</StatusBadge>
        <h2 id="settings-loading-title">Loading stored preferences</h2>
        <p>Non-sensitive settings are being loaded from local app data.</p>
      </section>
    );
  }

  if (presentation.status === "error") {
    return (
      <section
        className="empty-state settings-state"
        aria-labelledby="settings-error-title"
      >
        <StatusBadge tone="protected">Unavailable</StatusBadge>
        <h2 id="settings-error-title">Stored preferences are unavailable</h2>
        <p>{presentation.message}</p>
      </section>
    );
  }

  return (
    <ViewSection
      title="Stored preferences"
      intro="These values are loaded from app data but are not applied by the interface yet."
    >
      <dl className="settings-list settings-list--stored">
        {presentation.rows.map((row) => (
          <div className="settings-list__row" key={row.id}>
            <dt>{row.name}</dt>
            <dd className="settings-list__description">{row.description}</dd>
            <dd className="settings-value">{row.value}</dd>
          </div>
        ))}
      </dl>
    </ViewSection>
  );
}

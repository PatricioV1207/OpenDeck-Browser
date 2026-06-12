import { StatusBadge } from "../../components/ui/StatusBadge";
import { ViewHeader } from "../../components/ui/ViewHeader";
import { ViewSection } from "../../components/ui/ViewSection";

const settingSections = [
  {
    title: "Appearance",
    description:
      "Future options will cover color mode and the way the sidebar is presented.",
    items: [
      {
        name: "Color mode",
        detail: "System, light, and dark preferences will be considered later.",
        status: "Not available yet",
        tone: "planned" as const,
      },
      {
        name: "Sidebar presentation",
        detail:
          "The compact rail is responsive today; a saved preference is not implemented.",
        status: "Not available yet",
        tone: "planned" as const,
      },
    ],
  },
  {
    title: "Workspace behavior",
    description:
      "Workspace state does not exist yet, so startup and selection preferences are descriptive only.",
    items: [
      {
        name: "Active workspace",
        detail:
          "A future workspace model may remember a selected metadata-only project.",
        status: "Not available yet",
        tone: "planned" as const,
      },
      {
        name: "Startup behavior",
        detail:
          "The application currently starts with Home as the only open tab.",
        status: "Not available yet",
        tone: "planned" as const,
      },
    ],
  },
  {
    title: "Privacy and security",
    description:
      "The current foundation keeps sensitive integrations disabled by default.",
    items: [
      {
        name: "Credential storage",
        detail:
          "No GitHub, AI, or other provider credentials are requested or stored.",
        status: "Protected by default",
        tone: "protected" as const,
      },
      {
        name: "Remote data sharing",
        detail:
          "No repository content or application data is sent to remote services.",
        status: "Protected by default",
        tone: "protected" as const,
      },
    ],
  },
];

export function SettingsView() {
  return (
    <div className="internal-view">
      <ViewHeader
        eyebrow="Settings"
        title="Preferences will stay explicit, local, and reviewable."
        summary="This view previews the categories OpenDeck Browser expects to support. Nothing here is interactive or persisted in the foundation build."
        status="Placeholder view"
      />

      {settingSections.map((section) => (
        <ViewSection
          title={section.title}
          intro={section.description}
          key={section.title}
        >
          <dl className="settings-list">
            {section.items.map((item) => (
              <div className="settings-list__row" key={item.name}>
                <div>
                  <dt>{item.name}</dt>
                  <dd>{item.detail}</dd>
                </div>
                <StatusBadge tone={item.tone}>{item.status}</StatusBadge>
              </div>
            ))}
          </dl>
        </ViewSection>
      ))}

      <p className="view-disclaimer">
        No preferences are editable or saved in this version.
      </p>
    </div>
  );
}

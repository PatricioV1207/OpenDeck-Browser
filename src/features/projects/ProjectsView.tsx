import { InfoCard } from "../../components/ui/InfoCard";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { ViewHeader } from "../../components/ui/ViewHeader";
import { ViewSection } from "../../components/ui/ViewSection";

export function ProjectsView() {
  return (
    <div className="internal-view">
      <ViewHeader
        eyebrow="Projects"
        title="Organize maintainer context without broad local access."
        summary="Projects will begin as metadata-only workspace records. They will identify the work a maintainer cares about without scanning directories or executing repository code."
        status="Placeholder view"
      />

      <section
        className="empty-state"
        aria-labelledby="projects-empty-title"
      >
        <StatusBadge tone="planned">Not implemented yet</StatusBadge>
        <h2 id="projects-empty-title">No projects yet</h2>
        <p>
          Project creation and selection will arrive in a focused workspace
          implementation step. This view does not store or discover anything.
        </p>
      </section>

      <ViewSection
        title="Planned workspace boundaries"
        intro="The first project model will stay intentionally narrow and reviewable."
      >
        <div className="view-card-grid view-card-grid--three">
          <InfoCard title="Local metadata" status="Planned">
            <p>
              Store a project name and local workspace identity without
              credentials or private repository content.
            </p>
          </InfoCard>
          <InfoCard title="Repository references" status="Later">
            <p>
              Associate GitHub repositories only after authentication,
              credential storage, and read-only API boundaries are approved.
            </p>
          </InfoCard>
          <InfoCard title="Directory access" status="Not included" tone="protected">
            <p>
              Metadata-only workspaces will not require selecting or reading a
              local project directory in the initial model.
            </p>
          </InfoCard>
        </div>
      </ViewSection>

      <dl className="view-status-list" aria-label="Projects implementation status">
        <div>
          <dt>Workspace creation and editing</dt>
          <dd>Planned</dd>
        </div>
        <div>
          <dt>Repository connection</dt>
          <dd>Planned for a later secure integration</dd>
        </div>
        <div>
          <dt>Persistence</dt>
          <dd>Not enabled</dd>
        </div>
      </dl>
    </div>
  );
}

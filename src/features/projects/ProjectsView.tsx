import { InfoCard } from "../../components/ui/InfoCard";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { ViewHeader } from "../../components/ui/ViewHeader";
import { ViewSection } from "../../components/ui/ViewSection";
import { useAppData } from "../../state/AppDataProvider";
import {
  createProjectsPresentation,
  type ProjectsTimestampPresentation,
  type WorkspacePresentation,
} from "./projectsPresentation";

export function ProjectsView() {
  const appData = useAppData();
  const presentation = createProjectsPresentation(appData);

  return (
    <div className="internal-view">
      <ViewHeader
        eyebrow="Projects"
        title="Organize maintainer context without broad local access."
        summary="Projects reads metadata-only workspace records from the validated in-memory app-data snapshot without scanning directories or executing repository code."
        status="Read-only view"
      />

      <ProjectsContent presentation={presentation} />

      <ViewSection
        title="Workspace boundaries"
        intro="The current metadata model stays intentionally narrow and reviewable."
      >
        <div className="view-card-grid view-card-grid--three">
          <InfoCard title="Local metadata" status="Available" tone="ready">
            <p>
              Read a workspace name, local identity, timestamps, and active
              marker without credentials or private repository content.
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
          <dd>Read through AppDataProvider; mutations remain disconnected</dd>
        </div>
      </dl>
    </div>
  );
}

interface ProjectsContentProps {
  presentation: ReturnType<typeof createProjectsPresentation>;
}

function ProjectsContent({ presentation }: ProjectsContentProps) {
  if (presentation.status === "loading") {
    return (
      <section
        className="empty-state projects-state"
        aria-labelledby="projects-loading-title"
        aria-busy="true"
      >
        <StatusBadge tone="foundation">Loading</StatusBadge>
        <h2 id="projects-loading-title">Loading workspaces</h2>
        <p>Workspace metadata is being loaded from local app data.</p>
      </section>
    );
  }

  if (presentation.status === "error") {
    return (
      <section
        className="empty-state projects-state"
        aria-labelledby="projects-error-title"
      >
        <StatusBadge tone="protected">Unavailable</StatusBadge>
        <h2 id="projects-error-title">Workspace data is unavailable</h2>
        <p>{presentation.message}</p>
      </section>
    );
  }

  if (presentation.status === "empty") {
    return (
      <section
        className="empty-state projects-state"
        aria-labelledby="projects-empty-title"
      >
        <StatusBadge tone="planned">No saved metadata</StatusBadge>
        <h2 id="projects-empty-title">No workspaces yet</h2>
        <p>
          Workspace creation remains deferred. This read-only view will list
          metadata after workspaces are created through a future approved
          interface.
        </p>
      </section>
    );
  }

  return (
    <ViewSection
      title={presentation.countLabel}
      intro="Saved metadata is shown in canonical storage order."
    >
      <ul className="workspace-card-list" aria-label="Saved workspaces">
        {presentation.workspaces.map((workspace) => (
          <WorkspaceCard workspace={workspace} key={workspace.id} />
        ))}
      </ul>
    </ViewSection>
  );
}

function WorkspaceCard({ workspace }: { workspace: WorkspacePresentation }) {
  const titleId = `workspace-title-${workspace.id}`;

  return (
    <li className="workspace-card-list__item">
      <article className="workspace-card" aria-labelledby={titleId}>
        <div className="workspace-card__header">
          <h3 id={titleId}>{workspace.name}</h3>
          {workspace.isActive && <StatusBadge tone="ready">Active</StatusBadge>}
        </div>
        <dl className="workspace-card__details">
          <div>
            <dt>Workspace ID</dt>
            <dd>
              <code>{workspace.id}</code>
            </dd>
          </div>
          <div>
            <dt>Created</dt>
            <dd>
              <WorkspaceTime timestamp={workspace.createdAt} />
            </dd>
          </div>
          <div>
            <dt>Updated</dt>
            <dd>
              <WorkspaceTime timestamp={workspace.updatedAt} />
            </dd>
          </div>
        </dl>
      </article>
    </li>
  );
}

function WorkspaceTime({
  timestamp,
}: {
  timestamp: ProjectsTimestampPresentation;
}) {
  if (timestamp.dateTime === null) {
    return <span>{timestamp.label}</span>;
  }

  return <time dateTime={timestamp.dateTime}>{timestamp.label}</time>;
}

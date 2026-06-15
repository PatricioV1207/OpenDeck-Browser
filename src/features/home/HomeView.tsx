import { InfoCard } from "../../components/ui/InfoCard";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { ViewHeader } from "../../components/ui/ViewHeader";
import { ViewSection } from "../../components/ui/ViewSection";
import { useAppData } from "../../state/AppDataProvider";
import {
  createHomePresentation,
  type HomePresentation,
} from "./homePresentation";

export function HomeView() {
  const appData = useAppData();
  const presentation = createHomePresentation(appData);

  return (
    <div className="internal-view">
      <ViewHeader
        eyebrow="Home"
        title="A local-first workspace for maintainer workflows."
        summary="Home presents a safe summary of the validated local app-data snapshot while maintainer workflows remain intentionally read-only."
        status="Read-only view"
      />

      <HomeSummaryContent presentation={presentation} />

      <ViewSection
        title="Planned maintainer workflows"
        intro="These product areas describe the intended direction. They are not functional yet."
      >
        <div className="view-card-grid view-card-grid--two">
          <InfoCard title="Project organization" status="Planned">
            <p>
              Keep lightweight project references and workspace context
              available without granting broad filesystem access.
            </p>
          </InfoCard>
          <InfoCard title="Review and triage" status="Planned">
            <p>
              Bring issues and pull requests into a focused, read-only
              maintainer workflow before any write actions are considered.
            </p>
          </InfoCard>
          <InfoCard title="Documentation awareness" status="Planned">
            <p>
              Make project guidance, contribution information, and release
              context easier to locate and understand.
            </p>
          </InfoCard>
          <InfoCard title="Security visibility" status="Planned">
            <p>
              Keep credentials, private content, dependency risk, and external
              actions inside explicit security boundaries.
            </p>
          </InfoCard>
        </div>
      </ViewSection>

      <p className="view-disclaimer">
        Workspace rename, deletion, manual active selection, settings editing,
        and stored-setting application remain deferred to separately approved
        implementation steps.
      </p>
    </div>
  );
}

function HomeSummaryContent({
  presentation,
}: {
  presentation: HomePresentation;
}) {
  if (presentation.status === "loading") {
    return (
      <section
        className="empty-state home-state"
        aria-labelledby="home-loading-title"
        aria-busy="true"
      >
        <StatusBadge tone="foundation">Loading</StatusBadge>
        <h2 id="home-loading-title">Loading app-data summary</h2>
        <p>
          Non-sensitive workspace and settings metadata is being loaded from
          local app data.
        </p>
      </section>
    );
  }

  if (presentation.status === "error") {
    return (
      <section
        className="empty-state home-state"
        aria-labelledby="home-error-title"
      >
        <StatusBadge tone="protected">Unavailable</StatusBadge>
        <h2 id="home-error-title">App-data summary is unavailable</h2>
        <p>{presentation.message}</p>
      </section>
    );
  }

  return (
    <ViewSection
      title="Local app-data summary"
      intro="These values come from the validated in-memory snapshot and are shown without mutation controls."
    >
      <div className="view-card-grid view-card-grid--two">
        <InfoCard title="Workspaces" status="Read-only" tone="ready">
          <p className="home-summary__value">
            {presentation.summary.workspaceCount}
          </p>
        </InfoCard>
        <InfoCard title="Active workspace" status="Selection" tone="ready">
          <p className="home-summary__value">
            {presentation.summary.activeWorkspaceName}
          </p>
        </InfoCard>
        <InfoCard title="Stored color mode" status="Not applied">
          <p className="home-summary__value">
            {presentation.summary.colorMode}
          </p>
        </InfoCard>
        <InfoCard title="Local app data" status="Ready" tone="ready">
          <p className="home-summary__value">
            {presentation.summary.appDataStatus}
          </p>
        </InfoCard>
      </div>
    </ViewSection>
  );
}

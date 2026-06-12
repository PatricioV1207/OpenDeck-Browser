import { InfoCard } from "../../components/ui/InfoCard";
import { ViewHeader } from "../../components/ui/ViewHeader";
import { ViewSection } from "../../components/ui/ViewSection";

export function HomeView() {
  return (
    <div className="internal-view">
      <ViewHeader
        eyebrow="Home"
        title="A local-first workspace for maintainer workflows."
        summary="OpenDeck Browser is being built to help open-source maintainers organize projects, review work, understand documentation, and keep security concerns visible from one desktop workspace."
        status="Foundation build"
      />

      <ViewSection
        title="Foundation status"
        intro="The application foundation is deliberately small while its security and ownership boundaries are established."
      >
        <div className="view-card-grid view-card-grid--three">
          <InfoCard title="Application shell" status="Ready" tone="ready">
            <p>
              The sidebar, top bar, workspace, tab strip, and status area are
              separated into focused frontend components.
            </p>
          </InfoCard>
          <InfoCard title="Singleton tabs" status="Ready" tone="ready">
            <p>
              Internal tabs run in memory, remain unique, and reset whenever
              the application restarts.
            </p>
          </InfoCard>
          <InfoCard
            title="Native integrations"
            status="Not enabled"
            tone="protected"
          >
            <p>
              No application commands, credentials, filesystem access, or
              remote services are active in this build.
            </p>
          </InfoCard>
        </div>
      </ViewSection>

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
        Product workflows and live project data are not implemented in this
        foundation view.
      </p>
    </div>
  );
}

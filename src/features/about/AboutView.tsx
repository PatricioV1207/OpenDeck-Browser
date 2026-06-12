import { InfoCard } from "../../components/ui/InfoCard";
import { ViewHeader } from "../../components/ui/ViewHeader";
import { ViewSection } from "../../components/ui/ViewSection";

const technologyFoundation = ["Tauri", "React", "TypeScript", "Rust"];

export function AboutView() {
  return (
    <div className="internal-view">
      <ViewHeader
        eyebrow="About"
        title="A command deck for the people who maintain open source."
        summary="OpenDeck Browser aims to reduce context switching across repositories, issues, pull requests, documentation, releases, and security workflows."
        status="Foundation build"
      />

      <ViewSection
        title="Project approach"
        intro="The product is being designed around maintainer judgment rather than hidden automation."
      >
        <div className="view-card-grid view-card-grid--two">
          <InfoCard title="Local-first" status="Foundation">
            <p>
              Core workspace state should remain on the user&apos;s device
              unless a later feature requires an explicit remote action.
            </p>
          </InfoCard>
          <InfoCard title="Human-approved" status="Foundation">
            <p>
              Future GitHub and AI workflows must remain visible, intentional,
              and subject to maintainer confirmation.
            </p>
          </InfoCard>
        </div>
      </ViewSection>

      <ViewSection
        title="Current status"
        intro="The repository is establishing the product surface in small, reviewable steps."
      >
        <dl className="view-status-list">
          <div>
            <dt>Current stage</dt>
            <dd>Foundation build</dd>
          </div>
          <div>
            <dt>First public release target</dt>
            <dd>v0.1.0-alpha</dd>
          </div>
          <div>
            <dt>Native application commands</dt>
            <dd>None enabled</dd>
          </div>
        </dl>
      </ViewSection>

      <ViewSection
        title="Technology foundation"
        intro="The approved stack separates the desktop shell, interface, types, and future native services."
      >
        <ul className="technology-list">
          {technologyFoundation.map((technology) => (
            <li key={technology}>{technology}</li>
          ))}
        </ul>
      </ViewSection>

      <p className="view-disclaimer">
        OpenDeck Browser is still an early foundation and is not ready for
        production maintainer workflows.
      </p>
    </div>
  );
}

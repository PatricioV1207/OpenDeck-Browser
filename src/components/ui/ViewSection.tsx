import type { ReactNode } from "react";

interface ViewSectionProps {
  title: string;
  intro?: string;
  children: ReactNode;
}

function sectionId(title: string) {
  return `section-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

export function ViewSection({ title, intro, children }: ViewSectionProps) {
  const headingId = sectionId(title);

  return (
    <section className="view-section" aria-labelledby={headingId}>
      <div className="view-section__header">
        <h2 id={headingId}>{title}</h2>
        {intro && <p>{intro}</p>}
      </div>
      {children}
    </section>
  );
}

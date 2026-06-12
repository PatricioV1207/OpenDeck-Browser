import { StatusBadge } from "./StatusBadge";

interface ViewHeaderProps {
  eyebrow: string;
  title: string;
  summary: string;
  status: string;
}

export function ViewHeader({
  eyebrow,
  title,
  summary,
  status,
}: ViewHeaderProps) {
  return (
    <header className="view-header">
      <div className="view-header__meta">
        <p className="view-header__eyebrow">{eyebrow}</p>
        <StatusBadge tone="foundation">{status}</StatusBadge>
      </div>
      <h1>{title}</h1>
      <p className="view-header__summary">{summary}</p>
    </header>
  );
}

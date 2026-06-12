import type { ReactNode } from "react";
import { StatusBadge } from "./StatusBadge";

interface InfoCardProps {
  title: string;
  status: string;
  children: ReactNode;
  tone?: "foundation" | "ready" | "planned" | "protected";
}

export function InfoCard({
  title,
  status,
  children,
  tone = "planned",
}: InfoCardProps) {
  return (
    <article className="info-card">
      <div className="info-card__header">
        <h3>{title}</h3>
        <StatusBadge tone={tone}>{status}</StatusBadge>
      </div>
      <div className="info-card__body">{children}</div>
    </article>
  );
}

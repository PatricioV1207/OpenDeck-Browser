import type { ReactNode } from "react";

type StatusTone = "foundation" | "ready" | "planned" | "protected";

interface StatusBadgeProps {
  children: ReactNode;
  tone?: StatusTone;
}

export function StatusBadge({
  children,
  tone = "planned",
}: StatusBadgeProps) {
  return (
    <span className="status-badge" data-tone={tone}>
      {children}
    </span>
  );
}

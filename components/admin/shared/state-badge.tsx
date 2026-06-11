import type { ReactNode } from 'react';

export type BadgeKind = 'success' | 'danger' | 'warn' | 'info' | 'violet' | 'cyan' | 'neutral';

interface Props {
  kind: BadgeKind;
  dot?: boolean;
  children: ReactNode;
}

export function StateBadge({ kind, dot, children }: Props) {
  return (
    <span className={`badge badge-${kind}`}>
      {dot && <span className="dot" />}
      {children}
    </span>
  );
}

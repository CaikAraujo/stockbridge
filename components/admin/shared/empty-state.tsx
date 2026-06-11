import type { ComponentType, ReactNode } from 'react';

interface Props {
  icon: ComponentType<{ size?: number; className?: string }>;
  title: string;
  sub?: string;
  action?: ReactNode;
}

export function EmptyState({ icon: Icon, title, sub, action }: Props) {
  return (
    <div className="empty">
      <div className="empty-ic">
        <Icon size={24} />
      </div>
      <h4>{title}</h4>
      {sub && <p>{sub}</p>}
      {action && <div style={{ marginTop: 14 }}>{action}</div>}
    </div>
  );
}

interface Props {
  value: number;
  max: number;
  color?: string;
}

export function MiniBar({ value, max, color = 'var(--primary)' }: Props) {
  const pct = Math.min(100, (value / (max || 1)) * 100);
  return (
    <div
      style={{
        height: 6,
        borderRadius: 99,
        background: 'var(--surface-2)',
        boxShadow: 'inset 0 0 0 1px var(--border-soft)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: `${pct}%`,
          height: '100%',
          borderRadius: 99,
          background: color,
          transition: 'width .5s cubic-bezier(.22,.8,.36,1)',
        }}
      />
    </div>
  );
}

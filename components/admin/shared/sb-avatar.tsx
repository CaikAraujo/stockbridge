const AVATAR_HUES = [256, 200, 155, 75, 295, 25];

interface Props {
  name: string;
  size?: number;
}

export function SbAvatar({ name, size = 32 }: Props) {
  const h = AVATAR_HUES[(name || '?').charCodeAt(0) % AVATAR_HUES.length];
  const initials = (name || '?')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '32%',
        flexShrink: 0,
        display: 'grid',
        placeItems: 'center',
        background: `oklch(0.93 0.04 ${h})`,
        color: `oklch(0.45 0.13 ${h})`,
        fontSize: size * 0.36,
        fontWeight: 800,
        letterSpacing: '0.02em',
      }}
    >
      {initials}
    </div>
  );
}

'use client';

import { useId } from 'react';

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}

export function Sparkline({ data, width = 90, height = 30, color = 'var(--primary)' }: SparklineProps) {
  const id = useId();
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);

  const pts = data.map((v, i) => {
    const x = (i / Math.max(data.length - 1, 1)) * (width - 4) + 2;
    const y = height - 3 - ((v - min) / (max - min || 1)) * (height - 8);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });

  return (
    <svg
      width={width}
      height={height}
      style={{ display: 'block', flexShrink: 0 }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.25" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        points={`2,${height} ${pts.join(' ')} ${width - 2},${height}`}
        fill={`url(#${id})`}
      />
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

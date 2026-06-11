'use client';

import { useRef } from 'react';

interface Props {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}

export function Sparkline({ data, width = 90, height = 30, color = 'var(--primary)' }: Props) {
  // stable id per instance – avoids hydration mismatch
  const idRef = useRef<string | null>(null);
  if (!idRef.current) {
    idRef.current = 'sp' + Math.random().toString(36).slice(2, 8);
  }
  const id = idRef.current;

  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * (width - 4) + 2;
    const y = height - 3 - ((v - min) / (max - min || 1)) * (height - 8);
    return `${x},${y}`;
  });

  return (
    <svg width={width} height={height} style={{ display: 'block' }} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.25" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`2,${height} ${pts.join(' ')} ${width - 2},${height}`} fill={`url(#${id})`} />
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

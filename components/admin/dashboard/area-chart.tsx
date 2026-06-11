'use client';

import { useEffect, useId, useRef, useState } from 'react';

interface Series {
  label: string;
  data: number[];
  color: string;
}

interface AreaChartProps {
  series: Series[];
  labels: string[];
  height?: number;
}

export function AreaChart({ series, labels, height = 190 }: AreaChartProps) {
  const wrapRef          = useRef<HTMLDivElement>(null);
  const [w, setW]        = useState(620);
  const gradId           = useId();

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setW(Math.max(220, e.contentRect.width));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const padL = 32, padR = 8, padT = 12, padB = 24;
  const allValues = series.flatMap((s) => s.data);
  const maxVal    = Math.ceil(Math.max(...allValues, 4) / 4) * 4;
  const n         = series[0]?.data.length ?? 1;

  const X = (i: number) => padL + (i / Math.max(n - 1, 1)) * (w - padL - padR);
  const Y = (v: number) => padT + (1 - v / maxVal) * (height - padT - padB);

  const gridFractions = [0, 0.25, 0.5, 0.75, 1] as const;

  return (
    <div style={{ width: '100%' }} ref={wrapRef}>
      <svg width={w} height={height} style={{ display: 'block' }} aria-hidden="true">
        <defs>
          {series.map((s, si) => (
            <linearGradient key={si} id={`${gradId}-${si}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={s.color} stopOpacity="0.22" />
              <stop offset="1" stopColor={s.color} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>

        {/* Grid lines */}
        {gridFractions.map((f) => (
          <g key={f}>
            <line
              x1={padL} x2={w - padR}
              y1={Y(maxVal * f)} y2={Y(maxVal * f)}
              stroke="var(--border-soft)"
              strokeDasharray={f === 0 ? undefined : '3 4'}
            />
            <text
              x={padL - 5} y={Y(maxVal * f) + 3.5}
              textAnchor="end"
              fontSize={10}
              fill="var(--faint)"
              fontFamily="var(--font-code)"
            >
              {Math.round(maxVal * f)}
            </text>
          </g>
        ))}

        {/* Series areas + lines + dots */}
        {series.map((s, si) => {
          const pts = s.data.map((v, i) => `${X(i).toFixed(2)},${Y(v).toFixed(2)}`);
          return (
            <g key={si}>
              <polygon
                points={`${X(0).toFixed(2)},${Y(0).toFixed(2)} ${pts.join(' ')} ${X(n - 1).toFixed(2)},${Y(0).toFixed(2)}`}
                fill={`url(#${gradId}-${si})`}
              />
              <polyline
                points={pts.join(' ')}
                fill="none"
                stroke={s.color}
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {s.data.map((v, i) => (
                <circle
                  key={i}
                  cx={X(i)}
                  cy={Y(v)}
                  r={2.4}
                  fill="var(--surface)"
                  stroke={s.color}
                  strokeWidth="1.8"
                />
              ))}
            </g>
          );
        })}

        {/* X-axis labels — skip odd labels if ≥ 9 points */}
        {labels.map((l, i) => {
          if (n > 8 && i % 2 === 1) return null;
          return (
            <text
              key={i}
              x={X(i)}
              y={height - 7}
              textAnchor="middle"
              fontSize={10}
              fill="var(--faint)"
              fontFamily="var(--font-code)"
            >
              {l}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

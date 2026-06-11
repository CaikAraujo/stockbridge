'use client';

import { useShell } from './shell-context';

export function HamburgerButton() {
  const { openDrawer } = useShell();
  return (
    <button
      type="button"
      className="tb-btn tb-hamburger"
      onClick={openDrawer}
      aria-label="Abrir menu"
    >
      <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true">
        <path d="M4 7h16M4 12h16M4 17h16" />
      </svg>
    </button>
  );
}

export function RailToggleButton() {
  const { toggleRail } = useShell();
  return (
    <button
      type="button"
      className="tb-btn sb-collapse-btn"
      onClick={toggleRail}
      aria-label="Alternar menu lateral"
    >
      <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="4" width="18" height="16" rx="2.5" />
        <path d="M9.5 4v16" />
      </svg>
    </button>
  );
}

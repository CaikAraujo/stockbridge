'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

type ShellCtx = {
  rail: boolean;
  drawerOpen: boolean;
  toggleRail: () => void;
  openDrawer: () => void;
  closeDrawer: () => void;
};

const ShellContext = createContext<ShellCtx>({
  rail: false,
  drawerOpen: false,
  toggleRail: () => {},
  openDrawer: () => {},
  closeDrawer: () => {},
});

export function ShellProvider({ children }: { children: React.ReactNode }) {
  const [rail, setRail] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (localStorage.getItem('sb-rail') === 'true') setRail(true);
  }, []);

  const toggleRail = useCallback(() => {
    setRail((prev) => {
      const next = !prev;
      localStorage.setItem('sb-rail', String(next));
      return next;
    });
  }, []);

  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  return (
    <ShellContext.Provider value={{ rail, drawerOpen, toggleRail, openDrawer, closeDrawer }}>
      {children}
    </ShellContext.Provider>
  );
}

export function useShell() {
  return useContext(ShellContext);
}

"use client";

import { useSyncExternalStore } from "react";

const listeners = new Set<() => void>();

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function getSnapshot() {
  return !document.documentElement.classList.contains("dark");
}

function getServerSnapshot() {
  return true;
}

function notificar() {
  for (const callback of listeners) callback();
}

export function ThemeToggle() {
  const claro = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function alternar() {
    const siguiente = !claro;
    document.documentElement.classList.toggle("dark", !siguiente);
    localStorage.setItem("theme", siguiente ? "light" : "dark");
    notificar();
  }

  return (
    <button
      onClick={alternar}
      aria-label={claro ? "Cambiar a modo oscuro" : "Cambiar a modo claro"}
      title={claro ? "Cambiar a modo oscuro" : "Cambiar a modo claro"}
      className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/50 text-white transition hover:border-white hover:bg-white/15"
    >
      {claro ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
          <circle cx="12" cy="12" r="4" />
          <path
            strokeLinecap="round"
            d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
          />
        </svg>
      )}
    </button>
  );
}

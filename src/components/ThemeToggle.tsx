"use client";

import { useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Moon, Sun } from "lucide-react";

const listeners = new Set<() => void>();

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function getSnapshot() {
  return !document.documentElement.classList.contains("dark");
}

// Dentro del sistema el modo claro es el predeterminado (ver layout.tsx).
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
    localStorage.setItem("tema", siguiente ? "claro" : "oscuro");
    notificar();
  }

  return (
    <motion.button
      type="button"
      onClick={alternar}
      aria-label={claro ? "Cambiar a modo oscuro" : "Cambiar a modo claro"}
      title={claro ? "Cambiar a modo oscuro" : "Cambiar a modo claro"}
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.9 }}
      className="relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg border border-white/50 text-white transition-colors hover:border-white hover:bg-white/15"
    >
      {/* La luna/el sol entra girando y el otro sale */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={claro ? "luna" : "sol"}
          initial={{ y: 14, rotate: -90, opacity: 0 }}
          animate={{ y: 0, rotate: 0, opacity: 1 }}
          exit={{ y: -14, rotate: 90, opacity: 0 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
        >
          {claro ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}

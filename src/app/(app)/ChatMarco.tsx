"use client";

import { AnimatePresence, motion } from "motion/react";
import { RotateCcw, Sparkles, X } from "lucide-react";
import { MascotaConAnillo } from "./MascotaAvatar";

// Piezas compartidas entre la tarjeta del Dashboard y la burbuja flotante:
// el encabezado con degradado de la marca y el fondo vivo del panel.

export function ChatEncabezado({
  compact = false,
  hayMensajes,
  onNuevo,
  onCerrar,
}: {
  compact?: boolean;
  hayMensajes: boolean;
  onNuevo: () => void;
  onCerrar?: () => void;
}) {
  return (
    <div
      className="animate-degradado relative flex shrink-0 items-center justify-between overflow-hidden px-4 py-3 text-white sm:px-5"
      style={{
        backgroundImage:
          "linear-gradient(120deg, var(--primary), color-mix(in srgb, var(--primary) 70%, #ff8a3d), color-mix(in srgb, var(--accent) 85%, #7c3aed), var(--primary))",
      }}
    >
      {/* Destello que cruza el encabezado cada pocos segundos */}
      <span
        aria-hidden
        className="animate-barrido pointer-events-none absolute inset-y-0 left-0 w-1/4 bg-gradient-to-r from-transparent via-white/25 to-transparent"
      />
      <div className="relative flex items-center gap-2.5">
        <MascotaConAnillo size={compact ? 32 : 36} enLinea />
        <div>
          <p className="flex items-center gap-1 text-sm font-semibold">
            El Hongo AI Assistant
            <Sparkles className="h-3.5 w-3.5 text-yellow-200" />
          </p>
          <p className="text-[11px] text-white/80">{compact ? "Tus datos en tiempo real" : "Conectado a tus datos en tiempo real"}</p>
        </div>
      </div>
      <div className="relative flex items-center gap-1">
        <AnimatePresence>
          {hayMensajes && (
            <motion.button
              type="button"
              onClick={onNuevo}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              whileHover={{ scale: 1.05 }}
              className="group flex items-center gap-1 rounded-lg bg-white/15 px-2.5 py-1.5 text-xs font-medium ring-1 ring-white/25 backdrop-blur transition-colors hover:bg-white/25"
            >
              <RotateCcw className="h-3.5 w-3.5 transition-transform duration-500 group-hover:-rotate-[360deg]" />
              {compact ? "Nuevo" : "Nuevo chat"}
            </motion.button>
          )}
        </AnimatePresence>
        {onCerrar && (
          <motion.button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar chat"
            whileHover={{ rotate: 90 }}
            className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-white/20"
          >
            <X className="h-4 w-4" />
          </motion.button>
        )}
      </div>
    </div>
  );
}

// Manchas de color difuminadas que se mueven lento detrás de la
// conversación — mismo efecto "aurora" del resto de la app, en chiquito.
export function ChatFondo() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div
        className="fondo-aurora fondo-aurora-1 absolute -left-1/4 top-[10%] h-72 w-72 rounded-full opacity-[0.13] blur-3xl"
        style={{ background: "radial-gradient(circle, var(--primary), transparent 65%)" }}
      />
      <div
        className="fondo-aurora fondo-aurora-2 absolute -right-1/4 bottom-[5%] h-80 w-80 rounded-full opacity-[0.13] blur-3xl"
        style={{ background: "radial-gradient(circle, var(--accent), transparent 65%)" }}
      />
      <div
        className="fondo-aurora fondo-aurora-3 absolute left-1/3 top-1/2 h-56 w-56 rounded-full opacity-[0.08] blur-3xl"
        style={{ background: "radial-gradient(circle, #facc15, transparent 65%)" }}
      />
    </div>
  );
}

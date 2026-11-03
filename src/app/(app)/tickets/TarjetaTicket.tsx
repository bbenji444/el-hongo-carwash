"use client";

import { useRef, type CSSProperties, type MouseEvent, type ReactNode, type Ref } from "react";
import { motion } from "motion/react";

// Color de acento por método de pago: tiñe el borde, la sombra, la barra
// superior y la luz que sigue al cursor al pasar el mouse por la tarjeta.
const ACENTO_POR_METODO: Record<string, string> = {
  efectivo: "var(--success)",
  tarjeta: "var(--accent)",
  transferencia: "var(--warning)",
};

export function TarjetaTicket({
  children,
  metodoPago,
  indice,
  ref: refExterno,
}: {
  children: ReactNode;
  metodoPago: string | null;
  indice: number;
  // AnimatePresence (mode "popLayout") le pasa su propia ref a cada hijo
  // para medirlo al salir — se combina con la ref interna.
  ref?: Ref<HTMLDivElement>;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  function asignarRef(el: HTMLDivElement | null) {
    ref.current = el;
    if (typeof refExterno === "function") refExterno(el);
    else if (refExterno) refExterno.current = el;
  }
  const acento = (metodoPago && ACENTO_POR_METODO[metodoPago]) || "var(--primary)";

  // La luz sigue al cursor vía variables CSS (sin re-render de React en
  // cada movimiento del mouse).
  function seguirCursor(e: MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
  }

  return (
    <motion.div
      ref={asignarRef}
      layout
      initial={{ opacity: 0, y: 18, scale: 0.97 }}
      animate={{
        opacity: 1,
        y: 0,
        scale: 1,
        // Entrada escalonada: cada tarjeta un poquito después que la
        // anterior, con tope para que una lista larga no tarde de más.
        transition: { type: "spring", stiffness: 320, damping: 28, delay: Math.min(indice * 0.035, 0.45) },
      }}
      exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.16 } }}
      whileHover={{ y: -5, transition: { type: "spring", stiffness: 420, damping: 24 } }}
      transition={{ layout: { type: "spring", stiffness: 420, damping: 36 } }}
      onMouseMove={seguirCursor}
      style={{ "--acento": acento } as CSSProperties}
      className="group relative isolate flex flex-col gap-1.5 overflow-hidden rounded-xl border border-border bg-surface p-3 transition-[border-color,box-shadow] duration-300 hover:border-[var(--acento)] hover:shadow-[0_14px_34px_-14px_var(--acento)]"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(240px circle at var(--mx, 50%) var(--my, 50%), color-mix(in srgb, var(--acento) 16%, transparent), transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-[3px] origin-left scale-x-0 bg-[var(--acento)] transition-transform duration-500 ease-out group-hover:scale-x-100"
      />
      {children}
    </motion.div>
  );
}

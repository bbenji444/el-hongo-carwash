"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  type Ref,
} from "react";
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

  // En celular/tablet no hay mouse que "pase encima": al tocar la tarjeta se
  // enciende el mismo efecto del hover (color, luz, barra y elevación) y se
  // apaga al tocar en cualquier otra parte (u otra tarjeta).
  const [tocada, setTocada] = useState(false);
  // Después de la entrada escalonada, subir/bajar al tocar ya no debe
  // esperar el retraso de la entrada.
  const [yaEntro, setYaEntro] = useState(false);

  useEffect(() => {
    if (!tocada) return;
    function tocarFuera(e: globalThis.PointerEvent) {
      if (!ref.current?.contains(e.target as Node)) setTocada(false);
    }
    document.addEventListener("pointerdown", tocarFuera);
    return () => document.removeEventListener("pointerdown", tocarFuera);
  }, [tocada]);

  // La luz sigue al cursor (o nace donde tocó el dedo) vía variables CSS,
  // sin re-render de React en cada movimiento.
  function moverLuz(clientX: number, clientY: number) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${clientX - r.left}px`);
    el.style.setProperty("--my", `${clientY - r.top}px`);
  }

  function alTocar(e: PointerEvent<HTMLDivElement>) {
    if (e.pointerType === "mouse") return;
    moverLuz(e.clientX, e.clientY);
    setTocada(true);
  }

  return (
    <motion.div
      ref={asignarRef}
      layout
      initial={{ opacity: 0, y: 18, scale: 0.97 }}
      animate={{
        opacity: 1,
        y: tocada ? -5 : 0,
        scale: 1,
        // Entrada escalonada: cada tarjeta un poquito después que la
        // anterior, con tope para que una lista larga no tarde de más.
        transition: {
          type: "spring",
          stiffness: 320,
          damping: 28,
          delay: yaEntro ? 0 : Math.min(indice * 0.035, 0.45),
        },
      }}
      onAnimationComplete={() => setYaEntro(true)}
      exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.16 } }}
      whileHover={{ y: -5, transition: { type: "spring", stiffness: 420, damping: 24 } }}
      transition={{ layout: { type: "spring", stiffness: 420, damping: 36 } }}
      onMouseMove={(e: MouseEvent<HTMLDivElement>) => moverLuz(e.clientX, e.clientY)}
      onPointerDown={alTocar}
      data-tocada={tocada || undefined}
      style={{ "--acento": acento } as CSSProperties}
      className="group relative isolate flex flex-col gap-1.5 overflow-hidden rounded-xl border border-border bg-surface p-3 transition-[border-color,box-shadow] duration-300 hover:border-[var(--acento)] hover:shadow-[0_14px_34px_-14px_var(--acento)] data-[tocada]:border-[var(--acento)] data-[tocada]:shadow-[0_14px_34px_-14px_var(--acento)]"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-data-[tocada]:opacity-100"
        style={{
          background:
            "radial-gradient(240px circle at var(--mx, 50%) var(--my, 50%), color-mix(in srgb, var(--acento) 16%, transparent), transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-[3px] origin-left scale-x-0 bg-[var(--acento)] transition-transform duration-500 ease-out group-hover:scale-x-100 group-data-[tocada]:scale-x-100"
      />
      {children}
    </motion.div>
  );
}

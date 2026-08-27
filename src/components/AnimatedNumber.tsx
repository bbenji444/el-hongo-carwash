"use client";

import { useEffect, useRef, useState } from "react";

// El formateador se elige por nombre (string) en vez de recibir una función
// como prop: una función no se puede mandar de un Server Component a un
// Client Component (no es serializable) — eso rompía esta pantalla en
// producción con un error 500 que el build local nunca detectaba, porque
// esta ruta dinámica solo se ejecuta con datos reales en un request real,
// no durante `next build`.
const FORMATOS = {
  entero: (n: number) => Math.round(n).toString(),
  dinero: (n: number) => `$${n.toFixed(2)}`,
} as const;

export function AnimatedNumber({
  value,
  format = "entero",
  duration = 900,
}: {
  value: number;
  format?: keyof typeof FORMATOS;
  duration?: number;
}) {
  const [display, setDisplay] = useState(0);
  const prevValue = useRef(0);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const from = prevValue.current;
    const to = value;

    if (reducedMotion) {
      const frame = requestAnimationFrame(() => {
        setDisplay(to);
        prevValue.current = to;
      });
      return () => cancelAnimationFrame(frame);
    }

    const start = performance.now();
    let frame: number;

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(from + (to - from) * eased);
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        prevValue.current = to;
      }
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return <>{FORMATOS[format](display)}</>;
}

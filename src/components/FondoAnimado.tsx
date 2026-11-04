import type { CSSProperties } from "react";

// Fondo con movimiento para toda la app: "aurora" de colores de la marca que
// se desplaza lento + burbujas de jabón subiendo (va con el autolavado).
// Todo es CSS (transform/opacity, sin JS por cuadro), así que es ligero
// también en celular, y respeta "reducir movimiento" vía globals.css.
//
// "intensa" es para el login (llamativo); "sutil" para dentro del sistema,
// donde no debe distraer del contenido.

// Valores fijos (no aleatorios) para que el HTML del servidor y del
// navegador coincidan — sin desfase de hidratación.
const BURBUJAS = [
  { left: 4, size: 18, dur: 19, delay: 0 },
  { left: 11, size: 42, dur: 27, delay: 6 },
  { left: 17, size: 12, dur: 16, delay: 11 },
  { left: 24, size: 28, dur: 23, delay: 3 },
  { left: 31, size: 56, dur: 33, delay: 14 },
  { left: 38, size: 16, dur: 18, delay: 8 },
  { left: 45, size: 34, dur: 25, delay: 1 },
  { left: 52, size: 22, dur: 21, delay: 16 },
  { left: 58, size: 64, dur: 36, delay: 5 },
  { left: 64, size: 14, dur: 17, delay: 12 },
  { left: 70, size: 38, dur: 26, delay: 9 },
  { left: 76, size: 20, dur: 20, delay: 2 },
  { left: 82, size: 48, dur: 30, delay: 18 },
  { left: 88, size: 16, dur: 19, delay: 7 },
  { left: 93, size: 30, dur: 24, delay: 13 },
  { left: 98, size: 24, dur: 22, delay: 4 },
];

export function FondoAnimado({ intensidad = "sutil" }: { intensidad?: "sutil" | "intensa" }) {
  const intensa = intensidad === "intensa";
  const burbujas = intensa ? BURBUJAS : BURBUJAS.filter((_, i) => i % 2 === 0);

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Aurora: manchas grandes y difuminadas que derivan lentamente */}
      <div
        className="fondo-aurora fondo-aurora-1 absolute -left-[15%] -top-[20%] h-[60vmax] w-[60vmax] rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, var(--primary), transparent 65%)", opacity: intensa ? 0.38 : 0.1 }}
      />
      <div
        className="fondo-aurora fondo-aurora-2 absolute -bottom-[25%] -right-[15%] h-[55vmax] w-[55vmax] rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, var(--accent), transparent 65%)", opacity: intensa ? 0.34 : 0.09 }}
      />
      <div
        className="fondo-aurora fondo-aurora-3 absolute left-[30%] top-[35%] h-[40vmax] w-[40vmax] rounded-full blur-3xl"
        style={{
          background: "radial-gradient(circle, color-mix(in srgb, var(--primary) 55%, var(--accent)), transparent 65%)",
          opacity: intensa ? 0.22 : 0.06,
        }}
      />

      {/* Retícula de puntos con desvanecido en los bordes (solo login) */}
      {intensa && (
        <div
          className="absolute inset-0 opacity-60"
          style={{
            backgroundImage: "radial-gradient(color-mix(in srgb, var(--foreground) 14%, transparent) 1px, transparent 1px)",
            backgroundSize: "26px 26px",
            maskImage: "radial-gradient(ellipse at center, black 25%, transparent 75%)",
            WebkitMaskImage: "radial-gradient(ellipse at center, black 25%, transparent 75%)",
          }}
        />
      )}

      {/* Burbujas de jabón subiendo con un ligero vaivén */}
      {burbujas.map((b, i) => (
        <span
          key={i}
          className="fondo-burbuja absolute bottom-0"
          style={
            {
              left: `${b.left}%`,
              "--dur": `${b.dur}s`,
              "--delay": `-${b.delay}s`,
              "--opacidad": intensa ? 0.75 : 0.35,
            } as CSSProperties
          }
        >
          <span
            className="fondo-burbuja-vaiven block rounded-full"
            style={{
              width: b.size,
              height: b.size,
              background:
                "radial-gradient(circle at 32% 28%, rgba(255,255,255,0.85), rgba(255,255,255,0.08) 38%, color-mix(in srgb, var(--accent) 10%, transparent) 70%)",
              border: "1px solid color-mix(in srgb, var(--accent) 35%, rgba(255,255,255,0.5))",
              boxShadow: "inset -3px -4px 8px color-mix(in srgb, var(--primary) 12%, transparent)",
            }}
          />
        </span>
      ))}
    </div>
  );
}

import Image from "next/image";

// Avatar circular del personaje de El Hongo — se usa en el FAB flotante, el
// saludo inicial del chat y junto a cada respuesta del asistente, para que
// se sienta como si fuera él quien te está hablando.
export function MascotaAvatar({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-full border border-border bg-white ${className}`}
      style={{ width: size, height: size }}
    >
      <Image src="/mascota.jpg" alt="El Hongo" fill sizes={`${size}px`} className="object-cover object-top" />
    </div>
  );
}

// Colores del anillo: los de la marca más un toque amarillo, girando.
const ANILLO = "conic-gradient(from 0deg, var(--primary), #ff8a3d, #facc15, var(--accent), var(--primary))";

// El mismo avatar con un anillo de colores girando alrededor y, opcional,
// el puntito verde de "en línea".
export function MascotaConAnillo({
  size = 36,
  grosor = 2.5,
  enLinea = false,
  className = "",
}: {
  size?: number;
  grosor?: number;
  enLinea?: boolean;
  className?: string;
}) {
  const total = size + grosor * 2;
  return (
    <div className={`relative shrink-0 ${className}`} style={{ width: total, height: total }}>
      <span aria-hidden className="animate-girar absolute inset-0 rounded-full" style={{ background: ANILLO }} />
      <span
        aria-hidden
        className="animate-girar absolute inset-0 rounded-full opacity-60 blur-md"
        style={{ background: ANILLO }}
      />
      <div className="absolute" style={{ inset: grosor }}>
        <MascotaAvatar size={size} className="border-2 border-surface" />
      </div>
      {enLinea && (
        <span className="absolute bottom-0 right-0 flex" style={{ width: Math.max(9, size / 4), height: Math.max(9, size / 4) }}>
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-70" />
          <span className="relative inline-flex h-full w-full rounded-full border-2 border-surface bg-success" />
        </span>
      )}
    </div>
  );
}

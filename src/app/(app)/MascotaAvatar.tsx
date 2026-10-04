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

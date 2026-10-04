import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // El límite por default (1MB) se queda corto para subir fotos de tickets
  // de compra desde Gastos — se sube a 10MB.
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
    // Sin esto, Next reutiliza (hasta 30s) lo último que haya renderizado
    // para una página dinámica (como Reportes, que depende de
    // searchParams) al navegar con <Link> — por eso entrar desde el menú
    // mostraba las gráficas vacías/viejas, y solo se veían bien al enviar
    // el formulario de filtro (que sí hace una recarga completa). En 0,
    // cada clic en un <Link> vuelve a pedir datos frescos al servidor.
    staleTimes: {
      dynamic: 0,
    },
  },
};

export default nextConfig;

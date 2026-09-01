import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // El límite por default (1MB) se queda corto para subir fotos de tickets
  // de compra desde Gastos — se sube a 10MB.
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;

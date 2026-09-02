import type { ServicioPrecio, TamanoVehiculo } from "@/types/database.types";

export const TAMANOS_VEHICULO: { value: TamanoVehiculo; label: string }[] = [
  { value: "automovil", label: "Automóvil" },
  { value: "camioneta_chica", label: "Camioneta Chica" },
  { value: "camioneta_grande", label: "Camioneta Grande" },
  { value: "camioneta_extra_grande", label: "Camioneta Extra Grande" },
  { value: "moto_chica", label: "Moto Chica" },
  { value: "moto_grande", label: "Moto Grande" },
];

// Las motos tienen un precio fijo sin importar el paquete que se elija (no
// varían por servicio como los demás tamaños) — a diferencia del resto,
// que sí se configuran por paquete en Servicios.
export const PRECIOS_MOTO_FIJOS: Partial<Record<TamanoVehiculo, number>> = {
  moto_chica: 70,
  moto_grande: 100,
};

// Tamaños cuyo precio sí se configura por paquete en Servicios (todos menos
// las motos, que tienen precio fijo — ver PRECIOS_MOTO_FIJOS).
export const TAMANOS_PRECIO_VARIABLE = TAMANOS_VEHICULO.filter((t) => !(t.value in PRECIOS_MOTO_FIJOS));

export function nombreTamano(tamano: TamanoVehiculo): string {
  return TAMANOS_VEHICULO.find((t) => t.value === tamano)?.label ?? tamano;
}

export function precioPorTamano(
  precios: ServicioPrecio[] | undefined,
  tamano: TamanoVehiculo
): number {
  if (tamano in PRECIOS_MOTO_FIJOS) return PRECIOS_MOTO_FIJOS[tamano]!;
  return precios?.find((p) => p.tamano_vehiculo === tamano)?.precio ?? 0;
}

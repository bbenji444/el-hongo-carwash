import type { ServicioPrecio, TamanoVehiculo } from "@/types/database.types";

export const TAMANOS_VEHICULO: { value: TamanoVehiculo; label: string }[] = [
  { value: "automovil", label: "Automóvil" },
  { value: "camioneta_chica", label: "Camioneta Chica" },
  { value: "camioneta_grande", label: "Camioneta Grande" },
  { value: "camioneta_extra_grande", label: "Camioneta Extra Grande" },
];

export function nombreTamano(tamano: TamanoVehiculo): string {
  return TAMANOS_VEHICULO.find((t) => t.value === tamano)?.label ?? tamano;
}

export function precioPorTamano(
  precios: ServicioPrecio[] | undefined,
  tamano: TamanoVehiculo
): number {
  return precios?.find((p) => p.tamano_vehiculo === tamano)?.precio ?? 0;
}

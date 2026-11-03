import type { Ticket, ServicioCatalogo, ServicioPrecio, TicketExtra, RolUsuario } from "@/types/database.types";

export type ServicioConPrecios = ServicioCatalogo & { precios: ServicioPrecio[] };

export type TicketConDetalle = Ticket & {
  servicio: ServicioConPrecios | null;
  cliente: { id: string; nombre: string; telefono: string | null } | null;
  vehiculo: { id: string; placas: string | null; tipo_vehiculo: string | null } | null;
  empleado: { id: string; nombre: string } | null;
  // Lavador asignado (desde el cambio a comisión, uno solo por ticket;
  // tickets viejos pueden traer más de uno) — arreglo vacío si nadie.
  lavadores: { id: string; nombre: string }[];
  tienePago: boolean;
  metodoPago: string | null;
  extras: TicketExtra[];
};

export function sumaExtras(extras: { precio: number }[]): number {
  return extras.reduce((suma, e) => suma + e.precio, 0);
}

export type { RolUsuario };

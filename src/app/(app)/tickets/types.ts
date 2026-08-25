import type { Ticket, ServicioCatalogo, ServicioPrecio, RolUsuario } from "@/types/database.types";

export type ServicioConPrecios = ServicioCatalogo & { precios: ServicioPrecio[] };

export type TicketConDetalle = Ticket & {
  servicio: ServicioConPrecios | null;
  cliente: { id: string; nombre: string; telefono: string | null } | null;
  vehiculo: { id: string; placas: string | null; tipo_vehiculo: string | null } | null;
  empleado: { id: string; nombre: string } | null;
  tienePago: boolean;
};

export type { RolUsuario };

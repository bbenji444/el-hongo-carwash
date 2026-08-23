import type { Ticket, ServicioCatalogo, RolUsuario, MembresiaTipo } from "@/types/database.types";

export type TicketConDetalle = Ticket & {
  servicio: ServicioCatalogo | null;
  cliente: { id: string; nombre: string; telefono: string | null } | null;
  vehiculo: { id: string; placas: string | null; tipo_vehiculo: string | null } | null;
  empleado: { id: string; nombre: string } | null;
  tienePago: boolean;
  membresiaTipo: MembresiaTipo | null;
};

export type { RolUsuario };

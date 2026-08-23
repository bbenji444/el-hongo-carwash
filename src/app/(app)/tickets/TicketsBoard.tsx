"use client";

import { useState, useTransition } from "react";
import type { ServicioCatalogo, Turno } from "@/types/database.types";
import type { TicketConDetalle, RolUsuario } from "./types";
import { AbrirTurnoForm } from "./AbrirTurnoForm";
import { NuevoTicketModal } from "./NuevoTicketModal";
import { CobroModal } from "./CobroModal";
import { DescuentoModal } from "./DescuentoModal";
import { actualizarEstadoTicket } from "./actions";

const COLUMNAS: { estado: TicketConDetalle["estado"]; titulo: string }[] = [
  { estado: "en_espera", titulo: "En espera" },
  { estado: "en_proceso", titulo: "En proceso" },
  { estado: "terminado", titulo: "Terminado" },
  { estado: "entregado", titulo: "Entregado" },
];

function ordenar(tickets: TicketConDetalle[]) {
  return [...tickets].sort((a, b) => {
    if (a.prioridad !== b.prioridad) return a.prioridad ? -1 : 1;
    return new Date(a.hora_entrada).getTime() - new Date(b.hora_entrada).getTime();
  });
}

export function TicketsBoard({
  turno,
  servicios,
  tickets,
  rolActual,
  usuarioActualId,
}: {
  turno: Turno | null;
  servicios: ServicioCatalogo[];
  tickets: TicketConDetalle[];
  rolActual: RolUsuario;
  usuarioActualId: string;
}) {
  const [mostrarNuevo, setMostrarNuevo] = useState(false);
  const [cobroTicket, setCobroTicket] = useState<TicketConDetalle | null>(null);
  const [descuentoTicket, setDescuentoTicket] = useState<TicketConDetalle | null>(null);
  const [pending, startTransition] = useTransition();

  if (!turno) {
    return <AbrirTurnoForm />;
  }

  function avanzar(ticket: TicketConDetalle, nuevoEstado: TicketConDetalle["estado"]) {
    if (nuevoEstado === "entregado" && !ticket.tienePago) {
      setCobroTicket(ticket);
      return;
    }
    startTransition(async () => {
      await actualizarEstadoTicket(ticket.id, nuevoEstado);
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between rounded-xl border border-border bg-surface px-5 py-3">
        <p className="text-sm text-muted">
          Turno abierto · Efectivo inicial:{" "}
          <span className="text-foreground">${turno.efectivo_inicial.toFixed(2)}</span>
        </p>
        <button
          onClick={() => setMostrarNuevo(true)}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-hover"
        >
          + Nuevo ticket
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        {COLUMNAS.map((col) => {
          const ticketsCol = ordenar(tickets.filter((t) => t.estado === col.estado));
          return (
            <div key={col.estado} className="flex flex-col gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                {col.titulo} ({ticketsCol.length})
              </p>
              <div className="flex flex-col gap-3">
                {ticketsCol.map((ticket) => (
                  <div
                    key={ticket.id}
                    className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {ticket.cliente?.nombre ?? "Cliente de mostrador"}
                        </p>
                        {ticket.vehiculo?.placas && (
                          <p className="text-xs text-muted">{ticket.vehiculo.placas}</p>
                        )}
                      </div>
                      {ticket.prioridad && (
                        <span className="rounded-full border border-accent/40 bg-accent/15 px-2 py-0.5 text-[10px] font-medium text-accent">
                          Prioridad
                        </span>
                      )}
                    </div>

                    <p className="text-sm text-foreground">{ticket.servicio?.nombre}</p>
                    <p className="text-xs text-muted">
                      ${ticket.servicio?.precio.toFixed(2)}
                      {ticket.descuento_monto > 0 && (
                        <span className="text-warning"> · -${ticket.descuento_monto.toFixed(2)} desc.</span>
                      )}
                    </p>
                    <p className="text-xs text-muted">Empleado: {ticket.empleado?.nombre ?? "—"}</p>
                    <p className="text-[11px] text-muted/70">
                      {new Date(ticket.hora_entrada).toLocaleTimeString("es-MX", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>

                    {ticket.tienePago && (
                      <span className="w-fit rounded-full border border-success/40 bg-success/15 px-2 py-0.5 text-[10px] text-success">
                        Pagado
                      </span>
                    )}

                    <div className="mt-1 flex flex-wrap gap-2">
                      {col.estado === "en_espera" && (
                        <button
                          onClick={() => avanzar(ticket, "en_proceso")}
                          disabled={pending}
                          className="rounded-lg bg-accent/15 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/25 disabled:opacity-60"
                        >
                          Iniciar
                        </button>
                      )}
                      {col.estado === "en_proceso" && (
                        <button
                          onClick={() => avanzar(ticket, "terminado")}
                          disabled={pending}
                          className="rounded-lg bg-accent/15 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/25 disabled:opacity-60"
                        >
                          Terminar
                        </button>
                      )}
                      {col.estado === "terminado" && (
                        <button
                          onClick={() => avanzar(ticket, "entregado")}
                          disabled={pending}
                          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-hover disabled:opacity-60"
                        >
                          {ticket.tienePago ? "Entregar" : "Cobrar y entregar"}
                        </button>
                      )}
                      {col.estado !== "entregado" && ticket.descuento_monto === 0 && (
                        <button
                          onClick={() => setDescuentoTicket(ticket)}
                          className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted hover:text-foreground"
                        >
                          Descuento
                        </button>
                      )}
                      {col.estado !== "entregado" && !ticket.tienePago && (
                        <button
                          onClick={() => setCobroTicket(ticket)}
                          className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted hover:text-foreground"
                        >
                          Cobrar
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {ticketsCol.length === 0 && (
                  <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted">
                    Sin tickets
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {mostrarNuevo && (
        <NuevoTicketModal
          turnoId={turno.id}
          servicios={servicios}
          rolActual={rolActual}
          usuarioActualId={usuarioActualId}
          onClose={() => setMostrarNuevo(false)}
        />
      )}

      {cobroTicket && (
        <CobroModal
          ticket={cobroTicket}
          turnoId={turno.id}
          onClose={() => setCobroTicket(null)}
          onPagado={() => {
            const ticketAEntregar = cobroTicket;
            setCobroTicket(null);
            startTransition(async () => {
              await actualizarEstadoTicket(ticketAEntregar.id, "entregado");
            });
          }}
        />
      )}

      {descuentoTicket && (
        <DescuentoModal
          ticket={descuentoTicket}
          onClose={() => setDescuentoTicket(null)}
          onAutorizado={() => setDescuentoTicket(null)}
        />
      )}
    </div>
  );
}

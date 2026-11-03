"use client";

import { useState, useTransition } from "react";
import type { Turno, Lavador, ConfiguracionApp, ExtraCatalogo } from "@/types/database.types";
import type { TicketConDetalle, ServicioConPrecios } from "./types";
import { sumaExtras } from "./types";
import { nombreTamano, precioPorTamano } from "@/lib/servicios";
import { AbrirTurnoForm } from "./AbrirTurnoForm";
import { NuevoTicketModal } from "./NuevoTicketModal";
import { EditarTicketModal } from "./EditarTicketModal";
import { ClienteDetalleModal } from "./ClienteDetalleModal";
import { entregarTicketPendiente } from "./actions";
import { useRealtimeRefresh } from "@/lib/useRealtimeRefresh";

const METODO_LABEL: Record<string, string> = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  transferencia: "Transferencia",
};

type ResumenCaja = {
  totalesVisibles: Record<string, number>;
  ocultarEfectivo: boolean;
  pendientes: number;
  efectivoEsperado: number | null;
  ventasHoy: number;
};

function totalTicket(ticket: TicketConDetalle) {
  const base = precioPorTamano(ticket.servicio?.precios, ticket.tamano_vehiculo);
  return Math.max(base + sumaExtras(ticket.extras) - ticket.descuento_monto, 0);
}

export function TicketsBoard({
  turno,
  servicios,
  lavadores,
  extras,
  tickets,
  usuarioActualId,
  resumenCaja,
  config,
  puedeEditarTickets,
  esDueno,
}: {
  turno: Turno | null;
  servicios: ServicioConPrecios[];
  lavadores: Lavador[];
  extras: ExtraCatalogo[];
  tickets: TicketConDetalle[];
  usuarioActualId: string;
  resumenCaja: ResumenCaja | null;
  config: ConfiguracionApp;
  puedeEditarTickets: boolean;
  esDueno: boolean;
}) {
  const [mostrarNuevo, setMostrarNuevo] = useState(false);
  const [editarTicket, setEditarTicket] = useState<TicketConDetalle | null>(null);
  const [pagandoTicketId, setPagandoTicketId] = useState<string | null>(null);
  const [clienteDetalleTicket, setClienteDetalleTicket] = useState<TicketConDetalle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useRealtimeRefresh(["tickets", "pagos", "turnos", "ticket_extras"]);

  const encabezado = (
    <div>
      <h1 className="text-2xl font-bold text-foreground">Tickets</h1>
      <p className="text-sm text-muted">Autos registrados en el turno en curso.</p>
    </div>
  );

  if (!turno) {
    return (
      <div className="flex flex-col gap-5">
        {encabezado}
        <AbrirTurnoForm />
      </div>
    );
  }

  // Desde el cambio a "registrar = cobrado y entregado", todo ticket nuevo
  // nace entregado. Los que siguen sin entregar son de antes del cambio
  // (flujo viejo de estados) — se muestran aparte solo para poder cerrarlos.
  const pendientes = tickets.filter((t) => t.estado !== "entregado");
  const registrados = tickets
    .filter((t) => t.estado === "entregado")
    .sort(
      (a, b) =>
        new Date(b.hora_salida ?? b.hora_entrada).getTime() - new Date(a.hora_salida ?? a.hora_entrada).getTime()
    );

  function entregarPendiente(ticket: TicketConDetalle, metodo: "efectivo" | "tarjeta" | "transferencia" | null) {
    setError(null);
    startTransition(async () => {
      const result = await entregarTicketPendiente(ticket.id, metodo);
      if (result.error) {
        setError(result.error);
      } else {
        setPagandoTicketId(null);
      }
    });
  }

  function tarjeta(ticket: TicketConDetalle, esPendiente: boolean) {
    return (
      <div key={ticket.id} className="flex flex-col gap-1.5 rounded-xl border border-border bg-surface p-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <button
              type="button"
              disabled={!ticket.cliente}
              onClick={() => setClienteDetalleTicket(ticket)}
              className="text-left text-sm font-semibold text-foreground disabled:cursor-default enabled:hover:text-accent enabled:hover:underline"
            >
              {ticket.cliente?.nombre ?? ticket.distintivo ?? "Cliente de mostrador"}
            </button>
            <p className="text-xs text-muted">
              {[ticket.cliente ? ticket.distintivo : null, ticket.placa ?? ticket.vehiculo?.placas, nombreTamano(ticket.tamano_vehiculo)]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <span className="shrink-0 text-sm font-bold text-foreground">${totalTicket(ticket).toFixed(2)}</span>
        </div>

        <p className="text-xs text-foreground">
          {ticket.servicio?.nombre} · ${precioPorTamano(ticket.servicio?.precios, ticket.tamano_vehiculo).toFixed(2)}
          {ticket.lavada_gratis && <span className="text-success"> · Lavada gratis</span>}
        </p>
        {ticket.extras.length > 0 && (
          <p className="text-xs text-accent">
            + {ticket.extras.map((e) => e.nombre).join(", ")} · ${sumaExtras(ticket.extras).toFixed(2)}
          </p>
        )}
        {ticket.lavadores.length > 0 && (
          <p className="text-xs text-muted">
            {config.emoji_lavador} {ticket.lavadores.map((l) => l.nombre).join(", ")}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          {ticket.metodoPago && (
            <span className="rounded-full border border-success/40 bg-success/15 px-2 py-0.5 text-success">
              {METODO_LABEL[ticket.metodoPago] ?? ticket.metodoPago}
            </span>
          )}
          {!esPendiente && (
            <span className="text-muted">
              {new Date(ticket.hora_salida ?? ticket.hora_entrada).toLocaleTimeString("es-MX", {
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "America/Mexico_City",
              })}
            </span>
          )}
        </div>

        <div className="mt-1 flex flex-wrap gap-2">
          {esPendiente && pagandoTicketId !== ticket.id && (
            <button
              onClick={() =>
                ticket.tienePago || totalTicket(ticket) === 0
                  ? entregarPendiente(ticket, null)
                  : setPagandoTicketId(ticket.id)
              }
              disabled={pending}
              aria-label="Cobrar y entregar"
              className="rounded-lg bg-primary px-4 py-1.5 text-sm font-bold text-white hover:bg-primary-hover disabled:opacity-60"
            >
              ✓
            </button>
          )}
          {esPendiente && pagandoTicketId === ticket.id && (
            <div className="flex w-full flex-col gap-1.5">
              <p className="text-[11px] text-muted">¿Cómo pagó?</p>
              <div className="grid grid-cols-3 gap-1.5">
                {(["efectivo", "tarjeta", "transferencia"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => entregarPendiente(ticket, m)}
                    disabled={pending}
                    className="rounded-lg bg-primary px-2 py-1.5 text-xs font-semibold text-white hover:bg-primary-hover disabled:opacity-60"
                  >
                    {METODO_LABEL[m]}
                  </button>
                ))}
              </div>
              <button onClick={() => setPagandoTicketId(null)} className="text-[11px] text-muted hover:text-foreground">
                Cancelar
              </button>
            </div>
          )}
          {puedeEditarTickets && (
            <button
              onClick={() => setEditarTicket(ticket)}
              className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted hover:text-foreground"
            >
              Editar
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        {encabezado}
        <button
          onClick={() => setMostrarNuevo(true)}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-all duration-150 hover:-translate-y-0.5 hover:bg-primary-hover hover:shadow-lg hover:shadow-primary/25"
        >
          + Nuevo ticket
        </button>
      </div>

      {error && (
        <p className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm text-primary">{error}</p>
      )}

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Resumen del turno</p>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
          <div className="rounded-lg border border-border bg-background p-2.5">
            <p className="text-[10px] uppercase tracking-wide text-muted">Efectivo inicial</p>
            <p className="text-sm font-semibold text-foreground">${turno.efectivo_inicial.toFixed(2)}</p>
          </div>
          {resumenCaja && (
            <>
              {!resumenCaja.ocultarEfectivo && (
                <div className="rounded-lg border border-border bg-background p-2.5">
                  <p className="text-[10px] uppercase tracking-wide text-muted">{METODO_LABEL.efectivo}</p>
                  <p className="text-sm font-semibold text-foreground">
                    ${(resumenCaja.totalesVisibles.efectivo ?? 0).toFixed(2)}
                  </p>
                </div>
              )}
              {resumenCaja.efectivoEsperado !== null && (
                <div className="rounded-lg border border-border bg-background p-2.5">
                  <p className="text-[10px] uppercase tracking-wide text-muted">Efectivo esperado</p>
                  <p className="text-sm font-semibold text-foreground">${resumenCaja.efectivoEsperado.toFixed(2)}</p>
                </div>
              )}
              {(["tarjeta", "transferencia"] as const).map((m) => (
                <div key={m} className="rounded-lg border border-border bg-background p-2.5">
                  <p className="text-[10px] uppercase tracking-wide text-muted">{METODO_LABEL[m]}</p>
                  <p className="text-sm font-semibold text-foreground">
                    ${(resumenCaja.totalesVisibles[m] ?? 0).toFixed(2)}
                  </p>
                </div>
              ))}
              <div className="rounded-lg border border-success/40 bg-success/10 p-2.5">
                <p className="text-[10px] uppercase tracking-wide text-muted">Ganancia</p>
                <p className="text-sm font-semibold text-success">
                  ${Object.values(resumenCaja.totalesVisibles).reduce((suma, monto) => suma + monto, 0).toFixed(2)}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-background p-2.5">
                <p className="text-[10px] uppercase tracking-wide text-muted">Autos hoy</p>
                <p className="text-sm font-semibold text-foreground">{resumenCaja.ventasHoy}</p>
              </div>
            </>
          )}
        </div>
      </div>

      {pendientes.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-warning">
            Pendientes de antes del cambio ({pendientes.length}) — toca ✓ para cobrar y cerrar
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {pendientes.map((t) => tarjeta(t, true))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          Registrados en este turno ({registrados.length})
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {registrados.map((t) => tarjeta(t, false))}
        </div>
        {registrados.length === 0 && (
          <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted">
            Todavía no hay autos registrados en este turno.
          </p>
        )}
      </div>

      {mostrarNuevo && (
        <NuevoTicketModal
          turnoId={turno.id}
          servicios={servicios}
          lavadores={lavadores}
          extras={extras}
          config={config}
          usuarioActualId={usuarioActualId}
          onClose={() => setMostrarNuevo(false)}
        />
      )}

      {editarTicket && (
        <EditarTicketModal
          ticket={editarTicket}
          servicios={servicios}
          lavadores={lavadores}
          extras={extras}
          config={config}
          esDueno={esDueno}
          onClose={() => setEditarTicket(null)}
        />
      )}

      {clienteDetalleTicket?.cliente && (
        <ClienteDetalleModal
          clienteId={clienteDetalleTicket.cliente.id}
          ticketActual={{
            servicioNombre: clienteDetalleTicket.servicio?.nombre ?? null,
            empleadoNombre: clienteDetalleTicket.empleado?.nombre ?? null,
            lavadorNombre:
              clienteDetalleTicket.lavadores.length > 0
                ? clienteDetalleTicket.lavadores.map((l) => l.nombre).join(", ")
                : null,
            distintivo: clienteDetalleTicket.distintivo,
            placa: clienteDetalleTicket.placa ?? clienteDetalleTicket.vehiculo?.placas ?? null,
          }}
          onClose={() => setClienteDetalleTicket(null)}
        />
      )}
    </div>
  );
}

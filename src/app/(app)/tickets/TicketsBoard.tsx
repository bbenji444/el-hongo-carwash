"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import type { Turno, Lavador, ConfiguracionApp } from "@/types/database.types";
import type { TicketConDetalle, ServicioConPrecios } from "./types";
import { nombreTamano, precioPorTamano } from "@/lib/servicios";
import { AbrirTurnoForm } from "./AbrirTurnoForm";
import { NuevoTicketModal } from "./NuevoTicketModal";
import { EditarTicketModal } from "./EditarTicketModal";
import { CobroModal } from "./CobroModal";
import { DescuentoModal } from "./DescuentoModal";
import { ClienteDetalleModal } from "./ClienteDetalleModal";
import { actualizarEstadoTicket } from "./actions";

const COLUMNAS: { estado: TicketConDetalle["estado"]; titulo: string }[] = [
  { estado: "en_espera", titulo: "En espera" },
  { estado: "en_proceso", titulo: "En proceso" },
  { estado: "terminado", titulo: "Terminado" },
  { estado: "entregado", titulo: "Entregado" },
];

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
  tiempoPromedioMin: number | null;
};

// Semáforo de espera: verde en orden, amarillo/rojo a partir de los minutos
// configurados en Ajustes (config.semaforo_*), sin que el ticket llegue a
// "Entregado". El color se mide sobre el tiempo total del ciclo (persiste
// aunque cambie de etapa) y el fondo de toda la tarjeta cambia según el
// nivel, no solo un badge.
type NivelEspera = "ok" | "alerta" | "critico";

const TARJETA_ESTILO: Record<NivelEspera, string> = {
  ok: "border-success/50 bg-success/10",
  alerta: "border-warning/50 bg-warning/10",
  critico: "border-primary/60 bg-primary/15",
};

const CRONOMETRO_ESTILO: Record<NivelEspera, string> = {
  ok: "text-success",
  alerta: "text-warning",
  critico: "text-primary",
};

function calcularNivel(minutosTotal: number, alertaMin: number, criticoMin: number): NivelEspera {
  return minutosTotal >= criticoMin ? "critico" : minutosTotal >= alertaMin ? "alerta" : "ok";
}

function formatearDuracion(ms: number) {
  const totalSegundos = Math.max(0, Math.floor(ms / 1000));
  const horas = Math.floor(totalSegundos / 3600);
  const minutos = Math.floor((totalSegundos % 3600) / 60);
  const segundos = totalSegundos % 60;
  const mm = String(minutos).padStart(2, "0");
  const ss = String(segundos).padStart(2, "0");
  return horas > 0 ? `${horas}:${mm}:${ss}` : `${mm}:${ss}`;
}

function formatearMinutos(minutos: number) {
  const redondeado = Math.round(minutos);
  if (redondeado < 60) return `${redondeado} min`;
  const horas = Math.floor(redondeado / 60);
  const resto = redondeado % 60;
  return resto > 0 ? `${horas}h ${resto}min` : `${horas}h`;
}

function ordenar(tickets: TicketConDetalle[]) {
  return [...tickets].sort((a, b) => {
    if (a.prioridad !== b.prioridad) return a.prioridad ? -1 : 1;
    return new Date(a.hora_entrada).getTime() - new Date(b.hora_entrada).getTime();
  });
}

export function TicketsBoard({
  turno,
  servicios,
  lavadores,
  tickets,
  usuarioActualId,
  resumenCaja,
  serverAhora,
  config,
  puedeEditarTickets,
}: {
  turno: Turno | null;
  servicios: ServicioConPrecios[];
  lavadores: Lavador[];
  tickets: TicketConDetalle[];
  usuarioActualId: string;
  resumenCaja: ResumenCaja | null;
  serverAhora: string;
  config: ConfiguracionApp;
  puedeEditarTickets: boolean;
}) {
  const [mostrarNuevo, setMostrarNuevo] = useState(false);
  const [cobroTicket, setCobroTicket] = useState<TicketConDetalle | null>(null);
  const [editarTicket, setEditarTicket] = useState<TicketConDetalle | null>(null);
  // Si el cobro se disparó al intentar entregar (columna "Terminado"), pagar debe
  // avanzar el ticket a Entregado. Si se disparó desde el botón suelto "Cobrar"
  // en una columna anterior, solo debe registrar el pago sin saltarse pasos.
  const [cobroYEntregar, setCobroYEntregar] = useState(false);
  const [descuentoTicket, setDescuentoTicket] = useState<TicketConDetalle | null>(null);
  const [clienteDetalleTicket, setClienteDetalleTicket] = useState<TicketConDetalle | null>(null);
  const [errorAvance, setErrorAvance] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 1_000);
    return () => clearInterval(id);
  }, []);

  // Los cronómetros comparan la hora del navegador contra marcas de tiempo
  // puestas por el servidor. Si el reloj del equipo del cajero está
  // desfasado (adelantado o atrasado) respecto al servidor, esa resta sale
  // mal y el cronómetro se ve pegado en 0 hasta que el reloj local "alcanza"
  // la hora del servidor. Por eso se corrige con un offset medido en cada
  // carga: diferencia entre la hora que mandó el servidor y la hora local
  // en ese instante, y se le suma siempre al "ahora" del cronómetro.
  const [offsetMs, setOffsetMs] = useState(0);
  useEffect(() => {
    setOffsetMs(new Date(serverAhora).getTime() - Date.now());
  }, [serverAhora]);
  const ahoraCorregido = ahora + offsetMs;

  // Cuántos tickets no entregados lleva cada lavador ahora mismo, para
  // mostrarlo como referencia (no como bloqueo) al asignar uno nuevo.
  const enProcesoPorLavador = useMemo(() => {
    const mapa: Record<string, number> = {};
    for (const t of tickets) {
      if (t.estado !== "entregado" && t.lavador?.id) {
        mapa[t.lavador.id] = (mapa[t.lavador.id] ?? 0) + 1;
      }
    }
    return mapa;
  }, [tickets]);

  const encabezado = (
    <div>
      <h1 className="text-2xl font-bold text-foreground">Tickets</h1>
      <p className="text-sm text-muted">Tablero del turno en curso.</p>
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

  function avanzar(ticket: TicketConDetalle, nuevoEstado: TicketConDetalle["estado"]) {
    if (nuevoEstado === "entregado" && !ticket.tienePago) {
      setCobroTicket(ticket);
      setCobroYEntregar(true);
      return;
    }
    setErrorAvance(null);
    startTransition(async () => {
      const result = await actualizarEstadoTicket(ticket.id, nuevoEstado);
      if (result.error) {
        setErrorAvance(result.error);
      }
    });
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

      {errorAvance && (
        <p className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm text-primary">
          {errorAvance}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface px-5 py-3">
        <span className="whitespace-nowrap rounded-full border border-border bg-background px-3 py-1 text-xs text-foreground">
          Efectivo inicial: ${turno.efectivo_inicial.toFixed(2)}
        </span>
        {resumenCaja && (
          <>
            {!resumenCaja.ocultarEfectivo && (
              <span className="rounded-full border border-border bg-background px-3 py-1 text-xs text-foreground">
                {METODO_LABEL.efectivo}: ${(resumenCaja.totalesVisibles.efectivo ?? 0).toFixed(2)}
              </span>
            )}
            {resumenCaja.efectivoEsperado !== null && (
              <span className="rounded-full border border-border bg-background px-3 py-1 text-xs text-foreground">
                Efectivo esperado: ${resumenCaja.efectivoEsperado.toFixed(2)}
              </span>
            )}
            {(["tarjeta", "transferencia"] as const).map((m) => (
              <span
                key={m}
                className="rounded-full border border-border bg-background px-3 py-1 text-xs text-foreground"
              >
                {METODO_LABEL[m]}: ${(resumenCaja.totalesVisibles[m] ?? 0).toFixed(2)}
              </span>
            ))}
            <span className="rounded-full border border-border bg-background px-3 py-1 text-xs text-foreground">
              Ventas hoy: {resumenCaja.ventasHoy}
            </span>
            <span className="rounded-full border border-border bg-background px-3 py-1 text-xs text-foreground">
              Tiempo promedio:{" "}
              {resumenCaja.tiempoPromedioMin !== null ? formatearMinutos(resumenCaja.tiempoPromedioMin) : "—"}
            </span>
            {resumenCaja.pendientes > 0 && (
              <span className="ml-auto rounded-full border border-warning/40 bg-warning/10 px-3 py-1 text-xs font-medium text-warning">
                {resumenCaja.pendientes} sin entregar
              </span>
            )}
          </>
        )}
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
                {ticketsCol.map((ticket) => {
                  const entregado = col.estado === "entregado";
                  const totalMs = ahoraCorregido - new Date(ticket.hora_entrada).getTime();
                  const etapaMs = ahoraCorregido - new Date(ticket.hora_cambio_estado).getTime();
                  const nivel = entregado
                    ? "ok"
                    : calcularNivel(Math.floor(totalMs / 60000), config.semaforo_alerta_min, config.semaforo_critico_min);
                  return (
                  <div
                    key={ticket.id}
                    className={`hover-lift flex flex-col gap-1.5 rounded-xl border p-3 transition-colors duration-500 ${TARJETA_ESTILO[nivel]}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <button
                          type="button"
                          disabled={!ticket.cliente}
                          onClick={() => setClienteDetalleTicket(ticket)}
                          className="text-left text-sm font-semibold text-foreground disabled:cursor-default enabled:hover:text-accent enabled:hover:underline"
                        >
                          {ticket.cliente?.nombre ?? "Cliente de mostrador"}
                        </button>
                        <p className="text-xs text-muted">
                          {[ticket.vehiculo?.placas, nombreTamano(ticket.tamano_vehiculo)]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      {ticket.prioridad && (
                        <span className="rounded-full border border-accent/40 bg-accent/15 px-2 py-0.5 text-[10px] font-medium text-accent">
                          Prioridad
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-foreground">
                      {ticket.servicio?.nombre} · $
                      {precioPorTamano(ticket.servicio?.precios, ticket.tamano_vehiculo).toFixed(2)}
                      {ticket.descuento_monto > 0 && (
                        <span className="text-warning"> · -${ticket.descuento_monto.toFixed(2)} desc.</span>
                      )}
                    </p>
                    {ticket.lavador && (
                      <p className="text-xs text-muted">
                        {config.emoji_lavador} {ticket.lavador.nombre}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-1.5">
                      {ticket.tienePago && (
                        <span className="w-fit rounded-full border border-success/40 bg-success/15 px-2 py-0.5 text-[10px] text-success">
                          Pagado
                        </span>
                      )}
                    </div>

                    {entregado ? (
                      <p className="text-[11px] text-muted">
                        Entregado a las{" "}
                        {new Date(ticket.hora_salida ?? ticket.hora_cambio_estado).toLocaleTimeString("es-MX", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    ) : (
                      <div className="flex flex-col gap-0.5 text-[11px]">
                        <span className={`flex items-center gap-1.5 font-semibold ${CRONOMETRO_ESTILO[nivel]}`}>
                          {nivel === "critico" && (
                            <span className="relative flex h-2 w-2">
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                            </span>
                          )}
                          ⏱ Total: {formatearDuracion(totalMs)}
                        </span>
                        <span className="text-muted">⏳ En esta etapa: {formatearDuracion(etapaMs)}</span>
                      </div>
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
                      {col.estado !== "entregado" && col.estado !== "terminado" && !ticket.tienePago && (
                        <button
                          onClick={() => {
                            setCobroTicket(ticket);
                            setCobroYEntregar(false);
                          }}
                          className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted hover:text-foreground"
                        >
                          Cobrar
                        </button>
                      )}
                      {puedeEditarTickets && col.estado !== "entregado" && (
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
                })}
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
          lavadores={lavadores}
          enProcesoPorLavador={enProcesoPorLavador}
          config={config}
          usuarioActualId={usuarioActualId}
          onClose={() => setMostrarNuevo(false)}
        />
      )}

      {cobroTicket && (
        <CobroModal
          ticket={cobroTicket}
          turnoId={turno.id}
          onClose={() => {
            setCobroTicket(null);
            setCobroYEntregar(false);
          }}
          onPagado={() => {
            const ticketPagado = cobroTicket;
            const debeEntregar = cobroYEntregar;
            setCobroTicket(null);
            setCobroYEntregar(false);
            if (debeEntregar) {
              setErrorAvance(null);
              startTransition(async () => {
                const result = await actualizarEstadoTicket(ticketPagado.id, "entregado");
                if (result.error) {
                  setErrorAvance(result.error);
                }
              });
            }
          }}
        />
      )}

      {editarTicket && (
        <EditarTicketModal
          ticket={editarTicket}
          servicios={servicios}
          lavadores={lavadores}
          enProcesoPorLavador={enProcesoPorLavador}
          config={config}
          onClose={() => setEditarTicket(null)}
        />
      )}

      {descuentoTicket && (
        <DescuentoModal
          ticket={descuentoTicket}
          onClose={() => setDescuentoTicket(null)}
          onAutorizado={() => setDescuentoTicket(null)}
        />
      )}

      {clienteDetalleTicket?.cliente && (
        <ClienteDetalleModal
          clienteId={clienteDetalleTicket.cliente.id}
          ticketActual={{
            servicioNombre: clienteDetalleTicket.servicio?.nombre ?? null,
            empleadoNombre: clienteDetalleTicket.empleado?.nombre ?? null,
            lavadorNombre: clienteDetalleTicket.lavador?.nombre ?? null,
            placas: clienteDetalleTicket.vehiculo?.placas ?? null,
          }}
          onClose={() => setClienteDetalleTicket(null)}
        />
      )}
    </div>
  );
}

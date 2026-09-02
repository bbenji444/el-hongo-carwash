"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import type { Turno, Lavador, ConfiguracionApp, ExtraCatalogo } from "@/types/database.types";
import type { TicketConDetalle, ServicioConPrecios } from "./types";
import { sumaExtras } from "./types";
import { nombreTamano, precioPorTamano } from "@/lib/servicios";
import { AbrirTurnoForm } from "./AbrirTurnoForm";
import { NuevoTicketModal } from "./NuevoTicketModal";
import { EditarTicketModal } from "./EditarTicketModal";
import { CobroModal } from "./CobroModal";
import { DescuentoModal } from "./DescuentoModal";
import { ClienteDetalleModal } from "./ClienteDetalleModal";
import { actualizarEstadoTicket } from "./actions";
import { useRealtimeRefresh } from "@/lib/useRealtimeRefresh";

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
  tiempoEsperaMin: number | null;
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

function ordenar(tickets: TicketConDetalle[], estado: string) {
  if (estado === "entregado") {
    // Entregados: el más reciente arriba, para no tener que bajar en la
    // lista a buscar el ticket que se acaba de entregar.
    return [...tickets].sort(
      (a, b) => new Date(b.hora_salida ?? b.hora_entrada).getTime() - new Date(a.hora_salida ?? a.hora_entrada).getTime()
    );
  }
  return [...tickets].sort((a, b) => {
    if (a.prioridad !== b.prioridad) return a.prioridad ? -1 : 1;
    return new Date(a.hora_entrada).getTime() - new Date(b.hora_entrada).getTime();
  });
}

export function TicketsBoard({
  turno,
  servicios,
  lavadores,
  extras,
  tickets,
  usuarioActualId,
  resumenCaja,
  serverAhora,
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
  serverAhora: string;
  config: ConfiguracionApp;
  puedeEditarTickets: boolean;
  esDueno: boolean;
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

  useRealtimeRefresh(["tickets", "pagos", "turnos", "ticket_extras"]);

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

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Resumen del turno</p>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
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
                <p className="text-[10px] uppercase tracking-wide text-muted">Total</p>
                <p className="text-sm font-semibold text-success">
                  $
                  {(
                    (resumenCaja.ocultarEfectivo ? 0 : turno.efectivo_inicial) +
                    Object.values(resumenCaja.totalesVisibles).reduce((suma, monto) => suma + monto, 0)
                  ).toFixed(2)}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-background p-2.5">
                <p className="text-[10px] uppercase tracking-wide text-muted">Ventas hoy</p>
                <p className="text-sm font-semibold text-foreground">{resumenCaja.ventasHoy}</p>
              </div>
              <div className="rounded-lg border border-border bg-background p-2.5">
                <p className="text-[10px] uppercase tracking-wide text-muted">Tiempo de espera</p>
                <p className="text-sm font-semibold text-foreground">
                  {resumenCaja.tiempoEsperaMin !== null ? formatearMinutos(resumenCaja.tiempoEsperaMin) : "—"}
                </p>
              </div>
            </>
          )}
        </div>
        {resumenCaja && resumenCaja.pendientes > 0 && (
          <p className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs font-medium text-warning">
            {resumenCaja.pendientes} ticket(s) sin entregar en este turno.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        {COLUMNAS.map((col) => {
          const ticketsCol = ordenar(tickets.filter((t) => t.estado === col.estado), col.estado);
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
                          {ticket.cliente?.nombre ?? ticket.distintivo ?? "Cliente de mostrador"}
                        </button>
                        <p className="text-xs text-muted">
                          {[
                            ticket.cliente ? ticket.distintivo : null,
                            ticket.placa ?? ticket.vehiculo?.placas,
                            nombreTamano(ticket.tamano_vehiculo),
                          ]
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
                    {ticket.extras.length > 0 && (
                      <p className="text-xs text-accent">
                        + {ticket.extras.map((e) => e.nombre).join(", ")} · ${sumaExtras(ticket.extras).toFixed(2)}
                      </p>
                    )}
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
                      <div className="flex flex-col gap-0.5 text-[11px] text-muted">
                        <span>
                          Entregado a las{" "}
                          {new Date(ticket.hora_salida ?? ticket.hora_cambio_estado).toLocaleTimeString("es-MX", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        {ticket.hora_inicio_lavado && ticket.hora_fin_lavado && (
                          <span>
                            🧽 Lavada:{" "}
                            {formatearDuracion(
                              new Date(ticket.hora_fin_lavado).getTime() -
                                new Date(ticket.hora_inicio_lavado).getTime()
                            )}
                          </span>
                        )}
                        <span>
                          ⏱ Total desde que llegó:{" "}
                          {formatearDuracion(
                            new Date(ticket.hora_salida ?? ticket.hora_cambio_estado).getTime() -
                              new Date(ticket.hora_entrada).getTime()
                          )}
                        </span>
                      </div>
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
                          Precio especial
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
                      {puedeEditarTickets && (col.estado !== "entregado" || esDueno) && (
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
          extras={extras}
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
          extras={extras}
          enProcesoPorLavador={enProcesoPorLavador}
          config={config}
          esDueno={esDueno}
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
            distintivo: clienteDetalleTicket.distintivo,
            placa: clienteDetalleTicket.placa ?? clienteDetalleTicket.vehiculo?.placas ?? null,
          }}
          onClose={() => setClienteDetalleTicket(null)}
        />
      )}
    </div>
  );
}

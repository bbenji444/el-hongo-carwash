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
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { TarjetaTicket } from "./TarjetaTicket";

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
  const [busqueda, setBusqueda] = useState("");
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
  // Buscador: busca en todo lo que se ve en la tarjeta (distintivo, placa,
  // cliente, lavador, paquete, tamaño, extras, método de pago), sin
  // distinguir mayúsculas ni acentos.
  const normalizar = (v: string) => v.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const terminos = normalizar(busqueda).split(/s+/).filter(Boolean);
  function coincide(t: TicketConDetalle) {
    if (terminos.length === 0) return true;
    const texto = normalizar(
      [
        t.distintivo,
        t.placa,
        t.vehiculo?.placas,
        t.cliente?.nombre,
        t.servicio?.nombre,
        nombreTamano(t.tamano_vehiculo),
        ...t.lavadores.map((l) => l.nombre),
        ...t.extras.map((e) => e.nombre),
        t.metodoPago ? METODO_LABEL[t.metodoPago] ?? t.metodoPago : null,
      ]
        .filter(Boolean)
        .join(" ")
    );
    return terminos.every((term) => texto.includes(term));
  }

  const pendientes = tickets.filter((t) => t.estado !== "entregado" && coincide(t));
  const totalRegistrados = tickets.filter((t) => t.estado === "entregado").length;
  const registrados = tickets
    .filter((t) => t.estado === "entregado" && coincide(t))
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

  function tarjeta(ticket: TicketConDetalle, esPendiente: boolean, indice: number) {
    return (
      <TarjetaTicket key={ticket.id} metodoPago={ticket.metodoPago} indice={indice}>
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
          <span className="shrink-0 rounded-full border border-border bg-background px-2 py-0.5 text-sm font-bold text-foreground transition-colors duration-300 group-hover:border-[var(--acento)] group-hover:text-[var(--acento)]">
            ${totalTicket(ticket).toFixed(2)}
          </span>
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
      </TarjetaTicket>
    );
  }

  // Casillas del resumen del turno: aparecen escalonadas y los montos
  // cuentan hacia arriba (AnimatedNumber).
  const casillas: { etiqueta: string; valor: number; formato: "dinero" | "entero"; destacada?: boolean }[] = [
    { etiqueta: "Efectivo inicial", valor: turno.efectivo_inicial, formato: "dinero" },
    ...(resumenCaja
      ? [
          ...(!resumenCaja.ocultarEfectivo
            ? [{ etiqueta: METODO_LABEL.efectivo, valor: resumenCaja.totalesVisibles.efectivo ?? 0, formato: "dinero" as const }]
            : []),
          ...(resumenCaja.efectivoEsperado !== null
            ? [{ etiqueta: "Efectivo esperado", valor: resumenCaja.efectivoEsperado, formato: "dinero" as const }]
            : []),
          ...(["tarjeta", "transferencia"] as const).map((m) => ({
            etiqueta: METODO_LABEL[m],
            valor: resumenCaja.totalesVisibles[m] ?? 0,
            formato: "dinero" as const,
          })),
          {
            etiqueta: "Ganancia",
            valor: Object.values(resumenCaja.totalesVisibles).reduce((suma, monto) => suma + monto, 0),
            formato: "dinero" as const,
            destacada: true,
          },
          { etiqueta: "Autos hoy", valor: resumenCaja.ventasHoy, formato: "entero" as const },
        ]
      : []),
  ];

  return (
    <MotionConfig reducedMotion="user">
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        {encabezado}
        <motion.button
          onClick={() => setMostrarNuevo(true)}
          whileHover={{ scale: 1.04, y: -2 }}
          whileTap={{ scale: 0.96 }}
          transition={{ type: "spring", stiffness: 450, damping: 22 }}
          className="relative overflow-hidden rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-primary/20 transition-colors hover:bg-primary-hover hover:shadow-primary/40"
        >
          <span className="relative z-10">+ Nuevo ticket</span>
          <motion.span
            aria-hidden
            className="absolute inset-y-0 -left-1/2 w-1/2 -skew-x-12 bg-white/25"
            initial={{ x: "-100%" }}
            animate={{ x: "400%" }}
            transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 3.5, ease: "easeInOut" }}
          />
        </motion.button>
      </div>

      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm text-primary"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Resumen del turno</p>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
          {casillas.map((c, i) => (
            <motion.div
              key={c.etiqueta}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.35, ease: "easeOut" } }}
              whileHover={{ y: -3, transition: { type: "spring", stiffness: 420, damping: 24 } }}
              className={`rounded-lg border p-2.5 transition-shadow duration-300 hover:shadow-md ${
                c.destacada ? "border-success/40 bg-success/10" : "border-border bg-background"
              }`}
            >
              <p className="text-[10px] uppercase tracking-wide text-muted">{c.etiqueta}</p>
              <p className={`text-sm font-semibold ${c.destacada ? "text-success" : "text-foreground"}`}>
                <AnimatedNumber value={c.valor} format={c.formato} />
              </p>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="group relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted transition-transform duration-300 group-focus-within:scale-110">
          🔍
        </span>
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar carro de este turno: distintivo, placa, cliente, lavador, paquete..."
          className="w-full rounded-xl border border-border bg-surface py-2.5 pl-10 pr-3 text-sm text-foreground outline-none transition-all duration-300 focus:border-accent focus:shadow-[0_0_0_4px_color-mix(in_srgb,var(--accent)_15%,transparent)]"
        />
      </div>

      {pendientes.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-warning">
            Pendientes de antes del cambio ({pendientes.length}) — toca ✓ para cobrar y cerrar
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <AnimatePresence mode="popLayout">{pendientes.map((t, i) => tarjeta(t, true, i))}</AnimatePresence>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <motion.p
          key={busqueda.trim() ? "busqueda" : "todos"}
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          className="text-xs font-semibold uppercase tracking-wide text-muted"
        >
          {busqueda.trim()
            ? `Resultados: ${registrados.length} de ${totalRegistrados}`
            : `Registrados en este turno (${registrados.length})`}
        </motion.p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <AnimatePresence mode="popLayout">{registrados.map((t, i) => tarjeta(t, false, i))}</AnimatePresence>
        </div>
        <AnimatePresence>
          {registrados.length === 0 && (
            <motion.p
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted"
            >
              {busqueda.trim()
                ? "Ningún carro de este turno coincide con la búsqueda."
                : "Todavía no hay autos registrados en este turno."}
            </motion.p>
          )}
        </AnimatePresence>
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
    </MotionConfig>
  );
}

"use client";

import { useMemo, useState } from "react";
import type { ConfiguracionApp, Lavador, ExtraCatalogo, PagoMetodo } from "@/types/database.types";
import { nombreTamano } from "@/lib/servicios";
import type { ServicioConPrecios, TicketConDetalle } from "../../../tickets/types";
import { EditarTicketModal } from "../../../tickets/EditarTicketModal";

export type TicketDesglose = TicketConDetalle & {
  pagos: { monto: number; metodo: PagoMetodo }[];
  montoTotal: number;
};

function money(n: number) {
  return `$${n.toFixed(2)}`;
}

const METODO_LABEL: Record<PagoMetodo, string> = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  transferencia: "Transferencia",
  membresia: "Membresía",
};

const ESTADO_LABEL: Record<string, string> = {
  en_espera: "En espera",
  en_proceso: "En proceso",
  terminado: "Terminado",
  entregado: "Entregado",
};

export function DesgloseTurnoTabla({
  tickets,
  hayFiltro,
  servicios,
  lavadores,
  extras,
  config,
  esDueno,
  puedeEditarTickets,
}: {
  tickets: TicketDesglose[];
  hayFiltro: boolean;
  servicios: ServicioConPrecios[];
  lavadores: Lavador[];
  extras: ExtraCatalogo[];
  config: ConfiguracionApp;
  esDueno: boolean;
  puedeEditarTickets: boolean;
}) {
  const [editando, setEditando] = useState<TicketDesglose | null>(null);

  // Cuántos tickets no entregados lleva cada lavador dentro de este turno,
  // solo como referencia al reasignar uno (no bloquea la selección).
  const enProcesoPorLavador = useMemo(() => {
    const mapa: Record<string, number> = {};
    for (const t of tickets) {
      if (t.estado !== "entregado" && t.lavador?.id) {
        mapa[t.lavador.id] = (mapa[t.lavador.id] ?? 0) + 1;
      }
    }
    return mapa;
  }, [tickets]);

  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-hover text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Hora</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Distintivo</th>
              <th className="px-4 py-3">Paquete</th>
              <th className="px-4 py-3">Tamaño</th>
              <th className="px-4 py-3">Empleado</th>
              <th className="px-4 py-3">Lavador</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Método</th>
              <th className="px-4 py-3">Monto</th>
              {puedeEditarTickets && <th className="px-4 py-3 text-right">Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {tickets.map((t) => (
              <tr key={t.id} className="border-t border-border transition-colors hover:bg-surface-hover">
                <td className="px-4 py-3 text-muted">
                  {new Date(t.hora_entrada).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
                </td>
                <td className="px-4 py-3 text-foreground">
                  {t.cliente ? t.cliente.nombre : (t.distintivo ?? "Mostrador")}
                </td>
                <td className="px-4 py-3 text-muted">
                  {[t.cliente ? t.distintivo : null, t.placa ?? t.vehiculo?.placas].filter(Boolean).join(" · ") || "—"}
                </td>
                <td className="px-4 py-3 text-foreground">
                  {t.servicio?.nombre ?? "—"}
                  {t.descuento_monto > 0 && <span className="text-warning"> · -{money(t.descuento_monto)}</span>}
                </td>
                <td className="px-4 py-3 text-muted">{nombreTamano(t.tamano_vehiculo)}</td>
                <td className="px-4 py-3 text-foreground">{t.empleado?.nombre ?? "—"}</td>
                <td className="px-4 py-3 text-muted">{t.lavador?.nombre ?? "—"}</td>
                <td className="px-4 py-3 text-muted">{ESTADO_LABEL[t.estado] ?? t.estado}</td>
                <td className="px-4 py-3 text-muted">
                  {t.lavada_gratis
                    ? "Gratis"
                    : t.pagos.length > 0
                      ? t.pagos.map((p) => METODO_LABEL[p.metodo]).join(", ")
                      : "—"}
                </td>
                <td className="px-4 py-3 font-medium text-foreground">{money(t.montoTotal)}</td>
                {puedeEditarTickets && (
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => setEditando(t)} className="text-xs text-accent hover:underline">
                      Editar
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {tickets.length === 0 && (
              <tr>
                <td colSpan={puedeEditarTickets ? 11 : 10} className="px-4 py-6 text-center text-muted">
                  {hayFiltro ? "Ningún ticket coincide con este filtro." : "Sin tickets en este turno."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editando && (
        <EditarTicketModal
          ticket={editando}
          servicios={servicios}
          lavadores={lavadores}
          extras={extras}
          enProcesoPorLavador={enProcesoPorLavador}
          config={config}
          esDueno={esDueno}
          onClose={() => setEditando(null)}
        />
      )}
    </>
  );
}

"use client";

import { useState, useTransition } from "react";
import type { Turno } from "@/types/database.types";
import { EditarTurnoModal } from "./EditarTurnoModal";
import { eliminarTurno } from "./actions";

type TurnoConNombres = Turno & {
  nombreApertura: string;
  nombreCierre: string;
  ganancia: number;
  total: number;
  transferencia: number;
  tarjeta: number;
};

export function HistorialTurnos({
  historial,
  puedeEditar,
  puedeEliminar,
}: {
  historial: TurnoConNombres[];
  puedeEditar: boolean;
  puedeEliminar: boolean;
}) {
  const [editando, setEditando] = useState<TurnoConNombres | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const mostrarAcciones = puedeEditar || puedeEliminar;

  function handleEliminar(t: TurnoConNombres) {
    if (
      !window.confirm(
        `¿Eliminar por completo el turno del ${new Date(t.hora_apertura).toLocaleString("es-MX")}? Esto borra también todos sus tickets y pagos. Esta acción no se puede deshacer.`
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await eliminarTurno(t.id);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface text-left text-xs uppercase text-muted">
            <tr>
              <th className="px-3 py-2">Apertura</th>
              <th className="px-3 py-2">Cierre</th>
              <th className="px-3 py-2">Abrió</th>
              <th className="px-3 py-2">Cerró</th>
              <th className="px-3 py-2 text-right">Inicial</th>
              <th className="px-3 py-2 text-right">Efectivo esperado</th>
              <th className="px-3 py-2 text-right">Efectivo contado</th>
              <th className="px-3 py-2 text-right">Diferencia</th>
              <th className="px-3 py-2 text-right">Tarjeta</th>
              <th className="px-3 py-2 text-right">Transferencia</th>
              <th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2 text-right">Ganancia</th>
              {mostrarAcciones && <th className="px-3 py-2 text-right">Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {historial.map((t) => (
              <tr key={t.id} className={`border-t border-border ${t.alerta_diferencia ? "bg-primary/5" : ""}`}>
                <td className="px-3 py-2 text-muted">{new Date(t.hora_apertura).toLocaleString("es-MX")}</td>
                <td className="px-3 py-2 text-muted">
                  {t.hora_cierre ? new Date(t.hora_cierre).toLocaleString("es-MX") : "—"}
                </td>
                <td className="px-3 py-2 text-foreground">{t.nombreApertura}</td>
                <td className="px-3 py-2 text-foreground">{t.nombreCierre}</td>
                <td className="px-3 py-2 text-right text-foreground">${t.efectivo_inicial.toFixed(2)}</td>
                <td className="px-3 py-2 text-right text-foreground">
                  {t.efectivo_esperado != null ? `$${t.efectivo_esperado.toFixed(2)}` : "—"}
                </td>
                <td className="px-3 py-2 text-right text-foreground">
                  {t.efectivo_contado != null ? `$${t.efectivo_contado.toFixed(2)}` : "—"}
                </td>
                <td
                  className={`px-3 py-2 text-right font-medium ${
                    t.alerta_diferencia ? "text-primary" : "text-success"
                  }`}
                >
                  {t.diferencia != null ? `$${t.diferencia.toFixed(2)}` : "—"}
                </td>
                <td className="px-3 py-2 text-right text-foreground">${t.tarjeta.toFixed(2)}</td>
                <td className="px-3 py-2 text-right text-foreground">${t.transferencia.toFixed(2)}</td>
                <td className="px-3 py-2 text-right font-medium text-foreground">${t.total.toFixed(2)}</td>
                <td className="px-3 py-2 text-right font-semibold text-success">${t.ganancia.toFixed(2)}</td>
                {mostrarAcciones && (
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-2">
                      {puedeEditar && (
                        <button onClick={() => setEditando(t)} className="text-xs text-accent hover:underline">
                          Editar
                        </button>
                      )}
                      {puedeEliminar && (
                        <button
                          onClick={() => handleEliminar(t)}
                          disabled={pending}
                          className="text-xs text-primary hover:underline disabled:opacity-60"
                        >
                          Eliminar
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {historial.length === 0 && (
              <tr>
                <td colSpan={mostrarAcciones ? 13 : 12} className="px-3 py-6 text-center text-muted">
                  Sin turnos cerrados aún.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {error && (
        <p className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm text-primary">{error}</p>
      )}

      {editando && <EditarTurnoModal turno={editando} onClose={() => setEditando(null)} />}
    </div>
  );
}

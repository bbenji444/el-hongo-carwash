"use client";

import { useState } from "react";
import type { Turno } from "@/types/database.types";
import { EditarTurnoModal } from "./EditarTurnoModal";

type TurnoConNombres = Turno & { nombreApertura: string; nombreCierre: string };

export function HistorialTurnos({
  historial,
  puedeEditar,
}: {
  historial: TurnoConNombres[];
  puedeEditar: boolean;
}) {
  const [editando, setEditando] = useState<TurnoConNombres | null>(null);

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead className="bg-surface text-left text-xs uppercase text-muted">
          <tr>
            <th className="px-3 py-2">Apertura</th>
            <th className="px-3 py-2">Cierre</th>
            <th className="px-3 py-2">Abrió</th>
            <th className="px-3 py-2">Cerró</th>
            <th className="px-3 py-2 text-right">Inicial</th>
            <th className="px-3 py-2 text-right">Esperado</th>
            <th className="px-3 py-2 text-right">Contado</th>
            <th className="px-3 py-2 text-right">Diferencia</th>
            {puedeEditar && <th className="px-3 py-2 text-right">Acciones</th>}
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
              {puedeEditar && (
                <td className="px-3 py-2 text-right">
                  <button
                    onClick={() => setEditando(t)}
                    className="text-xs text-accent hover:underline"
                  >
                    Editar
                  </button>
                </td>
              )}
            </tr>
          ))}
          {historial.length === 0 && (
            <tr>
              <td colSpan={puedeEditar ? 9 : 8} className="px-3 py-6 text-center text-muted">
                Sin turnos cerrados aún.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {editando && <EditarTurnoModal turno={editando} onClose={() => setEditando(null)} />}
    </div>
  );
}

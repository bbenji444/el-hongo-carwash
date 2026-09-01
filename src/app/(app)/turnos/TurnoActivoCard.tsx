"use client";

import { useState, useTransition } from "react";
import type { Turno } from "@/types/database.types";
import { cerrarTurno, eliminarTurno } from "./actions";

const METODO_LABEL: Record<string, string> = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  transferencia: "Transferencia",
};

type Resumen = {
  totalesVisibles: Record<string, number>;
  efectivoEsperado: number | null;
  pendientes: number;
  ocultarEfectivo: boolean;
};

export function TurnoActivoCard({
  turno,
  resumen,
  puedeEliminar,
}: {
  turno: Turno;
  resumen: Resumen;
  puedeEliminar: boolean;
}) {
  const [efectivoContado, setEfectivoContado] = useState("");
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleCerrar() {
    setError(null);
    const monto = Number(efectivoContado);
    if (!Number.isFinite(monto) || monto < 0) {
      setError("Ingresa el efectivo contado en caja.");
      return;
    }
    if (resumen.pendientes > 0 && !confirmando) {
      setConfirmando(true);
      return;
    }

    startTransition(async () => {
      const result = await cerrarTurno(turno.id, monto);
      if (result.error) {
        setError(result.error);
        return;
      }
    });
  }

  function handleEliminar() {
    if (
      !window.confirm(
        "¿Eliminar por completo este turno abierto? Esto borra también todos sus tickets y pagos registrados hasta ahora. Esta acción no se puede deshacer."
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await eliminarTurno(turno.id);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm text-muted">
            Turno abierto desde{" "}
            <span className="text-foreground">
              {new Date(turno.hora_apertura).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </p>
          <p className="text-xs text-muted">Efectivo inicial: ${turno.efectivo_inicial.toFixed(2)}</p>
        </div>
        {puedeEliminar && (
          <button
            onClick={handleEliminar}
            disabled={pending}
            className="text-xs text-primary hover:underline disabled:opacity-60"
          >
            Eliminar turno
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {!resumen.ocultarEfectivo && (
          <div className="rounded-lg border border-border bg-background p-3">
            <p className="text-[10px] uppercase tracking-wide text-muted">Efectivo</p>
            <p className="text-sm font-semibold text-foreground">
              ${(resumen.totalesVisibles.efectivo ?? 0).toFixed(2)}
            </p>
          </div>
        )}
        {(["tarjeta", "transferencia"] as const).map((m) => (
          <div key={m} className="rounded-lg border border-border bg-background p-3">
            <p className="text-[10px] uppercase tracking-wide text-muted">{METODO_LABEL[m]}</p>
            <p className="text-sm font-semibold text-foreground">
              ${(resumen.totalesVisibles[m] ?? 0).toFixed(2)}
            </p>
          </div>
        ))}
        <div className="rounded-lg border border-success/40 bg-success/10 p-3">
          <p className="text-[10px] uppercase tracking-wide text-muted">Total</p>
          <p className="text-sm font-semibold text-success">
            $
            {(
              (resumen.ocultarEfectivo ? 0 : turno.efectivo_inicial) +
              Object.values(resumen.totalesVisibles).reduce((suma, monto) => suma + monto, 0)
            ).toFixed(2)}
          </p>
        </div>
      </div>

      {resumen.pendientes > 0 && (
        <p className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
          {resumen.pendientes} ticket(s) sin entregar en este turno.
        </p>
      )}

      <div className="flex flex-col gap-2 border-t border-border pt-4">
        {resumen.ocultarEfectivo ? (
          <p className="text-xs text-muted">
            Cuenta el efectivo físico en caja y regístralo abajo. El sistema comparará el total contra lo
            esperado al cerrar el turno.
          </p>
        ) : (
          <p className="text-xs text-muted">Efectivo esperado: ${resumen.efectivoEsperado!.toFixed(2)}</p>
        )}

        <label className="text-xs font-medium text-muted">Efectivo contado</label>
        <input
          value={efectivoContado}
          onChange={(e) => {
            setEfectivoContado(e.target.value);
            setConfirmando(false);
          }}
          type="number"
          min="0"
          step="0.01"
          className="w-full max-w-xs rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
        />

        {error && (
          <p className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm text-primary">
            {error}
          </p>
        )}

        {confirmando && (
          <p className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
            Hay tickets sin entregar en este turno. Presiona de nuevo para cerrar de todas formas.
          </p>
        )}

        <button
          onClick={handleCerrar}
          disabled={pending}
          className="w-fit rounded-lg bg-primary px-4 py-2.5 font-semibold text-white transition hover:bg-primary-hover disabled:opacity-60"
        >
          {pending ? "Cerrando..." : confirmando ? "Confirmar cierre" : "Cerrar turno"}
        </button>
      </div>
    </div>
  );
}

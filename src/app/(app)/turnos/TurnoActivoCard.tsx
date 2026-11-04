"use client";

import { useState, useTransition } from "react";
import { CalendarClock } from "lucide-react";
import type { Turno } from "@/types/database.types";
import { esTurnoDeOtroDia, horaMX, nombreDiaTurno } from "@/lib/turnoDia";
import { cerrarTurno, eliminarTurno } from "./actions";

const HORA_CIERRE_DIA_ANTERIOR = "20:00";

// Hora de cierre sugerida: la de ahora si el turno es de hoy; si es de un
// día anterior, las 8 p. m. de ese día (o después del último auto, si se
// registró alguno más tarde).
function horaCierreSugerida(turno: Turno, ultimoRegistro: string | null) {
  if (!esTurnoDeOtroDia(turno.hora_apertura)) return horaMX(new Date());
  const minimo = [horaMX(turno.hora_apertura), ultimoRegistro ? horaMX(ultimoRegistro) : "00:00"].sort().at(-1)!;
  return minimo > HORA_CIERRE_DIA_ANTERIOR ? minimo : HORA_CIERRE_DIA_ANTERIOR;
}

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
  ultimoRegistro,
}: {
  turno: Turno;
  resumen: Resumen;
  puedeEliminar: boolean;
  // hora_entrada del último auto registrado en el turno (si hay)
  ultimoRegistro: string | null;
}) {
  const [efectivoContado, setEfectivoContado] = useState("");
  const [horaCierre, setHoraCierre] = useState(() => horaCierreSugerida(turno, ultimoRegistro));
  const deOtroDia = esTurnoDeOtroDia(turno.hora_apertura);
  const nombreDia = nombreDiaTurno(turno.hora_apertura);
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleCerrar() {
    setError(null);
    const monto = Number(efectivoContado);
    if (efectivoContado.trim() === "" || !Number.isFinite(monto) || monto < 0) {
      setError("Ingresa el efectivo contado en caja.");
      return;
    }
    if (!horaCierre) {
      setError("Elige la hora de cierre del turno.");
      return;
    }
    if (horaCierre < horaMX(turno.hora_apertura)) {
      setError(`La hora de cierre no puede ser antes de que empezara el turno (${horaMX(turno.hora_apertura)}).`);
      return;
    }
    if (!deOtroDia && horaCierre > horaMX(new Date())) {
      setError("La hora de cierre no puede ser en el futuro.");
      return;
    }
    if (ultimoRegistro && horaCierre < horaMX(ultimoRegistro)) {
      setError(`La hora de cierre no puede ser antes del último auto registrado (${horaMX(ultimoRegistro)}).`);
      return;
    }
    if (resumen.pendientes > 0 && !confirmando) {
      setConfirmando(true);
      return;
    }

    startTransition(async () => {
      const result = await cerrarTurno(turno.id, monto, horaCierre);
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
          <p className="text-sm font-semibold text-foreground" suppressHydrationWarning>
            Turno de {nombreDia}
          </p>
          <p className="text-sm text-muted">
            Abierto desde las{" "}
            <span className="text-foreground">
              {new Date(turno.hora_apertura).toLocaleTimeString("es-MX", {
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "America/Mexico_City",
              })}
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

      {deOtroDia && (
        <p className="flex items-start gap-2 rounded-lg border border-warning/60 bg-warning/15 px-3 py-2 text-sm text-foreground">
          <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <span>
            Este turno es de un día anterior: los autos registrados en él quedan con su fecha. Ciérralo con la hora en
            que terminó ese día.
          </span>
        </p>
      )}

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

        <div className="flex flex-wrap gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="cierre-efectivo" className="text-xs font-medium text-muted">
              Efectivo contado
            </label>
            <input
              id="cierre-efectivo"
              value={efectivoContado}
              onChange={(e) => {
                setEfectivoContado(e.target.value);
                setConfirmando(false);
              }}
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              className="w-44 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="cierre-hora" className="text-xs font-medium text-muted">
              Hora de cierre {deOtroDia ? "(de ese día)" : ""}
            </label>
            <input
              id="cierre-hora"
              type="time"
              value={horaCierre}
              onChange={(e) => {
                setHoraCierre(e.target.value);
                setConfirmando(false);
              }}
              className="w-36 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
              suppressHydrationWarning
            />
          </div>
        </div>

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

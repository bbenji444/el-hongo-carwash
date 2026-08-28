"use client";

import { useState, useTransition } from "react";
import type { Turno } from "@/types/database.types";
import { editarTurnoCerrado } from "./actions";

export function EditarTurnoModal({ turno, onClose }: { turno: Turno; onClose: () => void }) {
  const [efectivoInicial, setEfectivoInicial] = useState(String(turno.efectivo_inicial));
  const [efectivoContado, setEfectivoContado] = useState(String(turno.efectivo_contado ?? ""));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleGuardar() {
    setError(null);
    const inicial = Number(efectivoInicial);
    const contado = Number(efectivoContado);

    if (!Number.isFinite(inicial) || inicial < 0) {
      setError("Ingresa un efectivo inicial válido.");
      return;
    }
    if (!Number.isFinite(contado) || contado < 0) {
      setError("Ingresa un efectivo contado válido.");
      return;
    }

    startTransition(async () => {
      const result = await editarTurnoCerrado(turno.id, { efectivoInicial: inicial, efectivoContado: contado });
      if (result.error) {
        setError(result.error);
        return;
      }
      onClose();
    });
  }

  return (
    <div className="animate-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="animate-modal w-full max-w-sm rounded-xl border border-border bg-surface p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">Editar turno cerrado</h2>
          <button onClick={onClose} className="text-muted hover:text-foreground">
            ✕
          </button>
        </div>

        <p className="mb-4 text-xs text-muted">
          Corrige el efectivo inicial o el efectivo contado de este cierre. El efectivo esperado y la diferencia
          se vuelven a calcular solos con estos valores.
        </p>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted">Efectivo inicial</label>
            <input
              value={efectivoInicial}
              onChange={(e) => setEfectivoInicial(e.target.value)}
              type="number"
              min="0"
              step="0.01"
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted">Efectivo contado</label>
            <input
              value={efectivoContado}
              onChange={(e) => setEfectivoContado(e.target.value)}
              type="number"
              min="0"
              step="0.01"
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
            />
          </div>

          {error && (
            <p className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm text-primary">
              {error}
            </p>
          )}

          <button
            onClick={handleGuardar}
            disabled={pending}
            className="rounded-lg bg-primary px-4 py-2.5 font-semibold text-white transition hover:bg-primary-hover disabled:opacity-60"
          >
            {pending ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useTransition, type FormEvent } from "react";
import { abrirTurno } from "./actions";

export function AbrirTurnoForm() {
  const [efectivoInicial, setEfectivoInicial] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const monto = Number(efectivoInicial);
    if (!Number.isFinite(monto) || monto < 0) {
      setError("Ingresa un monto válido.");
      return;
    }

    startTransition(async () => {
      const result = await abrirTurno(monto);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-primary/40 bg-primary/5 p-10 text-center">
      <div>
        <p className="text-lg font-semibold text-foreground">No hay un turno abierto</p>
        <p className="text-sm text-muted">
          Debes abrir un turno con el efectivo inicial de caja antes de crear tickets.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="flex items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted">Efectivo inicial</label>
          <input
            value={efectivoInicial}
            onChange={(e) => setEfectivoInicial(e.target.value)}
            type="number"
            min="0"
            step="0.01"
            className="w-40 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
            placeholder="0.00"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:opacity-60"
        >
          {pending ? "Abriendo..." : "Abrir turno"}
        </button>
      </form>
      {error && <p className="text-sm text-primary">{error}</p>}
    </div>
  );
}

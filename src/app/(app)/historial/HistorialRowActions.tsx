"use client";

import { useState, useTransition } from "react";
import { editarMovimientoHistorial, eliminarMovimientoHistorial } from "./actions";

export function HistorialRowActions({ id, resumenActual }: { id: string; resumenActual: string }) {
  const [editando, setEditando] = useState(false);
  const [resumen, setResumen] = useState(resumenActual);
  const [eliminado, setEliminado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function guardar() {
    setError(null);
    startTransition(async () => {
      const { error } = await editarMovimientoHistorial(id, resumen);
      if (error) setError(error);
      else setEditando(false);
    });
  }

  function borrar() {
    if (!confirm("¿Eliminar este movimiento del histórico? No se puede deshacer.")) return;
    setError(null);
    startTransition(async () => {
      const { error } = await eliminarMovimientoHistorial(id);
      if (error) setError(error);
      else setEliminado(true);
    });
  }

  if (eliminado) return null;

  if (editando) {
    return (
      <div className="mt-1.5 flex flex-col gap-1.5">
        <textarea
          value={resumen}
          onChange={(e) => setResumen(e.target.value)}
          rows={2}
          className="rounded-lg border border-border bg-background px-2 py-1 text-xs text-foreground outline-none focus:border-accent"
        />
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={guardar}
            disabled={pending}
            className="text-xs font-medium text-accent hover:underline disabled:opacity-60"
          >
            Guardar
          </button>
          <button
            type="button"
            onClick={() => {
              setEditando(false);
              setResumen(resumenActual);
              setError(null);
            }}
            className="text-xs text-muted hover:underline"
          >
            Cancelar
          </button>
        </div>
        {error && <p className="text-xs text-primary">{error}</p>}
      </div>
    );
  }

  return (
    <div className="mt-1.5 flex items-center gap-3">
      <button type="button" onClick={() => setEditando(true)} className="text-xs text-accent hover:underline">
        Editar
      </button>
      <button
        type="button"
        onClick={borrar}
        disabled={pending}
        className="text-xs text-muted hover:text-primary hover:underline disabled:opacity-60"
      >
        Eliminar
      </button>
      {error && <p className="text-xs text-primary">{error}</p>}
    </div>
  );
}

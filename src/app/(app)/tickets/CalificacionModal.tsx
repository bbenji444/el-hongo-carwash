"use client";

import { useState, useTransition } from "react";
import { registrarCalificacion } from "./actions";

function caritaPara(valor: number) {
  if (valor <= 3) return "😠";
  if (valor <= 6) return "😐";
  if (valor <= 8) return "🙂";
  return "😄";
}

// Gradiente rojo -> amarillo -> verde a lo largo de los 10 botones, para que
// la calificación se sienta visual (semáforo) y no solo un número suelto.
const COLOR_POR_VALOR = [
  "#dc2626",
  "#e0521f",
  "#e37e17",
  "#e5a30f",
  "#d9c00d",
  "#b8c412",
  "#8fc317",
  "#5fbf1e",
  "#2fb827",
  "#16a34a",
];

export function CalificacionModal({ ticketId, onClose }: { ticketId: string; onClose: () => void }) {
  const [seleccion, setSeleccion] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const mostrado = hover ?? seleccion;

  function handleGuardar() {
    if (!seleccion) return;
    setError(null);
    startTransition(async () => {
      const result = await registrarCalificacion(ticketId, seleccion);
      if (result.error) {
        setError(result.error);
        return;
      }
      onClose();
    });
  }

  return (
    <div className="animate-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="animate-modal w-full max-w-sm rounded-xl border border-border bg-surface p-6 text-center">
        <h2 className="text-lg font-bold text-foreground">¿Cómo calificó el cliente el lavado?</h2>
        <p className="mt-1 text-xs text-muted">Opcional — ayuda a medir la satisfacción del cliente por lavador.</p>

        <div className="mt-4 text-5xl">{mostrado ? caritaPara(mostrado) : "🤔"}</div>

        <div className="mt-4 grid grid-cols-5 gap-2 sm:grid-cols-10">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(null)}
              onClick={() => setSeleccion(n)}
              className={`rounded-lg py-2 text-sm font-semibold text-white transition ${
                seleccion === n ? "ring-2 ring-foreground ring-offset-2 ring-offset-surface" : ""
              }`}
              style={{ backgroundColor: COLOR_POR_VALOR[n - 1] }}
            >
              {n}
            </button>
          ))}
        </div>

        {error && <p className="mt-3 text-sm text-primary">{error}</p>}

        <div className="mt-5 flex gap-2">
          <button
            onClick={handleGuardar}
            disabled={!seleccion || pending}
            className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:opacity-60"
          >
            {pending ? "Guardando..." : "Guardar calificación"}
          </button>
          <button
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2.5 text-sm text-muted transition hover:text-foreground"
          >
            Omitir
          </button>
        </div>
      </div>
    </div>
  );
}

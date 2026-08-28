"use client";

import { useState, useTransition } from "react";
import { solicitarDescuento } from "./actions";
import { sumaExtras } from "./types";
import type { TicketConDetalle } from "./types";
import { precioPorTamano } from "@/lib/servicios";

export function DescuentoModal({
  ticket,
  onClose,
  onAutorizado,
}: {
  ticket: TicketConDetalle;
  onClose: () => void;
  onAutorizado: () => void;
}) {
  const precioBase = precioPorTamano(ticket.servicio?.precios, ticket.tamano_vehiculo) + sumaExtras(ticket.extras);

  const [precioFinal, setPrecioFinal] = useState(String(precioBase.toFixed(2)));
  const [autorizadorNombre, setAutorizadorNombre] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit() {
    setError(null);
    const precioFinalNum = Number(precioFinal);
    if (!Number.isFinite(precioFinalNum) || precioFinalNum < 0) {
      setError("Ingresa un precio final válido.");
      return;
    }
    if (precioFinalNum > precioBase) {
      setError("El precio final no puede ser mayor al precio original.");
      return;
    }
    if (!autorizadorNombre.trim()) {
      setError("Escribe el nombre de quien autoriza este precio.");
      return;
    }

    startTransition(async () => {
      const result = await solicitarDescuento({
        ticketId: ticket.id,
        precioFinal: precioFinalNum,
        autorizadorNombre: autorizadorNombre.trim(),
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      onAutorizado();
    });
  }

  return (
    <div className="animate-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="animate-modal w-full max-w-sm rounded-xl border border-border bg-surface p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">Precio especial</h2>
          <button onClick={onClose} className="text-muted hover:text-foreground">
            ✕
          </button>
        </div>

        <p className="mb-4 text-sm text-muted">Precio original: ${precioBase.toFixed(2)}</p>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted">Precio final</label>
            <input
              value={precioFinal}
              onChange={(e) => setPrecioFinal(e.target.value)}
              type="number"
              min="0"
              step="0.01"
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted">Nombre de quien autoriza</label>
            <input
              value={autorizadorNombre}
              onChange={(e) => setAutorizadorNombre(e.target.value)}
              placeholder="Ej. María López"
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
            />
          </div>

          {error && (
            <p className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm text-primary">
              {error}
            </p>
          )}

          <button
            onClick={handleSubmit}
            disabled={pending}
            className="rounded-lg bg-primary px-4 py-2.5 font-semibold text-white transition hover:bg-primary-hover disabled:opacity-60"
          >
            {pending ? "Guardando..." : "Aplicar precio"}
          </button>
        </div>
      </div>
    </div>
  );
}

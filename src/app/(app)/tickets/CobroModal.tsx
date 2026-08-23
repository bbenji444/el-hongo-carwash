"use client";

import { useState, useTransition } from "react";
import type { PagoMetodo } from "@/types/database.types";
import { registrarPago } from "./actions";
import type { TicketConDetalle } from "./types";

const METODOS: { value: PagoMetodo; label: string }[] = [
  { value: "efectivo", label: "Efectivo" },
  { value: "tarjeta", label: "Tarjeta" },
  { value: "transferencia", label: "Transferencia" },
];

export function CobroModal({
  ticket,
  turnoId,
  onClose,
  onPagado,
}: {
  ticket: TicketConDetalle;
  turnoId: string;
  onClose: () => void;
  onPagado: () => void;
}) {
  const precioBase = ticket.servicio?.precio ?? 0;
  const totalSugerido = Math.max(precioBase - ticket.descuento_monto, 0);

  const [metodo, setMetodo] = useState<PagoMetodo>("efectivo");
  const [monto, setMonto] = useState(String(totalSugerido.toFixed(2)));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit() {
    setError(null);
    const montoNum = Number(monto);
    if (!Number.isFinite(montoNum) || montoNum <= 0) {
      setError("Ingresa un monto válido.");
      return;
    }

    startTransition(async () => {
      const result = await registrarPago({
        ticketId: ticket.id,
        turnoId,
        metodo,
        monto: montoNum,
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      onPagado();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">Cobrar</h2>
          <button onClick={onClose} className="text-muted hover:text-foreground">
            ✕
          </button>
        </div>

        <div className="mb-4 rounded-lg border border-border bg-background p-3 text-sm">
          <p className="text-foreground">{ticket.servicio?.nombre}</p>
          <p className="text-muted">
            Precio: ${precioBase.toFixed(2)}
            {ticket.descuento_monto > 0 && ` · Descuento: -$${ticket.descuento_monto.toFixed(2)}`}
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted">Método de pago</label>
            <select
              value={metodo}
              onChange={(e) => setMetodo(e.target.value as PagoMetodo)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
            >
              {METODOS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted">Monto</label>
            <input
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
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
            onClick={handleSubmit}
            disabled={pending}
            className="rounded-lg bg-primary px-4 py-2.5 font-semibold text-white transition hover:bg-primary-hover disabled:opacity-60"
          >
            {pending ? "Cobrando..." : "Registrar pago"}
          </button>
        </div>
      </div>
    </div>
  );
}

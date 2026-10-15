"use client";

import { useState, useTransition } from "react";
import type { PagoMetodo } from "@/types/database.types";
import { registrarPago } from "./actions";
import { sumaExtras } from "./types";
import type { TicketConDetalle } from "./types";
import { precioPorTamano } from "@/lib/servicios";

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
  const precioBase = precioPorTamano(ticket.servicio?.precios, ticket.tamano_vehiculo);
  const precioExtras = sumaExtras(ticket.extras);
  const totalSugerido = Math.max(precioBase + precioExtras - ticket.descuento_monto, 0);
  const esGratis = totalSugerido === 0;

  const [metodo, setMetodo] = useState<PagoMetodo>("efectivo");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // El monto ya no se captura: siempre es el total del ticket (precio +
  // extras - descuento). Solo se elige el método de pago y se confirma.
  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const result = await registrarPago({
        ticketId: ticket.id,
        turnoId,
        metodo,
        monto: esGratis ? 0 : totalSugerido,
        montoRecibido: null,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      onPagado();
    });
  }

  return (
    <div className="animate-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="animate-modal w-full max-w-sm rounded-xl border border-border bg-surface p-6">
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
          {ticket.extras.length > 0 && (
            <p className="text-muted">
              {ticket.extras.map((e) => e.nombre).join(", ")}: +${precioExtras.toFixed(2)}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3">
          {esGratis ? (
            <p className="rounded-lg border border-success/40 bg-success/10 px-3 py-2 text-sm text-success">
              Esta es la 6ª lavada del cliente: es gratis. No se registra ningún pago, solo se marca como cobrada.
            </p>
          ) : (
            <>
              <div className="rounded-lg border border-border bg-background px-3 py-2 text-center">
                <p className="text-xs text-muted">Total a cobrar</p>
                <p className="text-2xl font-bold text-foreground">${totalSugerido.toFixed(2)}</p>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted">Método de pago</label>
                <div className="grid grid-cols-3 gap-2">
                  {METODOS.map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => setMetodo(m.value)}
                      className={`rounded-lg border px-2 py-2.5 text-sm font-medium transition ${
                        metodo === m.value
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted hover:text-foreground"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

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
            {pending ? "Guardando..." : esGratis ? "Marcar como cobrada" : "✓ Pagado"}
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import type { PagoMetodo } from "@/types/database.types";
import { registrarPago } from "./actions";
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
  const totalSugerido = Math.max(precioBase - ticket.descuento_monto, 0);
  const esGratis = totalSugerido === 0;

  const [metodo, setMetodo] = useState<PagoMetodo>("efectivo");
  const [monto, setMonto] = useState(String(totalSugerido.toFixed(2)));
  const [montoRecibido, setMontoRecibido] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const montoNum = Number(monto);
  const montoRecibidoNum = Number(montoRecibido);
  const esEfectivo = metodo === "efectivo";
  const cambio =
    esEfectivo && montoRecibido !== "" && Number.isFinite(montoRecibidoNum)
      ? montoRecibidoNum - montoNum
      : null;

  function handleSubmit() {
    setError(null);
    if (!Number.isFinite(montoNum) || montoNum < 0) {
      setError("Ingresa un monto válido.");
      return;
    }

    if (esEfectivo) {
      if (montoRecibido === "" || !Number.isFinite(montoRecibidoNum)) {
        setError("Ingresa con cuánto paga el cliente.");
        return;
      }
      if (montoRecibidoNum < montoNum) {
        setError("Lo que paga el cliente no puede ser menor al total a cobrar.");
        return;
      }
    }

    startTransition(async () => {
      const result = await registrarPago({
        ticketId: ticket.id,
        turnoId,
        metodo,
        monto: montoNum,
        montoRecibido: esEfectivo ? montoRecibidoNum : null,
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
        </div>

        <div className="flex flex-col gap-3">
          {esGratis ? (
            <p className="rounded-lg border border-success/40 bg-success/10 px-3 py-2 text-sm text-success">
              Esta es la 6ª lavada del cliente: es gratis. No se registra ningún pago, solo se marca como cobrada.
            </p>
          ) : (
            <>
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
                <label className="text-xs font-medium text-muted">Monto a cobrar</label>
                <input
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  type="number"
                  min="0"
                  step="0.01"
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                />
              </div>

              {esEfectivo && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted">¿Con cuánto paga el cliente?</label>
                  <input
                    value={montoRecibido}
                    onChange={(e) => setMontoRecibido(e.target.value)}
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Ej. 200"
                    className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                  />
                </div>
              )}

              {esEfectivo && cambio !== null && (
                <div
                  className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
                    cambio < 0
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-success/40 bg-success/10 text-success"
                  }`}
                >
                  {cambio < 0
                    ? `Falta $${Math.abs(cambio).toFixed(2)} para cubrir el total.`
                    : `Cambio a devolver: $${cambio.toFixed(2)}`}
                </div>
              )}
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
            {pending ? "Cobrando..." : esGratis ? "Marcar como cobrada" : "Registrar pago"}
          </button>
        </div>
      </div>
    </div>
  );
}

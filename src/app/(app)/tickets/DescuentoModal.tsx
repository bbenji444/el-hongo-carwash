"use client";

import { useState, useTransition } from "react";
import { solicitarDescuento } from "./actions";
import type { TicketConDetalle } from "./types";

export function DescuentoModal({
  ticket,
  onClose,
  onAutorizado,
}: {
  ticket: TicketConDetalle;
  onClose: () => void;
  onAutorizado: () => void;
}) {
  const [monto, setMonto] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit() {
    setError(null);
    const montoNum = Number(monto);
    if (!Number.isFinite(montoNum) || montoNum <= 0) {
      setError("Ingresa un monto de descuento válido.");
      return;
    }
    if (!email.trim() || !password) {
      setError("El encargado o dueño debe ingresar su correo y contraseña para autorizar.");
      return;
    }

    startTransition(async () => {
      const result = await solicitarDescuento({
        ticketId: ticket.id,
        montoDescuento: montoNum,
        autorizadorEmail: email.trim(),
        autorizadorPassword: password,
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
          <h2 className="text-lg font-bold text-foreground">Autorizar descuento</h2>
          <button onClick={onClose} className="text-muted hover:text-foreground">
            ✕
          </button>
        </div>

        <p className="mb-4 text-sm text-muted">
          Un encargado o dueño debe ingresar sus propias credenciales para autorizar este descuento.
        </p>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted">Monto de descuento</label>
            <input
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              type="number"
              min="0"
              step="0.01"
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted">Correo del autorizador</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted">Contraseña</label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
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
            {pending ? "Verificando..." : "Autorizar descuento"}
          </button>
        </div>
      </div>
    </div>
  );
}

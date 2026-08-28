"use client";

import { useEffect, useState } from "react";
import { detalleCliente } from "./actions";

type Detalle = NonNullable<Awaited<ReturnType<typeof detalleCliente>>["data"]>;

export function ClienteDetalleModal({
  clienteId,
  ticketActual,
  onClose,
}: {
  clienteId: string;
  ticketActual: {
    servicioNombre: string | null;
    empleadoNombre: string | null;
    lavadorNombre: string | null;
    placas: string | null;
  };
  onClose: () => void;
}) {
  const [detalle, setDetalle] = useState<Detalle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let activo = true;
    setCargando(true);
    setError(null);
    detalleCliente(clienteId).then((result) => {
      if (!activo) return;
      if (result.error) setError(result.error);
      setDetalle(result.data);
      setCargando(false);
    });
    return () => {
      activo = false;
    };
  }, [clienteId]);

  return (
    <div className="animate-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="animate-modal w-full max-w-sm rounded-xl border border-border bg-surface p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">Detalles del cliente</h2>
          <button onClick={onClose} className="text-muted hover:text-foreground">
            ✕
          </button>
        </div>

        {cargando && <p className="text-sm text-muted">Cargando...</p>}
        {error && (
          <p className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm text-primary">
            {error}
          </p>
        )}

        {detalle && (
          <div className="flex flex-col gap-3 text-sm">
            <div>
              <p className="text-base font-semibold text-foreground">{detalle.cliente.nombre}</p>
              {detalle.cliente.telefono && <p className="text-muted">{detalle.cliente.telefono}</p>}
            </div>

            <div className="rounded-lg border border-border bg-background p-3">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Este ticket</p>
              {ticketActual.servicioNombre && (
                <p className="text-foreground">{ticketActual.servicioNombre}</p>
              )}
              {ticketActual.empleadoNombre && (
                <p className="text-muted">Atendido por: {ticketActual.empleadoNombre}</p>
              )}
              {ticketActual.lavadorNombre && (
                <p className="text-muted">Lavador: {ticketActual.lavadorNombre}</p>
              )}
              {ticketActual.placas && <p className="text-muted">Distintivo: {ticketActual.placas}</p>}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-border bg-background p-3">
                <p className="text-xs text-muted">Visitas totales</p>
                <p className="text-lg font-bold text-foreground">{detalle.visitasTotales}</p>
              </div>
              <div className="rounded-lg border border-border bg-background p-3">
                <p className="text-xs text-muted">Gastado en total</p>
                <p className="text-lg font-bold text-foreground">${detalle.gastoTotal.toFixed(2)}</p>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-background p-3">
              <p className="text-xs text-muted">Progreso de lealtad</p>
              <p className="text-foreground">
                {detalle.lavadasEnCiclo}/6 lavadas en este ciclo
                {detalle.proximaGratis && <span className="text-success"> · ¡la próxima es gratis!</span>}
              </p>
            </div>

            {detalle.vehiculos.length > 0 && (
              <div className="rounded-lg border border-border bg-background p-3">
                <p className="mb-1 text-xs text-muted">Vehículos registrados</p>
                {detalle.vehiculos.map((v) => (
                  <p key={v.id} className="text-foreground">
                    {v.tipo_vehiculo ?? "Vehículo"}
                    {v.placas && ` · ${v.placas}`}
                  </p>
                ))}
              </div>
            )}

            <p className="text-xs text-muted">
              Cliente desde{" "}
              {new Date(detalle.cliente.creado_en).toLocaleDateString("es-MX", {
                year: "numeric",
                month: "long",
              })}
              {detalle.ultimaVisita &&
                ` · última visita ${new Date(detalle.ultimaVisita).toLocaleDateString("es-MX")}`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

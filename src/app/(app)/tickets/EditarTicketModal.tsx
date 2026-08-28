"use client";

import { useState, useTransition } from "react";
import type { TamanoVehiculo, Lavador, ConfiguracionApp, ExtraCatalogo } from "@/types/database.types";
import { TAMANOS_VEHICULO, precioPorTamano } from "@/lib/servicios";
import { emojiPorTamano } from "@/lib/configuracionDefaults";
import type { ServicioConPrecios, TicketConDetalle } from "./types";
import { BotonSeleccion } from "./BotonSeleccion";
import { actualizarTicket, eliminarTicket } from "./actions";

export function EditarTicketModal({
  ticket,
  servicios,
  lavadores,
  extras,
  enProcesoPorLavador,
  config,
  onClose,
}: {
  ticket: TicketConDetalle;
  servicios: ServicioConPrecios[];
  lavadores: Lavador[];
  extras: ExtraCatalogo[];
  enProcesoPorLavador: Record<string, number>;
  config: ConfiguracionApp;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [tamanoVehiculo, setTamanoVehiculo] = useState<TamanoVehiculo>(ticket.tamano_vehiculo);
  const [servicioId, setServicioId] = useState(ticket.servicio_id);
  const [lavadorId, setLavadorId] = useState(ticket.lavador?.id ?? "");
  const [distintivo, setDistintivo] = useState(ticket.distintivo ?? "");
  const [extraIds, setExtraIds] = useState<string[]>(ticket.extras.map((e) => e.extra_id));

  function toggleExtra(id: string) {
    setExtraIds((prev) => (prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]));
  }

  function handleGuardar() {
    setError(null);

    if (!servicioId) {
      setError("Selecciona un paquete.");
      return;
    }

    startTransition(async () => {
      const result = await actualizarTicket(ticket.id, {
        servicioId,
        tamanoVehiculo,
        lavadorId: lavadorId || null,
        distintivo: distintivo.trim() || null,
        extraIds,
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      onClose();
    });
  }

  function handleEliminar() {
    if (!window.confirm("¿Eliminar este ticket por completo? Esta acción no se puede deshacer.")) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await eliminarTicket(ticket.id);
      if (result.error) {
        setError(result.error);
        return;
      }
      onClose();
    });
  }

  return (
    <div className="animate-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="animate-modal max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-surface p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">Editar ticket</h2>
          <button onClick={onClose} className="text-muted hover:text-foreground">
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-muted">
            {ticket.cliente?.nombre ?? "Cliente de mostrador"}
            {(ticket.distintivo ?? ticket.vehiculo?.placas) && ` · ${ticket.distintivo ?? ticket.vehiculo?.placas}`}
          </div>

          {/* Distintivo */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted">Distintivo (opcional)</label>
            <input
              value={distintivo}
              onChange={(e) => setDistintivo(e.target.value)}
              placeholder="Ej. Mazda gris, BMW negro"
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
            />
          </div>

          {/* Tamaño de vehículo */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted">Tamaño de vehículo</label>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {TAMANOS_VEHICULO.map((t) => (
                <BotonSeleccion
                  key={t.value}
                  seleccionado={tamanoVehiculo === t.value}
                  onClick={() => setTamanoVehiculo(t.value)}
                >
                  <span className="text-xl">{emojiPorTamano(config, t.value)}</span>
                  <span className="text-[11px] leading-tight">{t.label}</span>
                </BotonSeleccion>
              ))}
            </div>
          </div>

          {/* Servicio */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted">Paquete</label>
            <div className="grid grid-cols-2 gap-2">
              {servicios.map((s) => (
                <BotonSeleccion key={s.id} seleccionado={servicioId === s.id} onClick={() => setServicioId(s.id)}>
                  <span className="flex items-center gap-1 text-sm font-medium">
                    {s.destacado && <span title="Destacado">⭐</span>}
                    {s.nombre}
                  </span>
                  <span className="text-xs">${precioPorTamano(s.precios, tamanoVehiculo).toFixed(2)}</span>
                </BotonSeleccion>
              ))}
            </div>
          </div>

          {/* Extras */}
          {extras.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted">+ Extra (opcional)</label>
              <div className="grid grid-cols-2 gap-2">
                {extras.map((extra) => (
                  <BotonSeleccion
                    key={extra.id}
                    seleccionado={extraIds.includes(extra.id)}
                    onClick={() => toggleExtra(extra.id)}
                  >
                    <span className="text-sm font-medium">{extra.nombre}</span>
                    <span className="text-xs">${extra.precio.toFixed(2)}</span>
                  </BotonSeleccion>
                ))}
              </div>
            </div>
          )}

          {/* Lavador */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted">Lavador</label>
            <div className="grid grid-cols-3 gap-2">
              {lavadores.map((l) => {
                const enProceso = enProcesoPorLavador[l.id] ?? 0;
                return (
                  <BotonSeleccion key={l.id} seleccionado={lavadorId === l.id} onClick={() => setLavadorId(l.id)}>
                    <span className="text-xl">{config.emoji_lavador}</span>
                    <span className="text-xs font-medium leading-tight">{l.nombre}</span>
                    {enProceso > 0 && <span className="text-[10px] text-warning">{enProceso} en curso</span>}
                  </BotonSeleccion>
                );
              })}
              {lavadores.length === 0 && (
                <p className="col-span-3 text-sm text-muted">No hay lavadores registrados.</p>
              )}
            </div>
          </div>

          {error && (
            <p className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm text-primary">
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleGuardar}
              disabled={pending}
              className="flex-1 rounded-lg bg-primary px-4 py-2.5 font-semibold text-white transition hover:bg-primary-hover disabled:opacity-60"
            >
              {pending ? "Guardando..." : "Guardar cambios"}
            </button>
            <button
              onClick={handleEliminar}
              disabled={pending}
              className="rounded-lg border border-primary/40 px-4 py-2.5 text-sm font-medium text-primary transition hover:bg-primary/10 disabled:opacity-60"
            >
              Eliminar ticket
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

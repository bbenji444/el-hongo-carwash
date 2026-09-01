"use client";

import { useState, useTransition } from "react";
import type { TamanoVehiculo, Lavador, ConfiguracionApp, ExtraCatalogo } from "@/types/database.types";
import { TAMANOS_VEHICULO, nombreTamano, precioPorTamano } from "@/lib/servicios";
import { emojiPorTamano } from "@/lib/configuracionDefaults";
import type { ServicioConPrecios, TicketConDetalle } from "./types";
import { BotonSeleccion } from "./BotonSeleccion";
import { actualizarTicket, eliminarTicket } from "./actions";
import { obtenerOCrearVehiculo } from "../clientes/actions";

export function EditarTicketModal({
  ticket,
  servicios,
  lavadores,
  extras,
  enProcesoPorLavador,
  config,
  esDueno,
  onClose,
}: {
  ticket: TicketConDetalle;
  servicios: ServicioConPrecios[];
  lavadores: Lavador[];
  extras: ExtraCatalogo[];
  enProcesoPorLavador: Record<string, number>;
  config: ConfiguracionApp;
  esDueno: boolean;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const entregado = ticket.estado === "entregado";
  // Un ticket entregado puede afectar una venta ya cobrada y sumada a una
  // caja que quizás ya cerró — solo el dueño puede editarlo, no basta con
  // el permiso normal de editar tickets.
  const puedeEditarCampos = !entregado || esDueno;

  const [tamanoVehiculo, setTamanoVehiculo] = useState<TamanoVehiculo>(ticket.tamano_vehiculo);
  const [servicioId, setServicioId] = useState(ticket.servicio_id);
  const [lavadorId, setLavadorId] = useState(ticket.lavador?.id ?? "");
  const [distintivo, setDistintivo] = useState(ticket.distintivo ?? "");
  const [placa, setPlaca] = useState(ticket.placa ?? ticket.vehiculo?.placas ?? "");
  const [extraIds, setExtraIds] = useState<string[]>(ticket.extras.map((e) => e.extra_id));
  const hayCliente = Boolean(ticket.cliente);

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
      let vehiculoId: string | null = null;
      if (hayCliente && placa.trim()) {
        const res = await obtenerOCrearVehiculo({
          clienteId: ticket.cliente!.id,
          placas: placa.trim(),
          tipoVehiculo: nombreTamano(tamanoVehiculo),
        });
        if (res.error) {
          setError(res.error);
          return;
        }
        vehiculoId = res.data?.id ?? null;
      }

      const result = await actualizarTicket(ticket.id, {
        servicioId,
        tamanoVehiculo,
        lavadorId: lavadorId || null,
        distintivo: distintivo.trim() || null,
        placa: placa.trim() || null,
        vehiculoId,
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
    const mensaje = entregado
      ? "¿Eliminar este ticket YA ENTREGADO por completo? Se borra también su pago y desaparece de las ventas/métricas. Esta acción no se puede deshacer."
      : "¿Eliminar este ticket por completo? Esta acción no se puede deshacer.";
    if (!window.confirm(mensaje)) {
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
            {ticket.cliente ? ticket.cliente.nombre : ticket.distintivo ?? "Cliente de mostrador"}
            {[ticket.cliente ? ticket.distintivo : null, ticket.placa ?? ticket.vehiculo?.placas]
              .filter(Boolean)
              .map((v) => ` · ${v}`)
              .join("")}
          </div>

          {entregado && (
            <p className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
              {esDueno
                ? "Este ticket ya fue entregado — es una venta ya cobrada. Edítalo solo para corregir un error real."
                : "Este ticket ya fue entregado — solo el dueño puede modificarlo o eliminarlo."}
            </p>
          )}

          {puedeEditarCampos && (
            <>
              {/* Distintivo y placa */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted">Distintivo (opcional)</label>
                  <input
                    value={distintivo}
                    onChange={(e) => setDistintivo(e.target.value)}
                    placeholder="Ej. Jetta negro"
                    className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted">Placa (opcional)</label>
                  <input
                    value={placa}
                    onChange={(e) => setPlaca(e.target.value)}
                    placeholder="Ej. ABC-123"
                    className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                  />
                </div>
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
                    <BotonSeleccion
                      key={s.id}
                      seleccionado={servicioId === s.id}
                      onClick={() => setServicioId(s.id)}
                    >
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
                      <BotonSeleccion
                        key={l.id}
                        seleccionado={lavadorId === l.id}
                        onClick={() => setLavadorId(l.id)}
                      >
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
            </>
          )}

          {error && (
            <p className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm text-primary">
              {error}
            </p>
          )}

          <div className="flex gap-2">
            {puedeEditarCampos && (
              <button
                onClick={handleGuardar}
                disabled={pending}
                className="flex-1 rounded-lg bg-primary px-4 py-2.5 font-semibold text-white transition hover:bg-primary-hover disabled:opacity-60"
              >
                {pending ? "Guardando..." : "Guardar cambios"}
              </button>
            )}
            {(!entregado || esDueno) && (
              <button
                onClick={handleEliminar}
                disabled={pending}
                className="rounded-lg border border-primary/40 px-4 py-2.5 text-sm font-medium text-primary transition hover:bg-primary/10 disabled:opacity-60"
              >
                Eliminar ticket
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useTransition, type FormEvent } from "react";
import type { Inventario } from "@/types/database.types";
import { crearReceta, eliminarReceta } from "./actions";

type Servicio = { id: string; nombre: string };
type RecetaConDetalle = {
  id: string;
  servicio_id: string;
  insumo_id: string;
  cantidad_estimada: number;
  servicio: Servicio | null;
  insumo: Inventario | null;
};

export function RecetasClient({
  recetas,
  servicios,
  insumos,
  puedeEditar,
}: {
  recetas: RecetaConDetalle[];
  servicios: Servicio[];
  insumos: Inventario[];
  puedeEditar: boolean;
}) {
  const [mostrarForm, setMostrarForm] = useState(false);
  const [servicioIdSeleccionado, setServicioId] = useState(servicios[0]?.id ?? "");
  const [insumoIdSeleccionado, setInsumoId] = useState(insumos[0]?.id ?? "");
  const [cantidad, setCantidad] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const servicioId = servicios.some((s) => s.id === servicioIdSeleccionado)
    ? servicioIdSeleccionado
    : servicios[0]?.id ?? "";
  const insumoId = insumos.some((i) => i.id === insumoIdSeleccionado)
    ? insumoIdSeleccionado
    : insumos[0]?.id ?? "";

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const cantidadEstimada = Number(cantidad);
    if (!servicioId || !insumoId || !Number.isFinite(cantidadEstimada) || cantidadEstimada <= 0) {
      setError("Selecciona servicio, insumo y una cantidad válida.");
      return;
    }

    startTransition(async () => {
      const result = await crearReceta({ servicioId, insumoId, cantidadEstimada });
      if (result.error) {
        setError(result.error);
        return;
      }
      setMostrarForm(false);
      setCantidad("");
    });
  }

  function handleEliminar(id: string) {
    startTransition(async () => {
      await eliminarReceta(id);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-semibold text-foreground">Recetas por servicio</h2>
        <p className="text-sm text-muted">
          Define cuánto insumo consume cada servicio. Al entregar un ticket, el stock se descuenta solo.
        </p>
      </div>

      {puedeEditar && (
        <div>
          {!mostrarForm ? (
            <button
              onClick={() => setMostrarForm(true)}
              disabled={servicios.length === 0 || insumos.length === 0}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:opacity-60"
            >
              + Nueva receta
            </button>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5 sm:flex-row sm:items-end sm:gap-4"
            >
              <div className="flex flex-1 flex-col gap-1.5">
                <label className="text-xs font-medium text-muted">Servicio</label>
                <select
                  value={servicioId}
                  onChange={(e) => setServicioId(e.target.value)}
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                >
                  {servicios.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-1 flex-col gap-1.5">
                <label className="text-xs font-medium text-muted">Insumo</label>
                <select
                  value={insumoId}
                  onChange={(e) => setInsumoId(e.target.value)}
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                >
                  {insumos.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.nombre_insumo}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex w-36 flex-col gap-1.5">
                <label className="text-xs font-medium text-muted">Cantidad por ticket</label>
                <input
                  value={cantidad}
                  onChange={(e) => setCantidad(e.target.value)}
                  type="number"
                  min="0"
                  step="0.001"
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                  placeholder="0.5"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:opacity-60"
                >
                  Guardar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMostrarForm(false);
                    setError(null);
                  }}
                  className="rounded-lg border border-border px-4 py-2 text-sm text-muted transition hover:text-foreground"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}
          {error && <p className="mt-2 text-sm text-primary">{error}</p>}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-hover text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Servicio</th>
              <th className="px-4 py-3">Insumo</th>
              <th className="px-4 py-3">Cantidad por ticket</th>
              {puedeEditar && <th className="px-4 py-3 text-right">Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {recetas.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-4 py-3 text-foreground">{r.servicio?.nombre ?? "—"}</td>
                <td className="px-4 py-3 text-foreground">{r.insumo?.nombre_insumo ?? "—"}</td>
                <td className="px-4 py-3 text-muted">{r.cantidad_estimada}</td>
                {puedeEditar && (
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleEliminar(r.id)}
                      disabled={pending}
                      className="text-xs text-muted hover:text-foreground disabled:opacity-60"
                    >
                      Eliminar
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {recetas.length === 0 && (
              <tr>
                <td colSpan={puedeEditar ? 4 : 3} className="px-4 py-6 text-center text-muted">
                  Sin recetas registradas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

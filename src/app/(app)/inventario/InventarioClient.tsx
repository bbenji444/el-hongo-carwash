"use client";

import { useState, useTransition, type FormEvent } from "react";
import type { Inventario } from "@/types/database.types";
import { crearInsumo, actualizarInsumo, eliminarInsumo } from "./actions";

const emptyForm = { nombre: "", stockActual: "", costoUnitario: "" };

export function InventarioClient({ insumos, puedeEditar }: { insumos: Inventario[]; puedeEditar: boolean }) {
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [mostrarForm, setMostrarForm] = useState(false);

  function abrirEdicion(insumo: Inventario) {
    setEditandoId(insumo.id);
    setForm({
      nombre: insumo.nombre_insumo,
      stockActual: String(insumo.stock_actual),
      costoUnitario: String(insumo.costo_unitario),
    });
    setMostrarForm(true);
  }

  function abrirNuevo() {
    setEditandoId(null);
    setForm(emptyForm);
    setMostrarForm(true);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const stockActual = Number(form.stockActual);
    const costoUnitario = Number(form.costoUnitario);
    if (!form.nombre.trim() || !Number.isFinite(stockActual) || stockActual < 0 || !Number.isFinite(costoUnitario) || costoUnitario < 0) {
      setError("Nombre, stock y costo unitario válidos son obligatorios.");
      return;
    }

    const input = { nombre: form.nombre.trim(), stockActual, costoUnitario };

    startTransition(async () => {
      const result = editandoId ? await actualizarInsumo(editandoId, input) : await crearInsumo(input);

      if (result.error) {
        setError(result.error);
        return;
      }

      setMostrarForm(false);
      setForm(emptyForm);
      setEditandoId(null);
    });
  }

  function handleEliminar(insumo: Inventario) {
    startTransition(async () => {
      await eliminarInsumo(insumo.id);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-semibold text-foreground">Insumos</h2>

      {puedeEditar && (
        <div>
          {!mostrarForm ? (
            <button
              onClick={abrirNuevo}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-hover"
            >
              + Nuevo insumo
            </button>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5 sm:flex-row sm:items-end sm:gap-4"
            >
              <div className="flex flex-1 flex-col gap-1.5">
                <label className="text-xs font-medium text-muted">Nombre del insumo</label>
                <input
                  value={form.nombre}
                  onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                  placeholder="Shampoo para autos"
                />
              </div>
              <div className="flex w-36 flex-col gap-1.5">
                <label className="text-xs font-medium text-muted">Stock actual</label>
                <input
                  value={form.stockActual}
                  onChange={(e) => setForm((f) => ({ ...f, stockActual: e.target.value }))}
                  type="number"
                  min="0"
                  step="0.001"
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                  placeholder="50"
                />
              </div>
              <div className="flex w-36 flex-col gap-1.5">
                <label className="text-xs font-medium text-muted">Costo unitario (MXN)</label>
                <input
                  value={form.costoUnitario}
                  onChange={(e) => setForm((f) => ({ ...f, costoUnitario: e.target.value }))}
                  type="number"
                  min="0"
                  step="0.01"
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                  placeholder="20"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:opacity-60"
                >
                  {editandoId ? "Guardar" : "Crear"}
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
              <th className="px-4 py-3">Insumo</th>
              <th className="px-4 py-3">Stock actual</th>
              <th className="px-4 py-3">Costo unitario</th>
              {puedeEditar && <th className="px-4 py-3 text-right">Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {insumos.map((insumo) => (
              <tr key={insumo.id} className="border-t border-border">
                <td className="px-4 py-3 text-foreground">{insumo.nombre_insumo}</td>
                <td className="px-4 py-3">
                  <span
                    className={
                      insumo.stock_actual <= 0
                        ? "rounded-full border border-primary/40 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
                        : "text-foreground"
                    }
                  >
                    {insumo.stock_actual}
                  </span>
                </td>
                <td className="px-4 py-3 text-foreground">${insumo.costo_unitario.toFixed(2)}</td>
                {puedeEditar && (
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => abrirEdicion(insumo)} className="text-xs text-accent hover:underline">
                        Editar
                      </button>
                      <button
                        onClick={() => handleEliminar(insumo)}
                        disabled={pending}
                        className="text-xs text-muted hover:text-foreground disabled:opacity-60"
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {insumos.length === 0 && (
              <tr>
                <td colSpan={puedeEditar ? 4 : 3} className="px-4 py-6 text-center text-muted">
                  Sin insumos registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

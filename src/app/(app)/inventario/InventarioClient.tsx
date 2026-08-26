"use client";

import { useMemo, useState, useTransition, type FormEvent } from "react";
import type { Inventario } from "@/types/database.types";
import { crearInsumo, actualizarInsumo, eliminarInsumo } from "./actions";

const emptyForm = { nombre: "", stockActual: "", stockMinimo: "10", costoUnitario: "" };

export function InventarioClient({ insumos, puedeEditar }: { insumos: Inventario[]; puedeEditar: boolean }) {
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [mostrarForm, setMostrarForm] = useState(false);
  const [soloBajo, setSoloBajo] = useState(false);

  const insumosFiltrados = useMemo(
    () => (soloBajo ? insumos.filter((i) => i.stock_actual <= i.stock_minimo) : insumos),
    [insumos, soloBajo]
  );
  const numBajo = useMemo(() => insumos.filter((i) => i.stock_actual <= i.stock_minimo).length, [insumos]);

  function abrirEdicion(insumo: Inventario) {
    setEditandoId(insumo.id);
    setForm({
      nombre: insumo.nombre_insumo,
      stockActual: String(insumo.stock_actual),
      stockMinimo: String(insumo.stock_minimo),
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
    const stockMinimo = Number(form.stockMinimo);
    const costoUnitario = Number(form.costoUnitario);
    if (
      !form.nombre.trim() ||
      !Number.isFinite(stockActual) ||
      stockActual < 0 ||
      !Number.isFinite(stockMinimo) ||
      stockMinimo < 0 ||
      !Number.isFinite(costoUnitario) ||
      costoUnitario < 0
    ) {
      setError("Nombre, stock actual, stock mínimo y costo unitario válidos son obligatorios.");
      return;
    }

    const input = { nombre: form.nombre.trim(), stockActual, stockMinimo, costoUnitario };

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

  const qs = soloBajo ? "?bajo=1" : "";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold text-foreground">Insumos</h2>
        <div className="flex flex-wrap gap-2">
          <a
            href={`/inventario/exportar/pdf${qs}`}
            className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary transition hover:bg-primary/20"
          >
            Descargar PDF
          </a>
          <a
            href={`/inventario/exportar/excel${qs}`}
            className="rounded-lg border border-success/40 bg-success/10 px-3 py-1.5 text-sm font-medium text-success transition hover:bg-success/20"
          >
            Descargar Excel
          </a>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {puedeEditar && !mostrarForm && (
          <button
            onClick={abrirNuevo}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-hover"
          >
            + Nuevo insumo
          </button>
        )}
        <button
          onClick={() => setSoloBajo((v) => !v)}
          className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
            soloBajo
              ? "border-warning bg-warning/10 text-warning"
              : "border-border text-muted hover:text-foreground"
          }`}
        >
          {soloBajo ? "Viendo solo stock bajo" : "Filtrar stock bajo"}
          {numBajo > 0 && ` (${numBajo})`}
        </button>
      </div>

      {puedeEditar && mostrarForm && (
        <div>
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
            <div className="flex w-32 flex-col gap-1.5">
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
            <div className="flex w-32 flex-col gap-1.5">
              <label className="text-xs font-medium text-muted">Stock mínimo</label>
              <input
                value={form.stockMinimo}
                onChange={(e) => setForm((f) => ({ ...f, stockMinimo: e.target.value }))}
                type="number"
                min="0"
                step="0.001"
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                placeholder="10"
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
          {error && <p className="mt-2 text-sm text-primary">{error}</p>}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-hover text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Insumo</th>
              <th className="px-4 py-3">Stock actual</th>
              <th className="px-4 py-3">Stock mínimo</th>
              <th className="px-4 py-3">Costo unitario</th>
              {puedeEditar && <th className="px-4 py-3 text-right">Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {insumosFiltrados.map((insumo) => {
              const agotado = insumo.stock_actual <= 0;
              const bajo = !agotado && insumo.stock_actual <= insumo.stock_minimo;
              return (
                <tr key={insumo.id} className="border-t border-border">
                  <td className="px-4 py-3 text-foreground">{insumo.nombre_insumo}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        agotado
                          ? "rounded-full border border-primary/40 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
                          : bajo
                            ? "rounded-full border border-warning/40 bg-warning/10 px-2.5 py-0.5 text-xs font-medium text-warning"
                            : "text-foreground"
                      }
                    >
                      {insumo.stock_actual}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted">{insumo.stock_minimo}</td>
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
              );
            })}
            {insumosFiltrados.length === 0 && (
              <tr>
                <td colSpan={puedeEditar ? 5 : 4} className="px-4 py-6 text-center text-muted">
                  {soloBajo ? "Ningún insumo tiene el stock bajo ahora mismo." : "Sin insumos registrados."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

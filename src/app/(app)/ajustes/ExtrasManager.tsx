"use client";

import { useState, useTransition, type FormEvent } from "react";
import type { ExtraCatalogo } from "@/types/database.types";
import { crearExtra, actualizarExtra, toggleActivoExtra, eliminarExtra } from "./extrasActions";

const emptyForm = { nombre: "", precio: "", orden: "" };

export function ExtrasManager({ extras }: { extras: ExtraCatalogo[] }) {
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [mostrarForm, setMostrarForm] = useState(false);

  function abrirEdicion(extra: ExtraCatalogo) {
    setEditandoId(extra.id);
    setForm({ nombre: extra.nombre, precio: String(extra.precio), orden: String(extra.orden) });
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

    if (!form.nombre.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }
    const precio = Number(form.precio);
    if (!Number.isFinite(precio) || precio < 0) {
      setError("Ingresa un precio válido.");
      return;
    }

    const input = { nombre: form.nombre.trim(), precio, orden: form.orden ? Number(form.orden) : 0 };

    startTransition(async () => {
      const result = editandoId ? await actualizarExtra(editandoId, input) : await crearExtra(input);

      if (result.error) {
        setError(result.error);
        return;
      }

      setMostrarForm(false);
      setForm(emptyForm);
      setEditandoId(null);
    });
  }

  function handleToggle(extra: ExtraCatalogo) {
    startTransition(async () => {
      await toggleActivoExtra(extra.id, !extra.activo);
    });
  }

  function handleEliminar(extra: ExtraCatalogo) {
    if (!window.confirm(`¿Eliminar el extra "${extra.nombre}"? Esta acción no se puede deshacer.`)) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await eliminarExtra(extra.id);
      if (result.error) {
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        {!mostrarForm ? (
          <button
            type="button"
            onClick={abrirNuevo}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-all duration-150 hover:-translate-y-0.5 hover:bg-primary-hover hover:shadow-lg hover:shadow-primary/25"
          >
            + Nuevo extra
          </button>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5"
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label className="text-xs font-medium text-muted">Nombre</label>
                <input
                  value={form.nombre}
                  onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                  placeholder="Encerado premium"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted">Precio (MXN)</label>
                <input
                  value={form.precio}
                  onChange={(e) => setForm((f) => ({ ...f, precio: e.target.value }))}
                  type="number"
                  min="0"
                  step="0.01"
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                />
              </div>
            </div>
            <div className="w-28">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted">Orden</label>
                <input
                  value={form.orden}
                  onChange={(e) => setForm((f) => ({ ...f, orden: e.target.value }))}
                  type="number"
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                />
              </div>
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

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-hover text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Extra</th>
              <th className="px-4 py-3">Precio</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {extras.map((extra) => (
              <tr key={extra.id} className="border-t border-border transition-colors hover:bg-surface-hover">
                <td className="px-4 py-3 text-foreground">{extra.nombre}</td>
                <td className="whitespace-nowrap px-4 py-3 text-foreground">${extra.precio.toFixed(2)}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                      extra.activo
                        ? "border-success/40 bg-success/15 text-success"
                        : "border-muted/40 bg-muted/10 text-muted"
                    }`}
                  >
                    {extra.activo ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => abrirEdicion(extra)}
                      className="text-xs text-accent hover:underline"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggle(extra)}
                      disabled={pending}
                      className="text-xs text-muted hover:text-foreground disabled:opacity-60"
                    >
                      {extra.activo ? "Desactivar" : "Activar"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleEliminar(extra)}
                      disabled={pending}
                      className="text-xs text-primary hover:underline disabled:opacity-60"
                    >
                      Eliminar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {extras.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-muted">
                  Sin extras registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

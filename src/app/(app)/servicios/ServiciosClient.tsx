"use client";

import { useState, useTransition, type FormEvent } from "react";
import type { ServicioCatalogo } from "@/types/database.types";
import { crearServicio, actualizarServicio, toggleActivoServicio } from "./actions";

const emptyForm = { nombre: "", precio: "", tiempoEstimadoMin: "" };

export function ServiciosClient({
  servicios,
  esDueno,
}: {
  servicios: ServicioCatalogo[];
  esDueno: boolean;
}) {
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [mostrarForm, setMostrarForm] = useState(false);

  function abrirEdicion(servicio: ServicioCatalogo) {
    setEditandoId(servicio.id);
    setForm({
      nombre: servicio.nombre,
      precio: String(servicio.precio),
      tiempoEstimadoMin: servicio.tiempo_estimado_min ? String(servicio.tiempo_estimado_min) : "",
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

    const precio = Number(form.precio);
    if (!form.nombre.trim() || !Number.isFinite(precio) || precio <= 0) {
      setError("Nombre y precio válido son obligatorios.");
      return;
    }

    const tiempoEstimadoMin = form.tiempoEstimadoMin ? Number(form.tiempoEstimadoMin) : null;

    startTransition(async () => {
      const result = editandoId
        ? await actualizarServicio(editandoId, { nombre: form.nombre.trim(), precio, tiempoEstimadoMin })
        : await crearServicio({ nombre: form.nombre.trim(), precio, tiempoEstimadoMin });

      if (result.error) {
        setError(result.error);
        return;
      }

      setMostrarForm(false);
      setForm(emptyForm);
      setEditandoId(null);
    });
  }

  function handleToggle(servicio: ServicioCatalogo) {
    startTransition(async () => {
      await toggleActivoServicio(servicio.id, !servicio.activo);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {esDueno && (
        <div>
          {!mostrarForm ? (
            <button
              onClick={abrirNuevo}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-hover"
            >
              + Nuevo servicio
            </button>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5 sm:flex-row sm:items-end sm:gap-4"
            >
              <div className="flex flex-1 flex-col gap-1.5">
                <label className="text-xs font-medium text-muted">Nombre</label>
                <input
                  value={form.nombre}
                  onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                  placeholder="Lavado exterior"
                />
              </div>
              <div className="flex w-32 flex-col gap-1.5">
                <label className="text-xs font-medium text-muted">Precio (MXN)</label>
                <input
                  value={form.precio}
                  onChange={(e) => setForm((f) => ({ ...f, precio: e.target.value }))}
                  type="number"
                  min="0"
                  step="0.01"
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                  placeholder="150"
                />
              </div>
              <div className="flex w-36 flex-col gap-1.5">
                <label className="text-xs font-medium text-muted">Tiempo est. (min)</label>
                <input
                  value={form.tiempoEstimadoMin}
                  onChange={(e) => setForm((f) => ({ ...f, tiempoEstimadoMin: e.target.value }))}
                  type="number"
                  min="0"
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
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Precio</th>
              <th className="px-4 py-3">Tiempo est.</th>
              <th className="px-4 py-3">Estado</th>
              {esDueno && <th className="px-4 py-3 text-right">Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {servicios.map((servicio) => (
              <tr key={servicio.id} className="border-t border-border">
                <td className="px-4 py-3 text-foreground">{servicio.nombre}</td>
                <td className="px-4 py-3 text-foreground">${servicio.precio.toFixed(2)}</td>
                <td className="px-4 py-3 text-muted">
                  {servicio.tiempo_estimado_min ? `${servicio.tiempo_estimado_min} min` : "—"}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                      servicio.activo
                        ? "border-success/40 bg-success/15 text-success"
                        : "border-muted/40 bg-muted/10 text-muted"
                    }`}
                  >
                    {servicio.activo ? "Activo" : "Inactivo"}
                  </span>
                </td>
                {esDueno && (
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => abrirEdicion(servicio)}
                        className="text-xs text-accent hover:underline"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleToggle(servicio)}
                        disabled={pending}
                        className="text-xs text-muted hover:text-foreground disabled:opacity-60"
                      >
                        {servicio.activo ? "Desactivar" : "Activar"}
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {servicios.length === 0 && (
              <tr>
                <td colSpan={esDueno ? 5 : 4} className="px-4 py-6 text-center text-muted">
                  Sin servicios registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

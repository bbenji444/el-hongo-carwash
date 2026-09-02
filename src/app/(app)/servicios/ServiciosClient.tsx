"use client";

import { useState, useTransition, type FormEvent } from "react";
import type { ServicioCatalogo, ServicioPrecio } from "@/types/database.types";
import { TAMANOS_VEHICULO, TAMANOS_PRECIO_VARIABLE, PRECIOS_MOTO_FIJOS, precioPorTamano } from "@/lib/servicios";
import { crearServicio, actualizarServicio, toggleActivoServicio, eliminarServicio } from "./actions";

type ServicioConPrecios = ServicioCatalogo & { precios: ServicioPrecio[] };

function preciosVacios() {
  return Object.fromEntries(TAMANOS_PRECIO_VARIABLE.map((t) => [t.value, ""])) as Record<string, string>;
}

const emptyForm = {
  nombre: "",
  descripcion: "",
  caracteristicas: "",
  orden: "",
  destacado: false,
  tiempoEstimadoMin: "",
  precios: preciosVacios(),
};

export function ServiciosClient({
  servicios,
  esDueno,
}: {
  servicios: ServicioConPrecios[];
  esDueno: boolean;
}) {
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [mostrarForm, setMostrarForm] = useState(false);

  function abrirEdicion(servicio: ServicioConPrecios) {
    setEditandoId(servicio.id);
    setForm({
      nombre: servicio.nombre,
      descripcion: servicio.descripcion ?? "",
      caracteristicas: servicio.caracteristicas.join("\n"),
      orden: String(servicio.orden),
      destacado: servicio.destacado,
      tiempoEstimadoMin: servicio.tiempo_estimado_min ? String(servicio.tiempo_estimado_min) : "",
      precios: {
        ...preciosVacios(),
        ...Object.fromEntries(
          TAMANOS_PRECIO_VARIABLE.map((t) => [t.value, String(precioPorTamano(servicio.precios, t.value) || "")])
        ),
      },
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

    if (!form.nombre.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }

    const precios = TAMANOS_PRECIO_VARIABLE.map((t) => ({
      tamanoVehiculo: t.value,
      precio: Number(form.precios[t.value]),
    }));
    if (precios.some((p) => !Number.isFinite(p.precio) || p.precio <= 0)) {
      setError("Ingresa un precio válido para los 4 tamaños de vehículo.");
      return;
    }

    const tiempoEstimadoMin = form.tiempoEstimadoMin ? Number(form.tiempoEstimadoMin) : null;
    const caracteristicas = form.caracteristicas
      .split("\n")
      .map((c) => c.trim())
      .filter(Boolean);

    const input = {
      nombre: form.nombre.trim(),
      descripcion: form.descripcion.trim() || null,
      caracteristicas,
      orden: form.orden ? Number(form.orden) : 0,
      destacado: form.destacado,
      tiempoEstimadoMin,
      precios,
    };

    startTransition(async () => {
      const result = editandoId ? await actualizarServicio(editandoId, input) : await crearServicio(input);

      if (result.error) {
        setError(result.error);
        return;
      }

      setMostrarForm(false);
      setForm(emptyForm);
      setEditandoId(null);
    });
  }

  function handleToggle(servicio: ServicioConPrecios) {
    startTransition(async () => {
      await toggleActivoServicio(servicio.id, !servicio.activo);
    });
  }

  function handleEliminar(servicio: ServicioConPrecios) {
    if (!window.confirm(`¿Eliminar el paquete "${servicio.nombre}"? Esta acción no se puede deshacer.`)) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await eliminarServicio(servicio.id);
      if (result.error) {
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {esDueno && (
        <div>
          {!mostrarForm ? (
            <button
              onClick={abrirNuevo}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-all duration-150 hover:-translate-y-0.5 hover:bg-primary-hover hover:shadow-lg hover:shadow-primary/25"
            >
              + Nuevo paquete
            </button>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5"
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted">Nombre</label>
                  <input
                    value={form.nombre}
                    onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                    className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                    placeholder="Básico"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted">Descripción corta</label>
                  <input
                    value={form.descripcion}
                    onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
                    className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                    placeholder="Lo necesario"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted">
                  Características (una por línea)
                </label>
                <textarea
                  value={form.caracteristicas}
                  onChange={(e) => setForm((f) => ({ ...f, caracteristicas: e.target.value }))}
                  rows={3}
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                  placeholder={"Lavado carrocería\nAspirado interior\nAbrillantador llantas"}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted">
                  Precio por tamaño de vehículo (MXN)
                </label>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {TAMANOS_PRECIO_VARIABLE.map((t) => (
                    <div key={t.value} className="flex flex-col gap-1">
                      <span className="text-[11px] text-muted">{t.label}</span>
                      <input
                        value={form.precios[t.value]}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, precios: { ...f.precios, [t.value]: e.target.value } }))
                        }
                        type="number"
                        min="0"
                        step="0.01"
                        className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                      />
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-muted">
                  Moto chica (${PRECIOS_MOTO_FIJOS.moto_chica?.toFixed(2)}) y moto grande ($
                  {PRECIOS_MOTO_FIJOS.moto_grande?.toFixed(2)}) tienen precio fijo — no varían por paquete, así
                  que no se configuran aquí.
                </p>
              </div>

              <div className="flex flex-wrap items-end gap-4">
                <div className="flex w-28 flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted">Orden</label>
                  <input
                    value={form.orden}
                    onChange={(e) => setForm((f) => ({ ...f, orden: e.target.value }))}
                    type="number"
                    className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
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
                  />
                </div>
                <label className="flex items-center gap-2 pb-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={form.destacado}
                    onChange={(e) => setForm((f) => ({ ...f, destacado: e.target.checked }))}
                  />
                  Destacado (más vendido / recomendado)
                </label>
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

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-hover text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Paquete</th>
              {TAMANOS_VEHICULO.map((t) => (
                <th key={t.value} className="whitespace-nowrap px-4 py-3">
                  {t.label}
                </th>
              ))}
              <th className="px-4 py-3">Estado</th>
              {esDueno && <th className="px-4 py-3 text-right">Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {servicios.map((servicio) => (
              <tr key={servicio.id} className="border-t border-border transition-colors hover:bg-surface-hover">
                <td className="px-4 py-3 text-foreground">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{servicio.nombre}</span>
                    {servicio.destacado && (
                      <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                        Destacado
                      </span>
                    )}
                  </div>
                  {servicio.descripcion && <p className="text-xs text-muted">{servicio.descripcion}</p>}
                </td>
                {TAMANOS_VEHICULO.map((t) => (
                  <td key={t.value} className="whitespace-nowrap px-4 py-3 text-foreground">
                    ${precioPorTamano(servicio.precios, t.value).toFixed(2)}
                  </td>
                ))}
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
                      <button
                        onClick={() => handleEliminar(servicio)}
                        disabled={pending}
                        className="text-xs text-primary hover:underline disabled:opacity-60"
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {servicios.length === 0 && (
              <tr>
                <td colSpan={esDueno ? 6 : 5} className="px-4 py-6 text-center text-muted">
                  Sin paquetes registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

"use client";

import { useState, useTransition, type FormEvent } from "react";
import type { Membresia, MembresiaTipo } from "@/types/database.types";
import { crearMembresia, actualizarMembresia, toggleActivoMembresia } from "./actions";

const TIPO_LABEL: Record<MembresiaTipo, string> = {
  descuento_fijo: "Descuento fijo",
  paquete_prepagado: "Paquete prepagado",
};

const emptyForm = { nombre: "", tipo: "descuento_fijo" as MembresiaTipo, beneficioValor: "", precio: "", vigenciaDias: "" };

export function MembresiasClient({
  membresias,
  esDueno,
}: {
  membresias: Membresia[];
  esDueno: boolean;
}) {
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [mostrarForm, setMostrarForm] = useState(false);

  function abrirEdicion(membresia: Membresia) {
    setEditandoId(membresia.id);
    setForm({
      nombre: membresia.nombre,
      tipo: membresia.tipo,
      beneficioValor: String(membresia.beneficio_valor),
      precio: String(membresia.precio),
      vigenciaDias: String(membresia.vigencia_dias),
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

    const beneficioValor = Number(form.beneficioValor);
    const precio = Number(form.precio);
    const vigenciaDias = Number(form.vigenciaDias);
    if (
      !form.nombre.trim() ||
      !Number.isFinite(beneficioValor) ||
      beneficioValor <= 0 ||
      !Number.isFinite(precio) ||
      precio <= 0 ||
      !Number.isInteger(vigenciaDias) ||
      vigenciaDias <= 0
    ) {
      setError("Nombre, beneficio, precio y vigencia (días) válidos son obligatorios.");
      return;
    }

    const input = { nombre: form.nombre.trim(), tipo: form.tipo, beneficioValor, precio, vigenciaDias };

    startTransition(async () => {
      const result = editandoId ? await actualizarMembresia(editandoId, input) : await crearMembresia(input);

      if (result.error) {
        setError(result.error);
        return;
      }

      setMostrarForm(false);
      setForm(emptyForm);
      setEditandoId(null);
    });
  }

  function handleToggle(membresia: Membresia) {
    startTransition(async () => {
      await toggleActivoMembresia(membresia.id, !membresia.activo);
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
              + Nueva membresía
            </button>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
                <div className="flex flex-1 flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted">Nombre</label>
                  <input
                    value={form.nombre}
                    onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                    className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                    placeholder="Plan mensual"
                  />
                </div>
                <div className="flex w-48 flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted">Tipo</label>
                  <select
                    value={form.tipo}
                    onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value as MembresiaTipo }))}
                    className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                  >
                    <option value="descuento_fijo">Descuento fijo</option>
                    <option value="paquete_prepagado">Paquete prepagado</option>
                  </select>
                </div>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
                <div className="flex w-40 flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted">
                    {form.tipo === "paquete_prepagado" ? "Saldo del paquete (MXN)" : "Descuento por ticket (MXN)"}
                  </label>
                  <input
                    value={form.beneficioValor}
                    onChange={(e) => setForm((f) => ({ ...f, beneficioValor: e.target.value }))}
                    type="number"
                    min="0"
                    step="0.01"
                    className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                    placeholder="100"
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
                    placeholder="500"
                  />
                </div>
                <div className="flex w-36 flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted">Vigencia (días)</label>
                  <input
                    value={form.vigenciaDias}
                    onChange={(e) => setForm((f) => ({ ...f, vigenciaDias: e.target.value }))}
                    type="number"
                    min="1"
                    className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                    placeholder="30"
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
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Beneficio</th>
              <th className="px-4 py-3">Precio</th>
              <th className="px-4 py-3">Vigencia</th>
              <th className="px-4 py-3">Estado</th>
              {esDueno && <th className="px-4 py-3 text-right">Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {membresias.map((membresia) => (
              <tr key={membresia.id} className="border-t border-border">
                <td className="px-4 py-3 text-foreground">{membresia.nombre}</td>
                <td className="px-4 py-3 text-muted">{TIPO_LABEL[membresia.tipo]}</td>
                <td className="px-4 py-3 text-foreground">${membresia.beneficio_valor.toFixed(2)}</td>
                <td className="px-4 py-3 text-foreground">${membresia.precio.toFixed(2)}</td>
                <td className="px-4 py-3 text-muted">{membresia.vigencia_dias} días</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                      membresia.activo
                        ? "border-success/40 bg-success/15 text-success"
                        : "border-muted/40 bg-muted/10 text-muted"
                    }`}
                  >
                    {membresia.activo ? "Activo" : "Inactivo"}
                  </span>
                </td>
                {esDueno && (
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => abrirEdicion(membresia)}
                        className="text-xs text-accent hover:underline"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleToggle(membresia)}
                        disabled={pending}
                        className="text-xs text-muted hover:text-foreground disabled:opacity-60"
                      >
                        {membresia.activo ? "Desactivar" : "Activar"}
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {membresias.length === 0 && (
              <tr>
                <td colSpan={esDueno ? 7 : 6} className="px-4 py-6 text-center text-muted">
                  Sin membresías registradas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

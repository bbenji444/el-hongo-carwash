"use client";

import { useState, useTransition, type FormEvent } from "react";
import { crearIngreso, actualizarIngreso, eliminarIngreso } from "./actions";

type Ingreso = {
  id: string;
  concepto: string;
  monto: number;
  fecha: string;
  notas: string | null;
  creadoPor: string;
};

function money(n: number) {
  return `$${n.toFixed(2)}`;
}

function fechaInput(iso: string) {
  const d = new Date(iso);
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 10);
}

const emptyForm = { concepto: "", monto: "", fecha: fechaInput(new Date().toISOString()), notas: "" };

export function IngresosClient({ ingresos }: { ingresos: Ingreso[] }) {
  const [form, setForm] = useState(emptyForm);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [mostrarForm, setMostrarForm] = useState(false);

  function abrirNuevo() {
    setEditandoId(null);
    setForm(emptyForm);
    setError(null);
    setMostrarForm(true);
  }

  function abrirEdicion(i: Ingreso) {
    setEditandoId(i.id);
    setForm({
      concepto: i.concepto,
      monto: String(i.monto),
      fecha: fechaInput(i.fecha),
      notas: i.notas ?? "",
    });
    setError(null);
    setMostrarForm(true);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.concepto.trim()) {
      setError("Escribe el concepto del ingreso (ej. Pensión estacionamiento).");
      return;
    }
    const monto = Number(form.monto);
    if (!Number.isFinite(monto) || monto <= 0) {
      setError("Ingresa un monto válido.");
      return;
    }
    if (!form.fecha) {
      setError("Selecciona una fecha.");
      return;
    }

    const datos = {
      concepto: form.concepto.trim(),
      monto,
      fecha: new Date(`${form.fecha}T12:00:00`).toISOString(),
      notas: form.notas.trim() || null,
    };

    startTransition(async () => {
      const result = editandoId ? await actualizarIngreso(editandoId, datos) : await crearIngreso(datos);
      if (result.error) {
        setError(result.error);
        return;
      }
      setForm(emptyForm);
      setEditandoId(null);
      setMostrarForm(false);
    });
  }

  function handleEliminar(id: string) {
    if (!window.confirm("¿Eliminar este ingreso? Esta acción no se puede deshacer.")) return;
    setError(null);
    startTransition(async () => {
      const result = await eliminarIngreso(id);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        {!mostrarForm ? (
          <button
            onClick={abrirNuevo}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-hover"
          >
            + Nuevo ingreso
          </button>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5"
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted">Concepto</label>
                <input
                  value={form.concepto}
                  onChange={(e) => setForm((f) => ({ ...f, concepto: e.target.value }))}
                  placeholder="Ej. Pensión estacionamiento"
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted">Monto</label>
                <input
                  value={form.monto}
                  onChange={(e) => setForm((f) => ({ ...f, monto: e.target.value }))}
                  type="number"
                  min="0"
                  step="0.01"
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted">Fecha</label>
                <input
                  value={form.fecha}
                  onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))}
                  type="date"
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted">Notas (opcional)</label>
                <input
                  value={form.notas}
                  onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
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
                {pending ? "Guardando..." : editandoId ? "Guardar cambios" : "Guardar ingreso"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMostrarForm(false);
                  setEditandoId(null);
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
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Concepto</th>
              <th className="px-4 py-3">Notas</th>
              <th className="px-4 py-3">Registró</th>
              <th className="px-4 py-3 text-right">Monto</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {ingresos.map((i) => (
              <tr key={i.id} className="border-t border-border transition-colors hover:bg-surface-hover">
                <td className="px-4 py-3 text-muted">{new Date(i.fecha).toLocaleDateString("es-MX", { timeZone: "America/Mexico_City" })}</td>
                <td className="px-4 py-3 text-foreground">{i.concepto}</td>
                <td className="px-4 py-3 text-muted">{i.notas ?? "—"}</td>
                <td className="px-4 py-3 text-muted">{i.creadoPor}</td>
                <td className="px-4 py-3 text-right font-medium text-success">{money(i.monto)}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => abrirEdicion(i)} className="text-xs text-accent hover:underline">
                      Editar
                    </button>
                    <button
                      onClick={() => handleEliminar(i.id)}
                      disabled={pending}
                      className="text-xs text-primary hover:underline disabled:opacity-60"
                    >
                      Eliminar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {ingresos.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted">
                  Sin ingresos extra registrados en este período.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

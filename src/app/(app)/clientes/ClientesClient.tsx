"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { crearCliente } from "./actions";

type ClienteConDetalle = {
  id: string;
  nombre: string;
  telefono: string | null;
  placas: string[];
  ultimaLavada: string | null;
  lavadasEnCiclo: number;
};

export function ClientesClient({ clientes }: { clientes: ClienteConDetalle[] }) {
  const router = useRouter();
  const [mostrarForm, setMostrarForm] = useState(false);
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!nombre.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }

    startTransition(async () => {
      const result = await crearCliente({ nombre: nombre.trim(), telefono: telefono.trim() || null });

      if (result.error || !result.data) {
        setError(result.error ?? "No se pudo crear el cliente.");
        return;
      }

      setMostrarForm(false);
      setNombre("");
      setTelefono("");
      router.push(`/clientes/${result.data.id}`);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        {!mostrarForm ? (
          <button
            onClick={() => setMostrarForm(true)}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-all duration-150 hover:-translate-y-0.5 hover:bg-primary-hover hover:shadow-lg hover:shadow-primary/25"
          >
            + Nuevo cliente
          </button>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5 sm:flex-row sm:items-end sm:gap-4"
          >
            <div className="flex flex-1 flex-col gap-1.5">
              <label className="text-xs font-medium text-muted">Nombre</label>
              <input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                placeholder="Nombre del cliente"
              />
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <label className="text-xs font-medium text-muted">Teléfono</label>
              <input
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                placeholder="Opcional"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={pending}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:opacity-60"
              >
                {pending ? "Creando..." : "Crear"}
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

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-hover text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Teléfono</th>
              <th className="px-4 py-3">Placas</th>
              <th className="px-4 py-3">Última lavada</th>
              <th className="px-4 py-3">Lealtad</th>
            </tr>
          </thead>
          <tbody>
            {clientes.map((cliente) => (
              <tr key={cliente.id} className="border-t border-border transition-colors hover:bg-surface-hover">
                <td className="px-4 py-3">
                  <Link href={`/clientes/${cliente.id}`} className="text-foreground hover:text-accent hover:underline">
                    {cliente.nombre}
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted">{cliente.telefono ?? "—"}</td>
                <td className="px-4 py-3 text-muted">
                  {cliente.placas.length > 0 ? cliente.placas.join(", ") : "—"}
                </td>
                <td className="px-4 py-3 text-muted">
                  {cliente.ultimaLavada
                    ? new Date(cliente.ultimaLavada).toLocaleDateString("es-MX", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })
                    : "—"}
                </td>
                <td className="px-4 py-3">
                  {cliente.lavadasEnCiclo === 5 ? (
                    <span className="rounded-full border border-success/40 bg-success/15 px-2.5 py-0.5 text-xs font-medium text-success">
                      ¡Próxima gratis!
                    </span>
                  ) : (
                    <span className="rounded-full border border-accent/40 bg-accent/15 px-2.5 py-0.5 text-xs font-medium text-accent">
                      {cliente.lavadasEnCiclo} de 6
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {clientes.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted">
                  Sin clientes registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

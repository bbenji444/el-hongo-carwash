"use client";

import { useState, useTransition, type FormEvent } from "react";
import type { RolUsuario, UsuarioConCorreo } from "@/types/database.types";
import { crearUsuario, actualizarUsuario, toggleActivoUsuario } from "./actions";

const ROLES: { value: RolUsuario; label: string; descripcion: string }[] = [
  {
    value: "cajero",
    label: "Cajero",
    descripcion: "Crea tickets, cobra y ve Tickets/Dashboard. No edita catálogos ni ve Reportes.",
  },
  {
    value: "encargado",
    label: "Encargado",
    descripcion: "Todo lo del cajero, más editar Inventario y Lavadores, autorizar descuentos y ver Reportes.",
  },
  {
    value: "dueno",
    label: "Dueño",
    descripcion: "Acceso total: catálogo de Servicios, Ajustes, Usuarios y todo lo demás.",
  },
];

const ROL_BADGE_CLASS: Record<RolUsuario, string> = {
  dueno: "border-primary/40 bg-primary/10 text-primary",
  encargado: "border-accent/40 bg-accent/10 text-accent",
  cajero: "border-muted/40 bg-muted/10 text-muted",
};

const emptyForm = {
  nombre: "",
  correo: "",
  password: "",
  rol: "cajero" as RolUsuario,
  puedeEditarTickets: false,
  puedeEditarTurnos: false,
  puedeEliminarTurnos: false,
};

export function UsuariosClient({
  usuarios,
  usuarioActualId,
}: {
  usuarios: UsuarioConCorreo[];
  usuarioActualId: string;
}) {
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [mostrarForm, setMostrarForm] = useState(false);

  function abrirEdicion(u: UsuarioConCorreo) {
    setEditandoId(u.id);
    setForm({
      nombre: u.nombre,
      correo: u.email ?? "",
      password: "",
      rol: u.rol,
      puedeEditarTickets: u.puede_editar_tickets,
      puedeEditarTurnos: u.puede_editar_turnos,
      puedeEliminarTurnos: u.puede_eliminar_turnos,
    });
    setError(null);
    setAviso(null);
    setMostrarForm(true);
  }

  function abrirNuevo() {
    setEditandoId(null);
    setForm(emptyForm);
    setError(null);
    setAviso(null);
    setMostrarForm(true);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setAviso(null);

    if (!form.nombre.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }
    if (!form.correo.trim() || !form.correo.includes("@")) {
      setError("Ingresa un correo válido (puede ser cualquier texto tipo correo, funciona como usuario).");
      return;
    }
    if (form.password && form.password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    if (editandoId) {
      actualizar();
      return;
    }

    if (!form.password) {
      setError("La contraseña es obligatoria.");
      return;
    }

    startTransition(async () => {
      const result = await crearUsuario({
        nombre: form.nombre.trim(),
        correo: form.correo.trim(),
        password: form.password,
        rol: form.rol,
        puedeEditarTickets: form.puedeEditarTickets,
        puedeEditarTurnos: form.puedeEditarTurnos,
        puedeEliminarTurnos: form.puedeEliminarTurnos,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setMostrarForm(false);
      setForm(emptyForm);
      setAviso(`Cuenta creada para ${form.correo.trim()}, ya activa (no necesita confirmar nada).`);
    });

    function actualizar() {
      startTransition(async () => {
        const result = await actualizarUsuario(editandoId!, {
          nombre: form.nombre.trim(),
          rol: form.rol,
          puedeEditarTickets: form.puedeEditarTickets,
          puedeEditarTurnos: form.puedeEditarTurnos,
          puedeEliminarTurnos: form.puedeEliminarTurnos,
          correo: form.correo.trim(),
          password: form.password || undefined,
        });
        if (result.error) {
          setError(result.error);
          return;
        }
        setMostrarForm(false);
        setForm(emptyForm);
        setEditandoId(null);
        setAviso("Cambios guardados.");
      });
    }
  }

  function handleToggle(u: UsuarioConCorreo) {
    setError(null);
    startTransition(async () => {
      const result = await toggleActivoUsuario(u.id, !u.activo);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        {!mostrarForm ? (
          <button
            onClick={abrirNuevo}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-all duration-150 hover:-translate-y-0.5 hover:bg-primary-hover hover:shadow-lg hover:shadow-primary/25"
          >
            + Nuevo usuario
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
                  placeholder="María López"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted">Correo (funciona como usuario)</label>
                <input
                  type="text"
                  value={form.correo}
                  onChange={(e) => setForm((f) => ({ ...f, correo: e.target.value }))}
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                  placeholder="maria@elhongo.com"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted">
                  {editandoId ? "Nueva contraseña (opcional)" : "Contraseña"}
                </label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                  placeholder={editandoId ? "Dejar vacío para no cambiarla" : "Mínimo 6 caracteres"}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted">Rol</label>
                <select
                  value={form.rol}
                  onChange={(e) => setForm((f) => ({ ...f, rol: e.target.value as RolUsuario }))}
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                >
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <p className="text-xs text-muted">{ROLES.find((r) => r.value === form.rol)?.descripcion}</p>

            {form.rol === "dueno" ? (
              <p className="text-xs text-muted">
                El dueño ya puede editar/eliminar tickets y turnos siempre, sin necesidad de estas casillas.
              </p>
            ) : (
              <>
                <label className="flex items-start gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={form.puedeEditarTickets}
                    onChange={(e) => setForm((f) => ({ ...f, puedeEditarTickets: e.target.checked }))}
                    className="mt-0.5"
                  />
                  <span>
                    Puede editar o eliminar tickets ya en proceso
                    <span className="block text-xs text-muted">
                      Permiso aparte del rol: deja corregir o borrar un ticket (paquete, tamaño, lavador) aunque ya
                      no esté &quot;en espera&quot;.
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={form.puedeEditarTurnos}
                    onChange={(e) => setForm((f) => ({ ...f, puedeEditarTurnos: e.target.checked }))}
                    className="mt-0.5"
                  />
                  <span>
                    Puede editar turnos ya cerrados
                    <span className="block text-xs text-muted">
                      Deja corregir el efectivo inicial o el efectivo contado de un cierre de caja pasado (la
                      diferencia se recalcula sola).
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={form.puedeEliminarTurnos}
                    onChange={(e) => setForm((f) => ({ ...f, puedeEliminarTurnos: e.target.checked }))}
                    className="mt-0.5"
                  />
                  <span>
                    Puede eliminar turnos
                    <span className="block text-xs text-muted">
                      Permiso más fuerte: borra el turno (abierto o cerrado) por completo, junto con todos sus
                      tickets y pagos. No se puede deshacer.
                    </span>
                  </span>
                </label>
              </>
            )}

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={pending}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:opacity-60"
              >
                {pending ? "Guardando..." : editandoId ? "Guardar" : "Crear usuario"}
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
        {aviso && !error && (
          <p className="mt-2 rounded-lg border border-success/40 bg-success/10 px-3 py-2 text-sm text-success">
            {aviso}
          </p>
        )}
      </div>

      <div className="rounded-xl border border-border bg-background p-4 text-xs text-muted">
        <p className="mb-1 font-semibold text-foreground">Qué puede hacer cada rol</p>
        <ul className="flex flex-col gap-0.5">
          {ROLES.map((r) => (
            <li key={r.value}>
              <span className="font-medium text-foreground">{r.label}:</span> {r.descripcion}
            </li>
          ))}
        </ul>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-hover text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Correo</th>
              <th className="px-4 py-3">Rol</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id} className="border-t border-border transition-colors hover:bg-surface-hover">
                <td className="px-4 py-3 text-foreground">
                  {u.nombre}
                  {u.id === usuarioActualId && <span className="ml-1.5 text-xs text-muted">(tú)</span>}
                </td>
                <td className="px-4 py-3 text-muted">{u.email ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${ROL_BADGE_CLASS[u.rol]}`}>
                    {ROLES.find((r) => r.value === u.rol)?.label ?? u.rol}
                  </span>
                  {u.rol !== "dueno" && u.puede_editar_tickets && (
                    <span
                      className="ml-1.5 rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-[10px] font-medium text-warning"
                      title="Puede editar/eliminar tickets ya en proceso"
                    >
                      + tickets
                    </span>
                  )}
                  {u.rol !== "dueno" && u.puede_editar_turnos && (
                    <span
                      className="ml-1.5 rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-[10px] font-medium text-warning"
                      title="Puede editar turnos ya cerrados"
                    >
                      + turnos
                    </span>
                  )}
                  {u.rol !== "dueno" && u.puede_eliminar_turnos && (
                    <span
                      className="ml-1.5 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary"
                      title="Puede eliminar turnos por completo"
                    >
                      + eliminar turnos
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                      u.activo
                        ? "border-success/40 bg-success/15 text-success"
                        : "border-muted/40 bg-muted/10 text-muted"
                    }`}
                  >
                    {u.activo ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => abrirEdicion(u)} className="text-xs text-accent hover:underline">
                      Editar
                    </button>
                    <button
                      onClick={() => handleToggle(u)}
                      disabled={pending || u.id === usuarioActualId}
                      className="text-xs text-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {u.activo ? "Desactivar" : "Activar"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {usuarios.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted">
                  Sin usuarios registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

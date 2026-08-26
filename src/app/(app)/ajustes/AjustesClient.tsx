"use client";

import { useState, useTransition, type FormEvent } from "react";
import type { ConfiguracionApp } from "@/types/database.types";
import { actualizarConfiguracion, restablecerConfiguracion, type ConfiguracionInput } from "./actions";

function Campo({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-muted">{label}</label>
      {children}
    </div>
  );
}

const inputClass =
  "rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent";

export function AjustesClient({ configuracion }: { configuracion: ConfiguracionApp }) {
  const [form, setForm] = useState<ConfiguracionInput>(() => ({
    nav_dashboard: configuracion.nav_dashboard,
    nav_tickets: configuracion.nav_tickets,
    nav_servicios: configuracion.nav_servicios,
    nav_lavadores: configuracion.nav_lavadores,
    nav_turnos: configuracion.nav_turnos,
    nav_clientes: configuracion.nav_clientes,
    nav_inventario: configuracion.nav_inventario,
    nav_reportes: configuracion.nav_reportes,
    emoji_saludo: configuracion.emoji_saludo,
    emoji_lavador: configuracion.emoji_lavador,
    emoji_automovil: configuracion.emoji_automovil,
    emoji_camioneta_chica: configuracion.emoji_camioneta_chica,
    emoji_camioneta_grande: configuracion.emoji_camioneta_grande,
    emoji_camioneta_extra_grande: configuracion.emoji_camioneta_extra_grande,
    color_primario: configuracion.color_primario,
    color_accent: configuracion.color_accent,
    color_success: configuracion.color_success,
    color_warning: configuracion.color_warning,
    semaforo_alerta_min: configuracion.semaforo_alerta_min,
    semaforo_critico_min: configuracion.semaforo_critico_min,
  }));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);

  function set<K extends keyof ConfiguracionInput>(key: K, value: ConfiguracionInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setGuardado(false);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (form.semaforo_critico_min <= form.semaforo_alerta_min) {
      setError("El umbral crítico del semáforo debe ser mayor al de alerta.");
      return;
    }

    startTransition(async () => {
      const result = await actualizarConfiguracion(form);
      if (result.error) {
        setError(result.error);
        return;
      }
      setGuardado(true);
    });
  }

  function handleRestablecer() {
    if (!window.confirm("¿Restablecer todos los ajustes a los valores originales?")) return;
    setError(null);
    startTransition(async () => {
      const result = await restablecerConfiguracion();
      if (result.error) {
        setError(result.error);
        return;
      }
      window.location.reload();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2 className="font-semibold text-foreground">Nombres del menú lateral</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Campo label="Dashboard">
            <input className={inputClass} value={form.nav_dashboard} onChange={(e) => set("nav_dashboard", e.target.value)} />
          </Campo>
          <Campo label="Tickets">
            <input className={inputClass} value={form.nav_tickets} onChange={(e) => set("nav_tickets", e.target.value)} />
          </Campo>
          <Campo label="Servicios">
            <input className={inputClass} value={form.nav_servicios} onChange={(e) => set("nav_servicios", e.target.value)} />
          </Campo>
          <Campo label="Lavadores">
            <input className={inputClass} value={form.nav_lavadores} onChange={(e) => set("nav_lavadores", e.target.value)} />
          </Campo>
          <Campo label="Caja y turnos">
            <input className={inputClass} value={form.nav_turnos} onChange={(e) => set("nav_turnos", e.target.value)} />
          </Campo>
          <Campo label="Clientes">
            <input className={inputClass} value={form.nav_clientes} onChange={(e) => set("nav_clientes", e.target.value)} />
          </Campo>
          <Campo label="Inventario">
            <input className={inputClass} value={form.nav_inventario} onChange={(e) => set("nav_inventario", e.target.value)} />
          </Campo>
          <Campo label="Reportes">
            <input className={inputClass} value={form.nav_reportes} onChange={(e) => set("nav_reportes", e.target.value)} />
          </Campo>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold text-foreground">Emojis</h2>
        <p className="text-xs text-muted">
          Pega o escribe el emoji que quieras usar en cada uno (por ejemplo, desde el teclado de emojis de tu
          celular o computadora).
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Campo label="Saludo del dashboard">
            <input
              className={`${inputClass} text-center text-lg`}
              value={form.emoji_saludo}
              onChange={(e) => set("emoji_saludo", e.target.value)}
            />
          </Campo>
          <Campo label="Lavador">
            <input
              className={`${inputClass} text-center text-lg`}
              value={form.emoji_lavador}
              onChange={(e) => set("emoji_lavador", e.target.value)}
            />
          </Campo>
          <Campo label="Automóvil">
            <input
              className={`${inputClass} text-center text-lg`}
              value={form.emoji_automovil}
              onChange={(e) => set("emoji_automovil", e.target.value)}
            />
          </Campo>
          <Campo label="Camioneta chica">
            <input
              className={`${inputClass} text-center text-lg`}
              value={form.emoji_camioneta_chica}
              onChange={(e) => set("emoji_camioneta_chica", e.target.value)}
            />
          </Campo>
          <Campo label="Camioneta grande">
            <input
              className={`${inputClass} text-center text-lg`}
              value={form.emoji_camioneta_grande}
              onChange={(e) => set("emoji_camioneta_grande", e.target.value)}
            />
          </Campo>
          <Campo label="Camioneta extra grande">
            <input
              className={`${inputClass} text-center text-lg`}
              value={form.emoji_camioneta_extra_grande}
              onChange={(e) => set("emoji_camioneta_extra_grande", e.target.value)}
            />
          </Campo>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold text-foreground">Colores</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Campo label="Primario (marca / header)">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={form.color_primario}
                onChange={(e) => set("color_primario", e.target.value)}
                className="h-9 w-9 cursor-pointer rounded border border-border bg-background"
              />
              <input
                className={`${inputClass} flex-1`}
                value={form.color_primario}
                onChange={(e) => set("color_primario", e.target.value)}
              />
            </div>
          </Campo>
          <Campo label="Acento (enlaces)">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={form.color_accent}
                onChange={(e) => set("color_accent", e.target.value)}
                className="h-9 w-9 cursor-pointer rounded border border-border bg-background"
              />
              <input
                className={`${inputClass} flex-1`}
                value={form.color_accent}
                onChange={(e) => set("color_accent", e.target.value)}
              />
            </div>
          </Campo>
          <Campo label="Éxito (pagado, en orden)">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={form.color_success}
                onChange={(e) => set("color_success", e.target.value)}
                className="h-9 w-9 cursor-pointer rounded border border-border bg-background"
              />
              <input
                className={`${inputClass} flex-1`}
                value={form.color_success}
                onChange={(e) => set("color_success", e.target.value)}
              />
            </div>
          </Campo>
          <Campo label="Advertencia (alerta)">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={form.color_warning}
                onChange={(e) => set("color_warning", e.target.value)}
                className="h-9 w-9 cursor-pointer rounded border border-border bg-background"
              />
              <input
                className={`${inputClass} flex-1`}
                value={form.color_warning}
                onChange={(e) => set("color_warning", e.target.value)}
              />
            </div>
          </Campo>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold text-foreground">Semáforo de espera (Tickets)</h2>
        <p className="text-xs text-muted">
          Minutos desde que se levanta el ticket antes de que la tarjeta cambie de color.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:max-w-sm">
          <Campo label="Amarillo (alerta) a partir de">
            <input
              type="number"
              min="1"
              className={inputClass}
              value={form.semaforo_alerta_min}
              onChange={(e) => set("semaforo_alerta_min", Number(e.target.value))}
            />
          </Campo>
          <Campo label="Rojo (crítico) a partir de">
            <input
              type="number"
              min="1"
              className={inputClass}
              value={form.semaforo_critico_min}
              onChange={(e) => set("semaforo_critico_min", Number(e.target.value))}
            />
          </Campo>
        </div>
      </section>

      {error && (
        <p className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm text-primary">{error}</p>
      )}
      {guardado && !error && (
        <p className="rounded-lg border border-success/40 bg-success/10 px-3 py-2 text-sm text-success">
          Cambios guardados.
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-primary px-4 py-2.5 font-semibold text-white transition hover:bg-primary-hover disabled:opacity-60"
        >
          {pending ? "Guardando..." : "Guardar cambios"}
        </button>
        <button
          type="button"
          onClick={handleRestablecer}
          disabled={pending}
          className="rounded-lg border border-border px-4 py-2.5 text-sm text-muted transition hover:text-foreground disabled:opacity-60"
        >
          Restablecer valores originales
        </button>
      </div>
    </form>
  );
}

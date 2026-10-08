import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { inicioDeDiaMXDesdeFecha, finDeDiaMXDesdeFecha } from "@/lib/fecha";
import {
  ACCION_EMOJI,
  ACCION_LABEL,
  ACCIONES_CAMBIO,
  ENTIDAD_LABEL,
  BENJAMIN_USER_ID,
  tiempoRelativo,
  type AccionHistorial,
  type EntidadHistorial,
} from "@/lib/historial";
import { HistorialRowActions } from "./HistorialRowActions";

const PAGE_SIZE = 100;

function construirHref(params: Record<string, string | undefined>) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) qs.set(k, v);
  }
  const s = qs.toString();
  return s ? `/historial?${s}` : "/historial";
}

export default async function HistorialPage({
  searchParams,
}: {
  searchParams: Promise<{
    tipo?: string;
    usuario?: string;
    entidad?: string;
    desde?: string;
    hasta?: string;
    pagina?: string;
  }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // El RLS de historial_movimientos ya bloquea esta tabla a nivel de base
  // de datos para cualquier cuenta sin puede_ver_historial — esto solo
  // decide la redirección/UX de la página.
  const { data: actor } = await supabase
    .from("usuarios")
    .select("puede_ver_historial")
    .eq("id", user.id)
    .maybeSingle();

  if (!actor?.puede_ver_historial) {
    redirect("/");
  }

  // Editar/eliminar renglones es exclusivo de Benjamin — ni siquiera otras
  // cuentas con puede_ver_historial (ej. Pepe) tienen esta opción.
  const esBenjamin = user.id === BENJAMIN_USER_ID;

  const filtroTipo = (params.tipo === "cambios" || params.tipo === "actividad" ? params.tipo : "todos") as
    | "todos"
    | "cambios"
    | "actividad";
  const filtroUsuario = params.usuario ?? "";
  const filtroEntidad = (params.entidad ?? "") as EntidadHistorial | "";
  const filtroDesde = params.desde ?? "";
  const filtroHasta = params.hasta ?? "";
  const pagina = Math.max(1, Number(params.pagina ?? "1") || 1);

  const { data: usuarios } = await supabase.from("usuarios").select("id, nombre").order("nombre");

  let query = supabase
    .from("historial_movimientos")
    .select("id, usuario_nombre, accion, entidad, entidad_id, resumen, creado_en", { count: "exact" })
    .order("creado_en", { ascending: false });

  if (filtroTipo === "cambios") query = query.in("accion", ACCIONES_CAMBIO);
  if (filtroTipo === "actividad") query = query.eq("accion", "ver");
  if (filtroUsuario) query = query.eq("usuario_id", filtroUsuario);
  if (filtroEntidad) query = query.eq("entidad", filtroEntidad);
  if (filtroDesde) query = query.gte("creado_en", inicioDeDiaMXDesdeFecha(filtroDesde).toISOString());
  if (filtroHasta) query = query.lte("creado_en", finDeDiaMXDesdeFecha(filtroHasta).toISOString());

  const offset = (pagina - 1) * PAGE_SIZE;
  query = query.range(offset, offset + PAGE_SIZE - 1);

  const { data: movimientos, count } = await query;

  const totalPaginas = count ? Math.max(1, Math.ceil(count / PAGE_SIZE)) : 1;
  const hayFiltro = Boolean(filtroTipo !== "todos" || filtroUsuario || filtroEntidad || filtroDesde || filtroHasta);
  const paramsActuales = {
    tipo: filtroTipo !== "todos" ? filtroTipo : undefined,
    usuario: filtroUsuario || undefined,
    entidad: filtroEntidad || undefined,
    desde: filtroDesde || undefined,
    hasta: filtroHasta || undefined,
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Histórico de movimientos</h1>
        <p className="text-sm text-muted">
          Quién hizo qué y en qué está entrando cada quien dentro del sistema — solo tú ves esto.
        </p>
      </div>

      <form className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
        <p className="text-xs font-medium text-muted">Filtra por tipo, quién, en qué sección y fechas.</p>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="tipo" className="text-[11px] text-muted">
              Tipo
            </label>
            <select
              id="tipo"
              name="tipo"
              defaultValue={filtroTipo}
              className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-accent"
            >
              <option value="todos">Todos</option>
              <option value="cambios">Solo cambios (crear/editar/eliminar/turnos)</option>
              <option value="actividad">Solo actividad (qué consultó cada quien)</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="usuario" className="text-[11px] text-muted">
              Usuario
            </label>
            <select
              id="usuario"
              name="usuario"
              defaultValue={filtroUsuario}
              className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-accent"
            >
              <option value="">Todos</option>
              {(usuarios ?? []).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="entidad" className="text-[11px] text-muted">
              Sección
            </label>
            <select
              id="entidad"
              name="entidad"
              defaultValue={filtroEntidad}
              className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-accent"
            >
              <option value="">Todas</option>
              {Object.entries(ENTIDAD_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="desde" className="text-[11px] text-muted">
              Desde
            </label>
            <input
              id="desde"
              type="date"
              name="desde"
              defaultValue={filtroDesde}
              className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-accent"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="hasta" className="text-[11px] text-muted">
              Hasta
            </label>
            <input
              id="hasta"
              type="date"
              name="hasta"
              defaultValue={filtroHasta}
              className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-accent"
            />
          </div>
          <button
            type="submit"
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
              hayFiltro ? "border-primary bg-primary/10 text-primary" : "border-border text-muted hover:text-foreground"
            }`}
          >
            Filtrar
          </button>
          {hayFiltro && (
            <Link
              href="/historial"
              className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted hover:text-foreground"
            >
              Quitar filtros
            </Link>
          )}
        </div>
      </form>

      <div className="flex flex-col gap-1 rounded-xl border border-border bg-surface p-2">
        {(movimientos ?? []).map((m) => (
          <div key={m.id} className="flex items-start gap-2.5 rounded-lg px-3 py-2.5 text-sm hover:bg-surface-hover">
            <span className="mt-0.5 text-base">{ACCION_EMOJI[m.accion as AccionHistorial] ?? "•"}</span>
            <div className="min-w-0 flex-1">
              <p className="text-foreground">
                <span className="font-medium">{m.usuario_nombre}</span> — {m.resumen}
              </p>
              <p className="text-xs text-muted">
                {new Date(m.creado_en).toLocaleString("es-MX", { timeZone: "America/Mexico_City" })} ·{" "}
                {tiempoRelativo(m.creado_en)} ·{" "}
                <span className="uppercase tracking-wide">
                  {ACCION_LABEL[m.accion as AccionHistorial] ?? m.accion}
                </span>
              </p>
              {esBenjamin && <HistorialRowActions id={m.id} resumenActual={m.resumen} />}
            </div>
          </div>
        ))}
        {(!movimientos || movimientos.length === 0) && (
          <p className="px-3 py-8 text-center text-sm text-muted">No hay movimientos con este filtro.</p>
        )}
      </div>

      {count !== null && count !== undefined && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
          <span>
            Página {pagina} de {totalPaginas} — {count} movimiento{count === 1 ? "" : "s"}
          </span>
          <div className="flex gap-2">
            {pagina > 1 && (
              <Link
                href={construirHref({ ...paramsActuales, pagina: String(pagina - 1) })}
                className="rounded-lg border border-border px-3 py-1.5 hover:text-foreground"
              >
                ← Anterior
              </Link>
            )}
            {pagina < totalPaginas && (
              <Link
                href={construirHref({ ...paramsActuales, pagina: String(pagina + 1) })}
                className="rounded-lg border border-border px-3 py-1.5 hover:text-foreground"
              >
                Siguiente →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

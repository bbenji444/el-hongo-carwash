import Link from "next/link";
import { PERIODOS, type RangoResuelto } from "@/lib/rangoFechas";
import { TAMANOS_VEHICULO, nombreTamano } from "@/lib/servicios";
import type { TicketDetalleFila, FiltrosTicketsDetalle } from "@/lib/ticketsDetalle";
import type { PagoMetodo } from "@/types/database.types";

function money(n: number) {
  return `$${n.toFixed(2)}`;
}

const ESTADO_LABEL: Record<string, string> = {
  en_espera: "En espera",
  en_proceso: "En proceso",
  terminado: "Terminado",
  entregado: "Entregado",
};

const METODO_LABEL: Record<PagoMetodo, string> = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  transferencia: "Transferencia",
  membresia: "Membresía",
};

function construirHref(basePath: string, params: Record<string, string | undefined>) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) qs.set(k, v);
  }
  const s = qs.toString();
  return s ? `${basePath}?${s}` : basePath;
}

export function TicketsDetalleSeccion({
  basePath,
  rango,
  filtros,
  filas,
  totalCoincidencias,
  lavadoresPresentes,
  serviciosPresentes,
  incluirPeriodo,
}: {
  basePath: string;
  rango: RangoResuelto;
  filtros: FiltrosTicketsDetalle;
  filas: TicketDetalleFila[];
  totalCoincidencias: number;
  lavadoresPresentes: [string, string][];
  serviciosPresentes: [string, string][];
  incluirPeriodo: boolean;
}) {
  const paramsActuales = {
    periodo: incluirPeriodo ? rango.periodo : undefined,
    desde: incluirPeriodo ? rango.desdeInput || undefined : undefined,
    hasta: incluirPeriodo ? rango.hastaInput || undefined : undefined,
    servicio: filtros.servicio || undefined,
    tamano: filtros.tamano || undefined,
    metodo: filtros.metodo || undefined,
    lavador: filtros.lavador || undefined,
    q: filtros.q || undefined,
  };

  const hayFiltro = Boolean(
    filtros.servicio || filtros.tamano || filtros.metodo || filtros.lavador || filtros.q || rango.personalizado
  );

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="font-semibold text-foreground">Buscar tickets</h2>
        <p className="text-xs text-muted">
          Busca en todo el histórico (no solo un turno): por paquete, tamaño, método de pago, lavador, o el carro/placa
          directo en un solo cuadro.
        </p>
      </div>

      {incluirPeriodo && (
        <div className="flex gap-2">
          {PERIODOS.map((p) => (
            <Link
              key={p.value}
              href={construirHref(basePath, { ...paramsActuales, periodo: p.value, desde: undefined, hasta: undefined })}
              className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                !rango.personalizado && p.value === rango.periodo
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted hover:text-foreground"
              }`}
            >
              {p.label}
            </Link>
          ))}
        </div>
      )}

      <form className="flex flex-wrap items-end gap-2 rounded-xl border border-border bg-surface px-4 py-3">
        {incluirPeriodo && (
          <>
            <div className="flex flex-col gap-1">
              <label htmlFor="td-desde" className="text-[11px] text-muted">
                Desde
              </label>
              <input
                id="td-desde"
                type="date"
                name="desde"
                defaultValue={rango.desdeInput}
                className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-accent"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="td-hasta" className="text-[11px] text-muted">
                Hasta
              </label>
              <input
                id="td-hasta"
                type="date"
                name="hasta"
                defaultValue={rango.hastaInput}
                className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-accent"
              />
            </div>
          </>
        )}
        {!incluirPeriodo && (
          <>
            <input type="hidden" name="periodo" value={rango.periodo} />
            <input type="hidden" name="desde" value={rango.desdeInput} />
            <input type="hidden" name="hasta" value={rango.hastaInput} />
          </>
        )}
        <div className="flex flex-col gap-1">
          <label htmlFor="td-servicio" className="text-[11px] text-muted">
            Paquete
          </label>
          <select
            id="td-servicio"
            name="servicio"
            defaultValue={filtros.servicio ?? ""}
            className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-accent"
          >
            <option value="">Todos</option>
            {serviciosPresentes.map(([id, nombre]) => (
              <option key={id} value={id}>
                {nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="td-tamano" className="text-[11px] text-muted">
            Tamaño
          </label>
          <select
            id="td-tamano"
            name="tamano"
            defaultValue={filtros.tamano ?? ""}
            className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-accent"
          >
            <option value="">Todos</option>
            {TAMANOS_VEHICULO.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="td-metodo" className="text-[11px] text-muted">
            Método de pago
          </label>
          <select
            id="td-metodo"
            name="metodo"
            defaultValue={filtros.metodo ?? ""}
            className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-accent"
          >
            <option value="">Todos</option>
            {(Object.entries(METODO_LABEL) as [PagoMetodo, string][]).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="td-lavador" className="text-[11px] text-muted">
            Lavador
          </label>
          <select
            id="td-lavador"
            name="lavador"
            defaultValue={filtros.lavador ?? ""}
            className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-accent"
          >
            <option value="">Todos</option>
            {lavadoresPresentes.map(([id, nombre]) => (
              <option key={id} value={id}>
                {nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="td-q" className="text-[11px] text-muted">
            Buscar carro o placa
          </label>
          <input
            id="td-q"
            name="q"
            defaultValue={filtros.q ?? ""}
            placeholder="Ej. Jetta o ABC-123"
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
            href={basePath}
            className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted hover:text-foreground"
          >
            Quitar filtros
          </Link>
        )}
      </form>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-hover text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Carro / Placa</th>
              <th className="px-4 py-3">Paquete</th>
              <th className="px-4 py-3">Tamaño</th>
              <th className="px-4 py-3">Lavador</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Método</th>
              <th className="px-4 py-3 text-right">Monto</th>
              <th className="px-4 py-3 text-right">Turno</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.id} className="border-t border-border transition-colors hover:bg-surface-hover">
                <td className="px-4 py-3 text-muted">
                  {new Date(f.horaEntrada).toLocaleString("es-MX", {
                    dateStyle: "short",
                    timeStyle: "short",
                    timeZone: "America/Mexico_City",
                  })}
                </td>
                <td className="px-4 py-3 text-foreground">{f.cliente}</td>
                <td className="px-4 py-3 text-muted">{f.distintivoPlaca}</td>
                <td className="px-4 py-3 text-foreground">{f.servicio}</td>
                <td className="px-4 py-3 text-muted">{nombreTamano(f.tamanoVehiculo)}</td>
                <td className="px-4 py-3 text-muted">{f.lavador}</td>
                <td className="px-4 py-3 text-muted">{ESTADO_LABEL[f.estado] ?? f.estado}</td>
                <td className="px-4 py-3 text-muted">{f.metodo}</td>
                <td className="px-4 py-3 text-right font-medium text-foreground">{money(f.monto)}</td>
                <td className="px-4 py-3 text-right">
                  {f.turnoId && (
                    <Link href={`/reportes/turnos/${f.turnoId}`} className="text-xs text-accent hover:underline">
                      Ver →
                    </Link>
                  )}
                </td>
              </tr>
            ))}
            {filas.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-6 text-center text-muted">
                  {hayFiltro ? "Ningún ticket coincide con esta búsqueda." : "Sin tickets en este período."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {totalCoincidencias > filas.length && (
        <p className="text-xs text-muted">
          Mostrando los {filas.length} más recientes de {totalCoincidencias} que coinciden — acota más la búsqueda
          (lavador, placa, fechas) para ver un grupo más chico.
        </p>
      )}
    </div>
  );
}

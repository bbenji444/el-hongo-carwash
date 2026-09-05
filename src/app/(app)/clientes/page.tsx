import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TAMANOS_VEHICULO } from "@/lib/servicios";
import { ClientesClient } from "./ClientesClient";

const POR_PAGINA = 50;

type Orden = "nombre" | "visitas_desc" | "visitas_asc";

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tipo?: string; orden?: string; page?: string }>;
}) {
  const { q, tipo, orden: ordenParam, page: pageParam } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const orden: Orden = ordenParam === "visitas_desc" || ordenParam === "visitas_asc" ? ordenParam : "nombre";

  const pagina = Math.max(1, Number(pageParam) || 1);
  const desde = (pagina - 1) * POR_PAGINA;
  const hasta = desde + POR_PAGINA - 1;

  let query = supabase
    .from("clientes_con_stats")
    .select("id, nombre, telefono, total_visitas, ultima_lavada, tipos_vehiculo, placas", { count: "exact" });

  if (q) query = query.ilike("nombre", `%${q}%`);
  if (tipo) query = query.overlaps("tipos_vehiculo", [tipo]);

  if (orden === "visitas_desc") query = query.order("total_visitas", { ascending: false });
  else if (orden === "visitas_asc") query = query.order("total_visitas", { ascending: true });
  else query = query.order("nombre", { ascending: true });

  const { data: clientes, count: totalClientes } = await query.range(desde, hasta);

  const totalPaginas = Math.max(1, Math.ceil((totalClientes ?? 0) / POR_PAGINA));

  const clientesConDetalle = (clientes ?? []).map((c) => ({
    id: c.id,
    nombre: c.nombre,
    telefono: c.telefono,
    placas: c.placas,
    totalVisitas: c.total_visitas,
    ultimaLavada: c.ultima_lavada,
    lavadasEnCiclo: c.total_visitas % 6,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Clientes</h1>
        <p className="text-sm text-muted">
          Directorio de clientes, vehículos y programa de lealtad (6ª lavada gratis) — {totalClientes ?? 0} cliente
          {(totalClientes ?? 0) === 1 ? "" : "s"} en total.
        </p>
      </div>

      <form className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-muted">Buscar por nombre</label>
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Ej. Mazda, Juan Pérez..."
            className="w-full max-w-xs rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-muted">Tipo de vehículo</label>
          <select
            name="tipo"
            defaultValue={tipo ?? ""}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
          >
            <option value="">Todos</option>
            {TAMANOS_VEHICULO.map((t) => (
              <option key={t.value} value={t.label}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-muted">Ordenar por</label>
          <select
            name="orden"
            defaultValue={orden}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
          >
            <option value="nombre">Nombre (A-Z)</option>
            <option value="visitas_desc">Más visitas primero</option>
            <option value="visitas_asc">Menos visitas primero</option>
          </select>
        </div>
        <button
          type="submit"
          className="rounded-lg border border-border px-4 py-2 text-sm text-muted transition hover:text-foreground"
        >
          Filtrar
        </button>
        {(q || tipo || (ordenParam && ordenParam !== "nombre")) && (
          <Link
            href="/clientes"
            className="rounded-lg border border-border px-4 py-2 text-sm text-muted transition hover:text-foreground"
          >
            Limpiar
          </Link>
        )}
      </form>

      <ClientesClient clientes={clientesConDetalle} />

      {totalPaginas > 1 && (
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          <Link
            href={hrefPagina(Math.max(1, pagina - 1), { q, tipo, orden })}
            aria-disabled={pagina === 1}
            className={`rounded-lg border border-border px-3 py-1.5 text-sm transition ${
              pagina === 1 ? "pointer-events-none opacity-40" : "text-muted hover:text-foreground"
            }`}
          >
            ← Anterior
          </Link>

          {paginasVisibles(pagina, totalPaginas).map((p, i) =>
            p === "..." ? (
              <span key={`ellipsis-${i}`} className="px-1 text-sm text-muted">
                …
              </span>
            ) : (
              <Link
                key={p}
                href={hrefPagina(p, { q, tipo, orden })}
                className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                  p === pagina
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted hover:text-foreground"
                }`}
              >
                {p}
              </Link>
            )
          )}

          <Link
            href={hrefPagina(Math.min(totalPaginas, pagina + 1), { q, tipo, orden })}
            aria-disabled={pagina === totalPaginas}
            className={`rounded-lg border border-border px-3 py-1.5 text-sm transition ${
              pagina === totalPaginas ? "pointer-events-none opacity-40" : "text-muted hover:text-foreground"
            }`}
          >
            Siguiente →
          </Link>
        </div>
      )}
    </div>
  );
}

function hrefPagina(pagina: number, filtros: { q?: string; tipo?: string; orden?: Orden }) {
  const params = new URLSearchParams();
  if (filtros.q) params.set("q", filtros.q);
  if (filtros.tipo) params.set("tipo", filtros.tipo);
  if (filtros.orden && filtros.orden !== "nombre") params.set("orden", filtros.orden);
  if (pagina > 1) params.set("page", String(pagina));
  const qs = params.toString();
  return qs ? `/clientes?${qs}` : "/clientes";
}

// Ventana de números de página tipo "1 2 3 4 5 ... 12": siempre muestra la
// primera, la última, y unas cuantas alrededor de la actual, con "..." en
// los huecos — para no imprimir 40 botones cuando hay muchas páginas.
function paginasVisibles(actual: number, total: number): (number | "...")[] {
  const rango = 2;
  const paginas = new Set<number>([1, total]);
  for (let p = actual - rango; p <= actual + rango; p++) {
    if (p >= 1 && p <= total) paginas.add(p);
  }
  const ordenadas = Array.from(paginas).sort((a, b) => a - b);

  const resultado: (number | "...")[] = [];
  for (let i = 0; i < ordenadas.length; i++) {
    if (i > 0 && ordenadas[i] - ordenadas[i - 1] > 1) resultado.push("...");
    resultado.push(ordenadas[i]);
  }
  return resultado;
}

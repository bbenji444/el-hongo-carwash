import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ClientesClient } from "./ClientesClient";

const POR_PAGINA = 50;

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q, page: pageParam } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const pagina = Math.max(1, Number(pageParam) || 1);
  const desde = (pagina - 1) * POR_PAGINA;
  const hasta = desde + POR_PAGINA - 1;

  let query = supabase
    .from("clientes")
    .select("id, nombre, telefono", { count: "exact" })
    .order("nombre")
    .range(desde, hasta);
  if (q) {
    query = query.ilike("nombre", `%${q}%`);
  }
  const { data: clientes, count: totalClientes } = await query;

  const totalPaginas = Math.max(1, Math.ceil((totalClientes ?? 0) / POR_PAGINA));

  const clienteIds = (clientes ?? []).map((c) => c.id);

  const [{ data: vehiculos }, { data: ticketsEntregados }] = await Promise.all([
    clienteIds.length
      ? supabase.from("vehiculos").select("cliente_id, placas").in("cliente_id", clienteIds)
      : Promise.resolve({ data: [] }),
    clienteIds.length
      ? supabase
          .from("tickets")
          .select("cliente_id, hora_salida")
          .eq("estado", "entregado")
          .in("cliente_id", clienteIds)
      : Promise.resolve({ data: [] }),
  ]);

  const placasPorCliente = new Map<string, string[]>();
  for (const v of vehiculos ?? []) {
    if (!v.placas) continue;
    const lista = placasPorCliente.get(v.cliente_id) ?? [];
    lista.push(v.placas);
    placasPorCliente.set(v.cliente_id, lista);
  }

  const ultimaLavadaPorCliente = new Map<string, string>();
  const lavadasPorCliente = new Map<string, number>();
  for (const t of ticketsEntregados ?? []) {
    if (!t.cliente_id) continue;
    // Se cuentan TODAS las lavadas entregadas (gratis o no): cada ciclo son
    // 6 lavadas exactas, el residuo módulo 6 vuelve a 0 solo después de la gratis.
    lavadasPorCliente.set(t.cliente_id, (lavadasPorCliente.get(t.cliente_id) ?? 0) + 1);
    if (t.hora_salida) {
      const actual = ultimaLavadaPorCliente.get(t.cliente_id);
      if (!actual || t.hora_salida > actual) {
        ultimaLavadaPorCliente.set(t.cliente_id, t.hora_salida);
      }
    }
  }

  const clientesConDetalle = (clientes ?? []).map((c) => ({
    ...c,
    placas: placasPorCliente.get(c.id) ?? [],
    ultimaLavada: ultimaLavadaPorCliente.get(c.id) ?? null,
    lavadasEnCiclo: (lavadasPorCliente.get(c.id) ?? 0) % 6,
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

      <form className="flex gap-2">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Buscar por nombre..."
          className="w-full max-w-sm rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
        />
        <button
          type="submit"
          className="rounded-lg border border-border px-4 py-2 text-sm text-muted transition hover:text-foreground"
        >
          Buscar
        </button>
        {q && (
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
            href={hrefPagina(Math.max(1, pagina - 1), q)}
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
                href={hrefPagina(p, q)}
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
            href={hrefPagina(Math.min(totalPaginas, pagina + 1), q)}
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

function hrefPagina(pagina: number, q: string | undefined) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
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

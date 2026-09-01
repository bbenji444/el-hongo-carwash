import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ClientesClient } from "./ClientesClient";

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  let query = supabase.from("clientes").select("id, nombre, telefono").order("nombre").limit(50);
  if (q) {
    query = query.ilike("nombre", `%${q}%`);
  }
  const { data: clientes } = await query;

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
        <p className="text-sm text-muted">Directorio de clientes, vehículos y programa de lealtad (6ª lavada gratis).</p>
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
    </div>
  );
}

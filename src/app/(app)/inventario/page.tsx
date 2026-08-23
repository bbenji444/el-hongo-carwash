import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { InventarioClient } from "./InventarioClient";
import { RecetasClient } from "./RecetasClient";
import type { RolUsuario } from "@/types/database.types";

export default async function InventarioPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: usuario } = await supabase
    .from("usuarios")
    .select("rol")
    .eq("id", user.id)
    .maybeSingle();

  if (!usuario) {
    redirect("/login");
  }

  const [{ data: insumos }, { data: servicios }, { data: recetas }] = await Promise.all([
    supabase.from("inventario").select("*").order("nombre_insumo"),
    supabase.from("servicios_catalogo").select("id, nombre").eq("activo", true).order("nombre"),
    supabase.from("consumo_inventario").select("*").order("servicio_id"),
  ]);

  const insumoMap = new Map((insumos ?? []).map((i) => [i.id, i]));
  const servicioMap = new Map((servicios ?? []).map((s) => [s.id, s]));

  const recetasConDetalle = (recetas ?? []).map((r) => ({
    ...r,
    servicio: servicioMap.get(r.servicio_id) ?? null,
    insumo: insumoMap.get(r.insumo_id) ?? null,
  }));

  const rol = usuario.rol as RolUsuario;
  const puedeEditarInsumos = rol === "encargado" || rol === "dueno";
  const puedeEditarRecetas = rol === "dueno";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Inventario</h1>
        <p className="text-sm text-muted">
          Insumos y recetas de consumo por servicio. El stock se descuenta solo al entregar un ticket.
        </p>
      </div>

      <InventarioClient insumos={insumos ?? []} puedeEditar={puedeEditarInsumos} />

      <RecetasClient
        recetas={recetasConDetalle}
        servicios={servicios ?? []}
        insumos={insumos ?? []}
        puedeEditar={puedeEditarRecetas}
      />
    </div>
  );
}

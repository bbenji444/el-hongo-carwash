import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ServiciosClient } from "./ServiciosClient";
import type { ServicioPrecio } from "@/types/database.types";

export default async function ServiciosPage() {
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

  const { data: serviciosBase } = await supabase
    .from("servicios_catalogo")
    .select("*")
    .order("orden")
    .order("nombre");

  const { data: precios } = await supabase.from("servicios_precios").select("*");

  const preciosPorServicio = new Map<string, ServicioPrecio[]>();
  for (const precio of precios ?? []) {
    const lista = preciosPorServicio.get(precio.servicio_id) ?? [];
    lista.push(precio);
    preciosPorServicio.set(precio.servicio_id, lista);
  }

  const servicios = (serviciosBase ?? []).map((s) => ({
    ...s,
    precios: preciosPorServicio.get(s.id) ?? [],
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Catálogo de servicios</h1>
        <p className="text-sm text-muted">
          {usuario.rol === "dueno"
            ? "Puedes crear, editar y desactivar servicios."
            : "Solo el dueño puede modificar el catálogo."}
        </p>
      </div>

      <ServiciosClient servicios={servicios ?? []} esDueno={usuario.rol === "dueno"} />
    </div>
  );
}

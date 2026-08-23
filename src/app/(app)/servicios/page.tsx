import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ServiciosClient } from "./ServiciosClient";

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

  const { data: servicios } = await supabase
    .from("servicios_catalogo")
    .select("*")
    .order("nombre");

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

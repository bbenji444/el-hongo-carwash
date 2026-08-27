import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { obtenerConfiguracion } from "@/lib/configuracion";
import { AjustesClient } from "./AjustesClient";
import { ExtrasManager } from "./ExtrasManager";

export default async function AjustesPage() {
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

  if (usuario.rol !== "dueno") {
    redirect("/");
  }

  const configuracion = await obtenerConfiguracion();
  const { data: extras } = await supabase.from("extras_catalogo").select("*").order("orden").order("nombre");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Ajustes</h1>
        <p className="text-sm text-muted">
          Personaliza textos, emojis, colores y tiempos del semáforo sin tocar código. Los cambios se ven en toda
          la app al guardar.
        </p>
      </div>

      <AjustesClient configuracion={configuracion} />

      <section className="flex flex-col gap-3 border-t border-border pt-6">
        <div>
          <h2 className="font-semibold text-foreground">Extras</h2>
          <p className="text-xs text-muted">
            Complementos opcionales que se pueden agregar a un ticket además del paquete (por ejemplo, Encerado
            premium). Aparecen como opción al crear o editar un ticket.
          </p>
        </div>
        <ExtrasManager extras={extras ?? []} />
      </section>
    </div>
  );
}

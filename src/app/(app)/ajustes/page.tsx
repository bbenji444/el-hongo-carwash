import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { obtenerConfiguracion } from "@/lib/configuracion";
import { AjustesClient } from "./AjustesClient";

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
    </div>
  );
}

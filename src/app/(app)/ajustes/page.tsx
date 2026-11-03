import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { obtenerConfiguracion } from "@/lib/configuracion";
import { AjustesClient } from "./AjustesClient";
import { ExtrasManager } from "./ExtrasManager";
import { GastoOpcionesManager } from "./GastoOpcionesManager";

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
  const [{ data: extras }, { data: opcionesGasto }] = await Promise.all([
    supabase.from("extras_catalogo").select("*").order("orden").order("nombre"),
    supabase.from("gasto_subcategorias").select("id, nombre, activo, categoria").order("nombre"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Ajustes</h1>
        <p className="text-sm text-muted">
          Personaliza textos, emojis, colores, extras y opciones de gastos sin tocar código. Los cambios se ven en toda
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

      <section className="flex flex-col gap-3 border-t border-border pt-6">
        <div>
          <h2 className="font-semibold text-foreground">Opciones de gastos</h2>
          <p className="text-xs text-muted">
            Productos y conceptos que aparecen al registrar un gasto, agrupados por categoría (por ejemplo, Fabuloso en
            Insumos o Luz en Servicios). Al elegir una categoría en Gastos solo se muestran las suyas.
          </p>
        </div>
        <GastoOpcionesManager opciones={opcionesGasto ?? []} />
      </section>
    </div>
  );
}

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { obtenerConfiguracion } from "@/lib/configuracion";
import { AppShell } from "./AppShell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Ninguna de las dos depende de la otra (obtenerConfiguracion() no
  // necesita el usuario) — se piden juntas. Esto corre en CADA página de
  // la app (layout raíz), así que es el punto con más impacto de todos
  // para acelerar la navegación entre secciones.
  const [{ data: usuario }, config] = await Promise.all([
    supabase.from("usuarios").select("nombre, rol, activo").eq("id", user.id).maybeSingle(),
    obtenerConfiguracion(),
  ]);

  if (!usuario || !usuario.activo) {
    redirect("/login?motivo=cuenta_inactiva");
  }

  return (
    <AppShell usuarioNombre={usuario.nombre} esDueno={usuario.rol === "dueno"} config={config}>
      {children}
    </AppShell>
  );
}

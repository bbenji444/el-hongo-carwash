import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "./AppShell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: usuario } = await supabase
    .from("usuarios")
    .select("nombre, activo")
    .eq("id", user.id)
    .maybeSingle();

  if (!usuario || !usuario.activo) {
    redirect("/login?motivo=cuenta_inactiva");
  }

  return <AppShell usuarioNombre={usuario.nombre}>{children}</AppShell>;
}

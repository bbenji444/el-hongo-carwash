import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { UsuariosClient } from "./UsuariosClient";

export default async function UsuariosPage() {
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

  const { data: usuarios } = await supabase
    .from("usuarios_con_correo")
    .select("*")
    .order("creado_en");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Usuarios</h1>
        <p className="text-sm text-muted">
          Da de alta cuentas nuevas y decide qué puede hacer cada quien dentro del sistema.
        </p>
      </div>

      <UsuariosClient usuarios={usuarios ?? []} usuarioActualId={user.id} />
    </div>
  );
}

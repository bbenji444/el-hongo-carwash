import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PERIODOS, resolverRango, queryStringRango } from "@/lib/rangoFechas";
import { obtenerConfiguracion } from "@/lib/configuracion";
import { obtenerDatosLavadores } from "./data";
import { LavadoresClient } from "./LavadoresClient";
import type { RolUsuario } from "@/types/database.types";

export default async function LavadoresPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; desde?: string; hasta?: string }>;
}) {
  const params = await searchParams;

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

  const rol = usuario.rol as RolUsuario;
  const puedeEditar = rol === "encargado" || rol === "dueno";

  const rango = resolverRango(params);
  const [{ lavadores }, config] = await Promise.all([obtenerDatosLavadores(rango), obtenerConfiguracion()]);
  const qs = queryStringRango(rango);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Lavadores</h1>
        <p className="text-sm text-muted">
          Registro del personal que lava los autos y cuántos autos (y ventas) lleva cada quien.
        </p>
      </div>

      <div className="flex gap-2">
        {PERIODOS.map((p) => (
          <Link
            key={p.value}
            href={`/lavadores?periodo=${p.value}`}
            className={`rounded-lg border px-3 py-1.5 text-sm transition ${
              !rango.personalizado && p.value === rango.periodo
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted hover:text-foreground"
            }`}
          >
            {p.label}
          </Link>
        ))}
      </div>

      <LavadoresClient
        lavadores={lavadores}
        puedeEditar={puedeEditar}
        queryString={qs ? `?${qs}` : ""}
        emojiLavador={config.emoji_lavador}
      />
    </div>
  );
}

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { ConfiguracionApp } from "@/types/database.types";
import { CONFIGURACION_DEFAULT } from "@/lib/configuracionDefaults";

export { CONFIGURACION_DEFAULT, emojiPorTamano } from "@/lib/configuracionDefaults";

// cache() deduplica la consulta dentro de un mismo request del servidor:
// el layout y la página que se renderizan juntos piden la configuración
// cada uno, pero solo se consulta la base de datos una vez.
export const obtenerConfiguracion = cache(async (): Promise<ConfiguracionApp> => {
  const supabase = await createClient();
  const { data } = await supabase.from("configuracion_app").select("*").eq("id", true).maybeSingle();
  return data ?? CONFIGURACION_DEFAULT;
});

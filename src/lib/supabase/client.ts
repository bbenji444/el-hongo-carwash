import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

// Un solo cliente para toda la pestaña (singleton), no uno nuevo cada vez
// que algo llama a createClient(). Cada cliente trae su propio temporizador
// de auto-refresh del token de sesión — si varias partes de la app (p. ej.
// useRealtimeRefresh, que se monta y desmonta cada vez que entras/sales de
// Tickets durante el día) creaban cada una su propio cliente, terminabas
// con VARIOS temporizadores intentando refrescar el mismo refresh token
// casi al mismo tiempo. Supabase rota el refresh token en cada uso y
// rechaza (cierra la sesión por completo) si detecta que el mismo token
// viejo se intenta usar dos veces — que es justo el síntoma reportado:
// la sesión se cerraba sola a cada rato, sin patrón claro.
let client: SupabaseClient<Database> | undefined;

export function createClient() {
  if (!client) {
    client = createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return client;
}

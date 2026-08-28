import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Se suscribe a cambios en tiempo real (Supabase Realtime) de las tablas
// indicadas y refresca los datos del Server Component actual cuando algo
// cambia, para que dos sesiones abiertas al mismo tiempo (p. ej. dos
// celulares en el mostrador) se mantengan sincronizadas sin tener que
// recargar la página a mano. Requiere que las tablas estén agregadas a la
// publicación supabase_realtime (ver migración 20260907010000).
export function useRealtimeRefresh(tablas: string[]) {
  const router = useRouter();
  const tablasClave = tablas.join(",");

  useEffect(() => {
    const supabase = createClient();
    const canal = supabase.channel(`live-${tablasClave}`);

    // Varios cambios pueden llegar casi juntos (p. ej. borrar un turno se
    // lleva varios tickets y pagos a la vez) — se agrupan en un solo
    // refresh en vez de disparar uno por cada evento.
    let timeout: ReturnType<typeof setTimeout> | null = null;
    function refrescar() {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => router.refresh(), 300);
    }

    for (const tabla of tablasClave.split(",")) {
      canal.on("postgres_changes", { event: "*", schema: "public", table: tabla }, refrescar);
    }

    canal.subscribe();

    return () => {
      if (timeout) clearTimeout(timeout);
      supabase.removeChannel(canal);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tablasClave]);
}

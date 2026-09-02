import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

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
    let canal: RealtimeChannel | null = null;
    let vivo = true;

    // Varios cambios pueden llegar casi juntos (p. ej. borrar un turno se
    // lleva varios tickets y pagos a la vez) — se agrupan en un solo
    // refresh en vez de disparar uno por cada evento.
    let timeout: ReturnType<typeof setTimeout> | null = null;
    function refrescar() {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => router.refresh(), 300);
    }

    // El celular suspende la conexión de websocket cuando la pantalla se
    // bloquea, cambia de wifi a datos, o el navegador pasa la pestaña a
    // segundo plano — la librería de Realtime no siempre reconecta sola a
    // tiempo. Si el canal se cae, se vuelve a suscribir solo en vez de
    // quedarse muerto en silencio hasta que alguien recargue a mano.
    function suscribir() {
      canal = supabase.channel(`live-${tablasClave}`);
      for (const tabla of tablasClave.split(",")) {
        canal.on("postgres_changes", { event: "*", schema: "public", table: tabla }, refrescar);
      }
      canal.subscribe((status) => {
        if (!vivo) return;
        if (status === "CLOSED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          if (canal) supabase.removeChannel(canal);
          setTimeout(() => {
            if (vivo) suscribir();
          }, 2000);
        }
      });
    }
    suscribir();

    // Además del canal en vivo, se fuerza un refresh cada vez que la
    // pestaña vuelve a estar visible/con foco o el celular recupera
    // conexión — cubre el hueco de lo que se haya perdido mientras la
    // sesión estaba en segundo plano, sin esperar a que llegue un evento
    // nuevo de Realtime.
    function alVolver() {
      if (document.visibilityState === "visible") refrescar();
    }
    document.addEventListener("visibilitychange", alVolver);
    window.addEventListener("focus", refrescar);
    window.addEventListener("online", refrescar);

    return () => {
      vivo = false;
      if (timeout) clearTimeout(timeout);
      document.removeEventListener("visibilitychange", alVolver);
      window.removeEventListener("focus", refrescar);
      window.removeEventListener("online", refrescar);
      if (canal) supabase.removeChannel(canal);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tablasClave]);
}

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
    // true mientras la pestaña está en segundo plano — evita que el
    // reconector automático (por CLOSED/CHANNEL_ERROR) pelee con el cierre
    // intencional de abajo.
    let pausado = false;

    // El token de sesión se renueva solo para las peticiones normales
    // (REST vía cookies), pero el canal de Realtime ya abierto se queda
    // autenticado con el token viejo si nadie se lo actualiza. Al expirar
    // (Supabase por defecto usa ~1h), las políticas de RLS empiezan a
    // rechazarlo EN SILENCIO — el canal se sigue viendo "SUBSCRIBED", no
    // marca error, solo deja de entregar cambios — que es justo el síntoma
    // reportado: funciona un rato después de entrar y luego para. Por eso
    // se reenvía el token fresco cada vez que Supabase lo renueva.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) supabase.realtime.setAuth(data.session.access_token);
    });
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) supabase.realtime.setAuth(session.access_token);
    });

    // Varios cambios pueden llegar casi juntos (p. ej. borrar un turno se
    // lleva varios tickets y pagos a la vez) — se agrupan en un solo
    // refresh en vez de disparar uno por cada evento.
    let timeout: ReturnType<typeof setTimeout> | null = null;
    function refrescar() {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => router.refresh(), 300);
    }

    function desuscribir() {
      if (canal) {
        supabase.removeChannel(canal);
        canal = null;
      }
    }

    // El celular suspende la conexión de websocket cuando la pantalla se
    // bloquea, cambia de wifi a datos, o el navegador pasa la pestaña a
    // segundo plano — la librería de Realtime no siempre reconecta sola a
    // tiempo. Si el canal se cae, se vuelve a suscribir solo en vez de
    // quedarse muerto en silencio hasta que alguien recargue a mano.
    function suscribir() {
      if (canal) return;
      canal = supabase.channel(`live-${tablasClave}`);
      for (const tabla of tablasClave.split(",")) {
        canal.on("postgres_changes", { event: "*", schema: "public", table: tabla }, refrescar);
      }
      canal.subscribe((status) => {
        if (!vivo || pausado) return;
        if (status === "CLOSED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          desuscribir();
          setTimeout(() => {
            if (vivo && !pausado) suscribir();
          }, 2000);
        }
      });
    }
    suscribir();

    // Un websocket abierto le impide a Chrome guardar la página en su
    // "back/forward cache" (bfcache) — así que cada vez que se salía de la
    // app (a otra app, o a bloquear pantalla) y se volvía, Chrome tenía que
    // recargar todo por red desde cero en vez de restaurarla al instante
    // desde memoria. Si esa recarga coincidía con el instante sin conexión
    // de cambiar de app, salía la pantalla de "This page couldn't load".
    // Por eso el canal se cierra a propósito al ocultarse la pestaña, y se
    // vuelve a abrir (más un refresh, por si algo cambió mientras tanto) al
    // regresar — la pestaña queda elegible para bfcache y el regreso es
    // instantáneo la enorme mayoría de las veces.
    function alCambiarVisibilidad() {
      if (document.visibilityState === "hidden") {
        pausado = true;
        desuscribir();
      } else {
        pausado = false;
        suscribir();
        refrescar();
      }
    }
    // Si Chrome sí llega a restaurar la página desde bfcache (persisted),
    // el efecto de este componente no se vuelve a ejecutar — hay que
    // reabrir el canal a mano aquí también.
    function alMostrarPagina(e: PageTransitionEvent) {
      if (e.persisted) {
        pausado = false;
        suscribir();
        refrescar();
      }
    }
    document.addEventListener("visibilitychange", alCambiarVisibilidad);
    window.addEventListener("pageshow", alMostrarPagina);
    window.addEventListener("focus", refrescar);
    window.addEventListener("online", refrescar);

    return () => {
      vivo = false;
      if (timeout) clearTimeout(timeout);
      document.removeEventListener("visibilitychange", alCambiarVisibilidad);
      window.removeEventListener("pageshow", alMostrarPagina);
      window.removeEventListener("focus", refrescar);
      window.removeEventListener("online", refrescar);
      authListener.subscription.unsubscribe();
      desuscribir();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tablasClave]);
}

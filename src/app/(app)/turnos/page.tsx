import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TurnoActivoCard } from "./TurnoActivoCard";
import { HistorialTurnos } from "./HistorialTurnos";
import { RealtimeSync } from "@/components/RealtimeSync";
import { resolverRango } from "@/lib/rangoFechas";
import { buscarTicketsDetalle } from "@/lib/ticketsDetalle";
import { TicketsDetalleSeccion } from "@/components/TicketsDetalleSeccion";
import type { TamanoVehiculo, PagoMetodo } from "@/types/database.types";

export default async function TurnosPage({
  searchParams,
}: {
  searchParams: Promise<{
    periodo?: string;
    desde?: string;
    hasta?: string;
    servicio?: string;
    tamano?: string;
    metodo?: string;
    lavador?: string;
    q?: string;
  }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const rango = resolverRango(params);
  const filtrosTicketsDetalle = {
    servicio: params.servicio ?? "",
    tamano: (params.tamano ?? "") as TamanoVehiculo | "",
    metodo: (params.metodo ?? "") as PagoMetodo | "",
    lavador: params.lavador ?? "",
    q: params.q ?? "",
  };

  // Estas cuatro son independientes entre sí — antes se pedían una tras
  // otra (junto con lo que sigue abajo, hasta 6+ viajes de ida y vuelta
  // seguidos). buscarTicketsDetalle en particular no depende de nada de
  // usuario/turnoAbierto/turnosCerrados, así que no tenía por qué esperar
  // a que todo lo demás terminara primero.
  const [
    { data: usuario },
    { data: turnoAbierto },
    { data: turnosCerrados },
    datosTicketsDetalle,
  ] = await Promise.all([
    supabase
      .from("usuarios")
      .select("id, nombre, rol, puede_editar_turnos, puede_eliminar_turnos")
      .eq("id", user.id)
      .maybeSingle(),
    supabase.from("turnos").select("*").eq("estado", "abierto").maybeSingle(),
    supabase.from("turnos").select("*").eq("estado", "cerrado").order("hora_cierre", { ascending: false }).limit(30),
    buscarTicketsDetalle(rango, filtrosTicketsDetalle),
  ]);

  const {
    filas: ticketsDetalle,
    totalCoincidencias: totalTicketsDetalle,
    lavadoresPresentes,
    serviciosPresentes: serviciosPresentesDetalle,
  } = datosTicketsDetalle;

  if (!usuario) {
    redirect("/login");
  }

  const puedeEditarTurnos = usuario.rol === "dueno" || usuario.puede_editar_turnos;
  const puedeEliminarTurnos = usuario.rol === "dueno" || usuario.puede_eliminar_turnos;

  let resumen = null;
  if (turnoAbierto) {
    const [{ data: pagos }, { count: pendientes }] = await Promise.all([
      supabase.from("pagos").select("metodo, monto").eq("turno_id", turnoAbierto.id),
      supabase
        .from("tickets")
        .select("*", { count: "exact", head: true })
        .eq("turno_id", turnoAbierto.id)
        .neq("estado", "entregado"),
    ]);

    const totales: Record<string, number> = { efectivo: 0, tarjeta: 0, transferencia: 0 };
    for (const p of pagos ?? []) {
      totales[p.metodo] = (totales[p.metodo] ?? 0) + p.monto;
    }

    // Los cajeros no ven el total de efectivo esperado antes de cerrar: deben contar
    // la caja física a ciegas y el sistema compara contra lo esperado al cerrar.
    // Esto es lo que hace que el conteo sirva como control real, no solo trámite.
    const puedeVerEfectivo = usuario.rol !== "cajero";

    resumen = {
      totalesVisibles: puedeVerEfectivo
        ? totales
        : { tarjeta: totales.tarjeta, transferencia: totales.transferencia },
      efectivoEsperado: puedeVerEfectivo ? turnoAbierto.efectivo_inicial + totales.efectivo : null,
      pendientes: pendientes ?? 0,
      ocultarEfectivo: !puedeVerEfectivo,
    };
  }

  const usuarioIds = [
    ...new Set(
      (turnosCerrados ?? []).flatMap((t) => [t.usuario_apertura_id, t.usuario_cierre_id]).filter(Boolean)
    ),
  ] as string[];
  const turnoIds = (turnosCerrados ?? []).map((t) => t.id);

  // Ninguna de las dos depende de la otra (ambas solo usan ids derivados
  // de turnosCerrados, no entre sí).
  const [{ data: usuarios }, { data: pagosTurnos }] = await Promise.all([
    usuarioIds.length
      ? supabase.from("usuarios").select("id, nombre").in("id", usuarioIds)
      : Promise.resolve({ data: [] }),
    turnoIds.length
      ? supabase.from("pagos").select("turno_id, monto, metodo").in("turno_id", turnoIds)
      : Promise.resolve({ data: [] }),
  ]);

  const usuarioMap = new Map((usuarios ?? []).map((u) => [u.id, u.nombre]));

  const transferenciaPorTurno = new Map<string, number>();
  const tarjetaPorTurno = new Map<string, number>();
  for (const p of pagosTurnos ?? []) {
    if (p.metodo === "transferencia") {
      transferenciaPorTurno.set(p.turno_id, (transferenciaPorTurno.get(p.turno_id) ?? 0) + p.monto);
    }
    if (p.metodo === "tarjeta") {
      tarjetaPorTurno.set(p.turno_id, (tarjetaPorTurno.get(p.turno_id) ?? 0) + p.monto);
    }
  }

  const historial = (turnosCerrados ?? []).map((t) => {
    // Ganancia/Total usan el efectivo CONTADO (lo que de verdad se recuperó
    // al cerrar), no el efectivo esperado según los pagos registrados — si
    // faltó dinero en el corte, ese faltante debe descontarse de la
    // ganancia real, no aparecer como si todo se hubiera cobrado bien.
    // efectivo_contado nunca es null aquí: el trigger de cierre exige
    // capturarlo antes de dejar pasar un turno a "cerrado".
    const tarjetaYTransferencia = (tarjetaPorTurno.get(t.id) ?? 0) + (transferenciaPorTurno.get(t.id) ?? 0);
    const total = (t.efectivo_contado ?? 0) + tarjetaYTransferencia;
    return {
      ...t,
      nombreApertura: usuarioMap.get(t.usuario_apertura_id) ?? "—",
      nombreCierre: t.usuario_cierre_id ? usuarioMap.get(t.usuario_cierre_id) ?? "—" : "—",
      ganancia: total - t.efectivo_inicial,
      total,
      tarjeta: tarjetaPorTurno.get(t.id) ?? 0,
      transferencia: transferenciaPorTurno.get(t.id) ?? 0,
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <RealtimeSync tablas={["turnos", "pagos"]} />
      <div>
        <h1 className="text-2xl font-bold text-foreground">Caja y turnos</h1>
        <p className="text-sm text-muted">Cierre de turno y conciliación de efectivo.</p>
      </div>

      {turnoAbierto && resumen ? (
        <TurnoActivoCard turno={turnoAbierto} resumen={resumen} puedeEliminar={puedeEliminarTurnos} />
      ) : (
        <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted">
          No hay un turno abierto. Ábrelo desde la sección de Tickets.
        </p>
      )}

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Historial de turnos</h2>
        <HistorialTurnos
          historial={historial}
          puedeEditar={puedeEditarTurnos}
          puedeEliminar={puedeEliminarTurnos}
          puedeVerDesglose={usuario.rol !== "cajero"}
        />
      </div>

      {usuario.rol !== "cajero" && (
        <TicketsDetalleSeccion
          basePath="/turnos"
          rango={rango}
          filtros={filtrosTicketsDetalle}
          filas={ticketsDetalle}
          totalCoincidencias={totalTicketsDetalle}
          lavadoresPresentes={lavadoresPresentes}
          serviciosPresentes={serviciosPresentesDetalle}
          incluirPeriodo={true}
        />
      )}
    </div>
  );
}

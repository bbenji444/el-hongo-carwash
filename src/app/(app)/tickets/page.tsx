import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TicketsBoard } from "./TicketsBoard";
import type { RolUsuario } from "@/types/database.types";

export default async function TicketsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: usuario } = await supabase
    .from("usuarios")
    .select("id, nombre, rol")
    .eq("id", user.id)
    .maybeSingle();

  if (!usuario) {
    redirect("/login");
  }

  const { data: turno } = await supabase
    .from("turnos")
    .select("*")
    .eq("estado", "abierto")
    .maybeSingle();

  const { data: servicios } = await supabase
    .from("servicios_catalogo")
    .select("*")
    .eq("activo", true)
    .order("nombre");

  const tickets = turno
    ? (
        await supabase
          .from("tickets")
          .select("*")
          .eq("turno_id", turno.id)
          .order("hora_entrada", { ascending: true })
      ).data
    : [];

  // Datos de apoyo para mostrar en las tarjetas (servicio, cliente, vehículo, empleado)
  // se resuelven por separado porque las Relationships del tipo Database están vacías
  // (ver nota en database.types.ts) y así evitamos ambigüedad de FKs múltiples hacia usuarios.
  const servicioMap = new Map((servicios ?? []).map((s) => [s.id, s]));

  const clienteIds = [...new Set((tickets ?? []).map((t) => t.cliente_id).filter(Boolean))] as string[];
  const vehiculoIds = [...new Set((tickets ?? []).map((t) => t.vehiculo_id).filter(Boolean))] as string[];
  const empleadoIds = [...new Set((tickets ?? []).map((t) => t.empleado_id).filter(Boolean))] as string[];

  const [{ data: clientes }, { data: vehiculos }, { data: empleados }, { data: pagos }] = await Promise.all([
    clienteIds.length
      ? supabase.from("clientes").select("id, nombre, telefono").in("id", clienteIds)
      : Promise.resolve({ data: [] }),
    vehiculoIds.length
      ? supabase.from("vehiculos").select("id, placas, tipo_vehiculo").in("id", vehiculoIds)
      : Promise.resolve({ data: [] }),
    empleadoIds.length
      ? supabase.from("usuarios").select("id, nombre").in("id", empleadoIds)
      : Promise.resolve({ data: [] }),
    turno
      ? supabase.from("pagos").select("ticket_id, monto, metodo").eq("turno_id", turno.id)
      : Promise.resolve({ data: [] }),
  ]);

  const clienteMap = new Map((clientes ?? []).map((c) => [c.id, c]));
  const vehiculoMap = new Map((vehiculos ?? []).map((v) => [v.id, v]));
  const empleadoMap = new Map((empleados ?? []).map((e) => [e.id, e]));
  const pagosPorTicket = new Map<string, { monto: number; metodo: string }[]>();
  for (const pago of pagos ?? []) {
    const lista = pagosPorTicket.get(pago.ticket_id) ?? [];
    lista.push({ monto: pago.monto, metodo: pago.metodo });
    pagosPorTicket.set(pago.ticket_id, lista);
  }

  const ticketsConDetalle = (tickets ?? []).map((t) => ({
    ...t,
    servicio: t.servicio_id ? servicioMap.get(t.servicio_id) ?? null : null,
    cliente: t.cliente_id ? clienteMap.get(t.cliente_id) ?? null : null,
    vehiculo: t.vehiculo_id ? vehiculoMap.get(t.vehiculo_id) ?? null : null,
    empleado: t.empleado_id ? empleadoMap.get(t.empleado_id) ?? null : null,
    tienePago: (pagosPorTicket.get(t.id) ?? []).length > 0 || t.lavada_gratis,
  }));

  // Resumen de caja del turno en curso, para que el cajero vea el dinero
  // acumulado sin salirse de Tickets. Los cajeros no ven el efectivo (deben
  // contarlo a ciegas al cerrar turno, ver turnos/page.tsx), solo tarjeta y
  // transferencia.
  let resumenCaja: {
    totalesVisibles: Record<string, number>;
    ocultarEfectivo: boolean;
    pendientes: number;
  } | null = null;

  if (turno) {
    const totalesPorMetodo: Record<string, number> = { efectivo: 0, tarjeta: 0, transferencia: 0 };
    for (const p of pagos ?? []) {
      totalesPorMetodo[p.metodo] = (totalesPorMetodo[p.metodo] ?? 0) + p.monto;
    }
    const puedeVerEfectivo = usuario.rol !== "cajero";

    resumenCaja = {
      totalesVisibles: puedeVerEfectivo
        ? totalesPorMetodo
        : { tarjeta: totalesPorMetodo.tarjeta, transferencia: totalesPorMetodo.transferencia },
      ocultarEfectivo: !puedeVerEfectivo,
      pendientes: (tickets ?? []).filter((t) => t.estado !== "entregado").length,
    };
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Tickets</h1>
        <p className="text-sm text-muted">Tablero del turno en curso.</p>
      </div>

      <TicketsBoard
        turno={turno ?? null}
        servicios={servicios ?? []}
        tickets={ticketsConDetalle}
        rolActual={usuario.rol as RolUsuario}
        usuarioActualId={usuario.id}
        resumenCaja={resumenCaja}
      />
    </div>
  );
}

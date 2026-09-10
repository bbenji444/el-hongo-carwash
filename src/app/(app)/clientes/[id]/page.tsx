import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ClienteDetalleClient } from "./ClienteDetalleClient";

export default async function ClienteDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Las cuatro son independientes entre sí (usuario solo necesita
  // user.id; las otras tres solo necesitan el id de la URL) — antes se
  // pedían en 3 pasos seguidos, ahora en uno.
  const [{ data: usuario }, { data: cliente }, { data: vehiculos }, { data: tickets }] = await Promise.all([
    supabase.from("usuarios").select("rol").eq("id", user.id).maybeSingle(),
    supabase.from("clientes").select("id, nombre, telefono").eq("id", id).maybeSingle(),
    supabase.from("vehiculos").select("id, placas, tipo_vehiculo").eq("cliente_id", id).order("placas"),
    supabase
      .from("tickets")
      .select("id, servicio_id, estado, hora_entrada, hora_salida, descuento_monto, lavada_gratis")
      .eq("cliente_id", id)
      .order("hora_entrada", { ascending: false }),
  ]);

  if (!usuario) {
    redirect("/login");
  }

  if (!cliente) {
    notFound();
  }

  const servicioIds = [...new Set((tickets ?? []).map((t) => t.servicio_id))];
  const { data: servicios } = servicioIds.length
    ? await supabase.from("servicios_catalogo").select("id, nombre").in("id", servicioIds)
    : { data: [] };
  const servicioMap = new Map((servicios ?? []).map((s) => [s.id, s]));

  const historial = (tickets ?? []).map((t) => ({
    id: t.id,
    servicioNombre: t.servicio_id ? servicioMap.get(t.servicio_id)?.nombre ?? "—" : "—",
    estado: t.estado,
    horaEntrada: t.hora_entrada,
    horaSalida: t.hora_salida,
    descuentoMonto: t.descuento_monto,
    lavadaGratis: t.lavada_gratis,
  }));

  // Se cuentan TODAS las lavadas entregadas (gratis o no): cada ciclo son 6
  // lavadas exactas, el residuo módulo 6 vuelve a 0 solo después de la gratis.
  const lavadasEnCiclo = (tickets ?? []).filter((t) => t.estado === "entregado").length % 6;
  const ultimaLavada = (tickets ?? []).find((t) => t.estado === "entregado")?.hora_salida ?? null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{cliente.nombre}</h1>
        <p className="text-sm text-muted">{cliente.telefono ?? "Sin teléfono registrado"}</p>
      </div>

      <ClienteDetalleClient
        clienteId={cliente.id}
        vehiculos={vehiculos ?? []}
        historial={historial}
        lavadasEnCiclo={lavadasEnCiclo}
        ultimaLavada={ultimaLavada}
      />
    </div>
  );
}

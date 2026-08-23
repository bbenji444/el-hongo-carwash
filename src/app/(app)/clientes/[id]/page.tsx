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

  const { data: usuario } = await supabase
    .from("usuarios")
    .select("rol")
    .eq("id", user.id)
    .maybeSingle();

  if (!usuario) {
    redirect("/login");
  }

  const { data: cliente } = await supabase
    .from("clientes")
    .select("id, nombre, telefono")
    .eq("id", id)
    .maybeSingle();

  if (!cliente) {
    notFound();
  }

  const [{ data: vehiculos }, { data: tickets }] = await Promise.all([
    supabase.from("vehiculos").select("id, placas, tipo_vehiculo").eq("cliente_id", id).order("placas"),
    supabase
      .from("tickets")
      .select("id, servicio_id, estado, hora_entrada, hora_salida, descuento_monto, lavada_gratis")
      .eq("cliente_id", id)
      .order("hora_entrada", { ascending: false }),
  ]);

  const servicioIds = [...new Set((tickets ?? []).map((t) => t.servicio_id))];
  const { data: servicios } = servicioIds.length
    ? await supabase.from("servicios_catalogo").select("id, nombre, precio").in("id", servicioIds)
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

  const lavadasEnCiclo =
    (tickets ?? []).filter((t) => t.estado === "entregado" && !t.lavada_gratis).length % 6;
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

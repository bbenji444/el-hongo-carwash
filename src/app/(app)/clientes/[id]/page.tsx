import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ClienteDetalleClient } from "./ClienteDetalleClient";
import type { RolUsuario } from "@/types/database.types";

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

  const hoy = new Date().toISOString().slice(0, 10);

  const [{ data: vehiculos }, { data: vinculoActivo }, { data: membresiasCatalogo }] = await Promise.all([
    supabase.from("vehiculos").select("id, placas, tipo_vehiculo").eq("cliente_id", id).order("placas"),
    supabase
      .from("membresias_clientes")
      .select("id, membresia_id, fecha_inicio, fecha_fin, saldo_paquete, activa")
      .eq("cliente_id", id)
      .eq("activa", true)
      .gte("fecha_fin", hoy)
      .maybeSingle(),
    supabase.from("membresias").select("id, nombre, tipo, beneficio_valor, precio, vigencia_dias").eq("activo", true).order("nombre"),
  ]);

  let membresiaActiva = null;
  if (vinculoActivo) {
    const { data: membresia } = await supabase
      .from("membresias")
      .select("nombre, tipo, beneficio_valor")
      .eq("id", vinculoActivo.membresia_id)
      .maybeSingle();

    membresiaActiva = {
      vinculoId: vinculoActivo.id,
      nombre: membresia?.nombre ?? "Membresía",
      tipo: membresia?.tipo ?? null,
      beneficioValor: membresia?.beneficio_valor ?? 0,
      saldoPaquete: vinculoActivo.saldo_paquete,
      fechaInicio: vinculoActivo.fecha_inicio,
      fechaFin: vinculoActivo.fecha_fin,
    };
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{cliente.nombre}</h1>
        <p className="text-sm text-muted">{cliente.telefono ?? "Sin teléfono registrado"}</p>
      </div>

      <ClienteDetalleClient
        clienteId={cliente.id}
        vehiculos={vehiculos ?? []}
        membresiaActiva={membresiaActiva}
        membresiasCatalogo={membresiasCatalogo ?? []}
        puedeDesactivarMembresia={["encargado", "dueno"].includes(usuario.rol as RolUsuario)}
      />
    </div>
  );
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolverRango, obtenerDatosReporte } from "../../data";
import { construirReporteExcel } from "./construirReporteExcel";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sesión no válida." }, { status: 401 });
  }

  const { data: usuario } = await supabase
    .from("usuarios")
    .select("rol")
    .eq("id", user.id)
    .maybeSingle();

  if (!usuario || usuario.rol === "cajero") {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const params = request.nextUrl.searchParams;
  const rango = resolverRango({
    periodo: params.get("periodo") ?? undefined,
    desde: params.get("desde") ?? undefined,
    hasta: params.get("hasta") ?? undefined,
  });

  const datos = await obtenerDatosReporte(rango);
  const workbook = construirReporteExcel(datos);
  const buffer = await workbook.xlsx.writeBuffer();

  const nombreArchivo = `el-hongo-reporte-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nombreArchivo}"`,
    },
  });
}

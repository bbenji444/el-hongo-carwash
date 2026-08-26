import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { obtenerDatosInventario } from "../../data";
import { construirInventarioExcel } from "./construirInventarioExcel";

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

  if (!usuario) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const soloBajo = request.nextUrl.searchParams.get("bajo") === "1";
  const datos = await obtenerDatosInventario(soloBajo);
  const workbook = construirInventarioExcel(datos);
  const buffer = await workbook.xlsx.writeBuffer();

  const nombreArchivo = `el-hongo-inventario-${new Date().toISOString().slice(0, 10)}${soloBajo ? "-stock-bajo" : ""}.xlsx`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nombreArchivo}"`,
    },
  });
}

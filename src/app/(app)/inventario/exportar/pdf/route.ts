import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { obtenerDatosInventario } from "../../data";
import { InventarioPdf } from "./InventarioPdf";

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
  const buffer = await renderToBuffer(InventarioPdf({ datos }));

  const nombreArchivo = `el-hongo-inventario-${new Date().toISOString().slice(0, 10)}${soloBajo ? "-stock-bajo" : ""}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${nombreArchivo}"`,
    },
  });
}

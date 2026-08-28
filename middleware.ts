import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  // Las Server Actions (crear ticket, cobrar, avanzar estado, abrir turno,
  // etc.) ya validan la sesión ellas mismas al empezar
  // (supabase.auth.getUser(), y además RLS revisa auth.uid() en cada
  // consulta) — repetir esa misma validación aquí en el middleware solo
  // duplicaba una llamada de red completa a Supabase Auth en CADA clic de
  // la app, sin aportar seguridad extra, porque una Server Action nunca
  // redirige de página (que es lo único que hace este middleware). Next.js
  // marca estas peticiones con el header "next-action".
  if (request.headers.has("next-action")) {
    return NextResponse.next();
  }
  return updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo.jpg|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};

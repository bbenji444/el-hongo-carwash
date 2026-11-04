import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_SESION, esCookieSesionVieja } from "./sesion";

const PUBLIC_PATHS = ["/login"];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Cookies de sesión con un nombre anterior (ver sesion.ts): ya no sirven,
  // se borran del navegador para no seguir mandándolas en cada petición.
  const cookiesViejas = request.cookies
    .getAll()
    .map((c) => c.name)
    .filter(esCookieSesionVieja);  function terminar(res: NextResponse) {
    // path "/" explícito: es donde Supabase las guardó; sin él, el navegador
    // solo borraría las de la ruta actual (p. ej. /reportes/turnos).
    for (const nombre of cookiesViejas) res.cookies.set(nombre, "", { path: "/", maxAge: 0 });    return res;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: { name: COOKIE_SESION },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublicPath = PUBLIC_PATHS.some((path) => request.nextUrl.pathname.startsWith(path));

  let isAuthorized = false;
  if (user) {
    const { data: usuario } = await supabase
      .from("usuarios")
      .select("activo")
      .eq("id", user.id)
      .maybeSingle();
    isAuthorized = Boolean(usuario?.activo);
  }

  // Sesión válida en auth pero sin fila activa en `usuarios`: se cierra la sesión.
  if (user && !isAuthorized) {
    await supabase.auth.signOut();
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("motivo", "cuenta_inactiva");
    return terminar(NextResponse.redirect(url));
  }

  if (!isAuthorized && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return terminar(NextResponse.redirect(url));
  }

  if (isAuthorized && isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return terminar(NextResponse.redirect(url));
  }

  return terminar(response);
}

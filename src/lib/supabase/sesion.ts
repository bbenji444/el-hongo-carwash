// Nombre de la cookie donde vive la sesión de Supabase (servidor, navegador
// y middleware deben usar el mismo). Subirle la versión cierra la sesión de
// TODOS a la vez en cuanto se despliega: las cookies con el nombre anterior
// dejan de leerse y cada quien tiene que volver a entrar — útil después de
// una actualización grande para que todos carguen la versión nueva.
//   v2 (2026-11-03): rediseño con animaciones y modo oscuro predeterminado.
export const COOKIE_SESION = "sb-elhongo-sesion-v2";

// Cookies de sesión que ya no se usan: las de Supabase con el nombre por
// omisión ("sb-<proyecto>-auth-token…") y las de versiones anteriores.
export function esCookieSesionVieja(nombre: string) {
  if (nombre.startsWith(COOKIE_SESION)) return false;
  return /^sb-.+-auth-token/.test(nombre) || /^sb-elhongo-sesion-v\d+/.test(nombre);
}

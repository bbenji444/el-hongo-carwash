"use client";

import { useRealtimeRefresh } from "@/lib/useRealtimeRefresh";

// Componente sin UI: solo existe para poder usar useRealtimeRefresh dentro
// de páginas que son Server Components, en partes del árbol donde no hay
// ya garantizado otro Client Component montado (p. ej. /turnos cuando no
// hay ningún turno abierto).
export function RealtimeSync({ tablas }: { tablas: string[] }) {
  useRealtimeRefresh(tablas);
  return null;
}

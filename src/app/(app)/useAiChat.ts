"use client";

import { useState } from "react";

export type ChatMensaje = { id: string; rol: "usuario" | "asistente"; texto: string };

export const PREGUNTAS_SUGERIDAS = [
  { icono: "💰", texto: "¿Ventas de hoy?" },
  { icono: "📊", texto: "¿Rendimiento semanal?" },
  { icono: "🧽", texto: "¿Lavadores activos?" },
  { icono: "📈", texto: "¿Cómo van las ventas este mes?" },
];

// Estado y lógica del chat, compartidos entre la tarjeta grande del
// Dashboard y la burbuja flotante del resto de la app — cada instancia
// lleva su propia conversación (no se comparten entre sí). Cada mensaje se
// manda al endpoint /api/asistente, que es quien de verdad llama a OpenAI y
// consulta la base de datos — aquí no hay nada inventado del lado del
// cliente.
export function useAiChat() {
  const [mensajes, setMensajes] = useState<ChatMensaje[]>([]);
  const [enviando, setEnviando] = useState(false);

  async function enviarPregunta(pregunta: string) {
    const limpio = pregunta.trim();
    if (!limpio || enviando) return;

    const historial = [...mensajes, { id: crypto.randomUUID(), rol: "usuario" as const, texto: limpio }];
    setMensajes(historial);
    setEnviando(true);

    try {
      const res = await fetch("/api/asistente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensajes: historial.map((m) => ({ rol: m.rol, texto: m.texto })) }),
      });
      const data = await res.json();
      const texto = res.ok
        ? (data.respuesta ?? "No pude generar una respuesta.")
        : (data.error ?? "Hubo un problema al conectar con el asistente.");
      setMensajes((m) => [...m, { id: crypto.randomUUID(), rol: "asistente", texto }]);
    } catch {
      setMensajes((m) => [
        ...m,
        { id: crypto.randomUUID(), rol: "asistente", texto: "No pude conectarme — revisa tu conexión e intenta de nuevo." },
      ]);
    } finally {
      setEnviando(false);
    }
  }

  function reiniciar() {
    setMensajes([]);
  }

  return { mensajes, enviando, enviarPregunta, reiniciar };
}

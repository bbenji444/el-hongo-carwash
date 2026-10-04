"use client";

import { useState } from "react";

export type ChatMensaje = { id: string; rol: "usuario" | "asistente"; texto: string };

export const PREGUNTAS_SUGERIDAS = [
  { icono: "💰", texto: "¿Ventas de hoy?" },
  { icono: "📊", texto: "¿Rendimiento semanal?" },
  { icono: "🧽", texto: "¿Lavadores activos?" },
  { icono: "📈", texto: "¿Cómo van las ventas este mes?" },
];

// Todavía no hay backend conectado (próxima fase: la API va a consultar la
// base de datos y responder con un modelo de IA) — esta respuesta es solo
// para que la UI se sienta completa mientras tanto.
const RESPUESTA_PLACEHOLDER =
  "Todavía no estoy conectado a tus datos reales — eso llega en la siguiente actualización. Por ahora esto es solo una vista previa. 🚧";

// Estado y lógica del chat de demo, compartidos entre la tarjeta grande del
// Dashboard y la burbuja flotante del resto de la app — cada instancia
// lleva su propia conversación (no se comparten entre sí).
export function useAiChatDemo() {
  const [mensajes, setMensajes] = useState<ChatMensaje[]>([]);
  const [enviando, setEnviando] = useState(false);

  function enviarPregunta(pregunta: string) {
    const limpio = pregunta.trim();
    if (!limpio || enviando) return;
    setMensajes((m) => [...m, { id: crypto.randomUUID(), rol: "usuario", texto: limpio }]);
    setEnviando(true);
    setTimeout(() => {
      setMensajes((m) => [...m, { id: crypto.randomUUID(), rol: "asistente", texto: RESPUESTA_PLACEHOLDER }]);
      setEnviando(false);
    }, 600);
  }

  function reiniciar() {
    setMensajes([]);
  }

  return { mensajes, enviando, enviarPregunta, reiniciar };
}

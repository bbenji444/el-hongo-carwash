"use client";

import { useState } from "react";
import { ChatConversation } from "./ChatConversation";
import { ChatInputBar } from "./ChatInputBar";
import { ChatEncabezado, ChatFondo } from "./ChatMarco";
import { useAiChat } from "./useAiChat";

export function AiAssistantCard({ nombreUsuario }: { nombreUsuario: string }) {
  const { mensajes, enviando, enviarPregunta, reiniciar } = useAiChat();
  const [texto, setTexto] = useState("");

  function enviar(valor: string) {
    enviarPregunta(valor);
    setTexto("");
  }

  return (
    // Marco con borde de degradado de la marca que se desplaza lento
    <div
      className="animate-degradado rounded-3xl p-[1.5px] shadow-[0_20px_50px_-24px_var(--primary)]"
      style={{ backgroundImage: "linear-gradient(120deg, var(--primary), #facc15, var(--accent), var(--primary))" }}
    >
      <div className="relative isolate flex h-[calc(100svh-12rem)] min-h-[420px] flex-col overflow-hidden rounded-[calc(1.5rem-1.5px)] bg-surface sm:h-[34rem] lg:h-[38rem]">
        <ChatFondo />
        <ChatEncabezado hayMensajes={mensajes.length > 0} onNuevo={reiniciar} />
        <ChatConversation mensajes={mensajes} enviando={enviando} nombreUsuario={nombreUsuario} onSeleccionarPregunta={enviar} />
        <ChatInputBar texto={texto} setTexto={setTexto} onEnviar={enviar} enviando={enviando} />
      </div>
    </div>
  );
}

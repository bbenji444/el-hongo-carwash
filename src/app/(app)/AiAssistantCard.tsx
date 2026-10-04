"use client";

import { MascotaAvatar } from "./MascotaAvatar";
import { ChatConversation } from "./ChatConversation";
import { ChatInputBar } from "./ChatInputBar";
import { useAiChat } from "./useAiChat";
import { useState } from "react";

export function AiAssistantCard({ nombreUsuario }: { nombreUsuario: string }) {
  const { mensajes, enviando, enviarPregunta, reiniciar } = useAiChat();
  const [texto, setTexto] = useState("");

  function enviar(valor: string) {
    enviarPregunta(valor);
    setTexto("");
  }

  return (
    <div className="flex h-[calc(100svh-12rem)] min-h-[420px] flex-col overflow-hidden rounded-3xl border border-border bg-surface shadow-sm sm:h-[34rem] lg:h-[38rem]">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2.5">
          <MascotaAvatar size={36} />
          <div>
            <p className="text-sm font-semibold text-foreground">El Hongo AI Assistant</p>
            <p className="text-[11px] text-muted">Conectado a tus datos en tiempo real</p>
          </div>
        </div>
        {mensajes.length > 0 && (
          <button
            type="button"
            onClick={reiniciar}
            className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted transition hover:bg-surface-hover hover:text-foreground"
          >
            Nuevo chat
          </button>
        )}
      </div>

      <ChatConversation mensajes={mensajes} enviando={enviando} nombreUsuario={nombreUsuario} onSeleccionarPregunta={enviar} />

      <ChatInputBar texto={texto} setTexto={setTexto} onEnviar={enviar} enviando={enviando} />
    </div>
  );
}

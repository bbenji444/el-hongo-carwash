"use client";

import { useState } from "react";
import { MascotaAvatar } from "./MascotaAvatar";
import { ChatConversation } from "./ChatConversation";
import { ChatInputBar } from "./ChatInputBar";
import { useAiChatDemo } from "./useAiChatDemo";

// Burbuja flotante del AI Assistant — visible en todas las páginas menos el
// Dashboard (que ya trae la tarjeta grande). Cada una lleva su propia
// conversación de demo, independiente de la del Dashboard.
export function FloatingChatWidget({ nombreUsuario }: { nombreUsuario: string }) {
  const [abierto, setAbierto] = useState(false);
  const { mensajes, enviando, enviarPregunta, reiniciar } = useAiChatDemo();
  const [texto, setTexto] = useState("");

  function enviar(valor: string) {
    enviarPregunta(valor);
    setTexto("");
  }

  return (
    <>
      {abierto && (
        <div aria-hidden="true" onClick={() => setAbierto(false)} className="fixed inset-0 z-30 bg-black/30 sm:hidden" />
      )}

      {abierto && (
        <div className="fixed inset-x-0 bottom-0 z-30 flex h-[78svh] flex-col overflow-hidden rounded-t-3xl border-t border-border bg-surface shadow-2xl animate-in sm:inset-x-auto sm:bottom-24 sm:right-5 sm:h-[32rem] sm:w-96 sm:rounded-3xl sm:border">
          <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2.5">
              <MascotaAvatar size={32} />
              <div>
                <p className="text-sm font-semibold text-foreground">El Hongo AI Assistant</p>
                <p className="text-[10px] text-muted">Próximamente conectado a tus datos</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {mensajes.length > 0 && (
                <button
                  type="button"
                  onClick={reiniciar}
                  className="rounded-lg px-2 py-1 text-xs font-medium text-muted transition hover:bg-surface-hover hover:text-foreground"
                >
                  Nuevo
                </button>
              )}
              <button
                type="button"
                onClick={() => setAbierto(false)}
                aria-label="Cerrar chat"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-muted transition hover:bg-surface-hover hover:text-foreground"
              >
                ✕
              </button>
            </div>
          </div>

          <ChatConversation mensajes={mensajes} enviando={enviando} nombreUsuario={nombreUsuario} onSeleccionarPregunta={enviar} compact />

          <ChatInputBar texto={texto} setTexto={setTexto} onEnviar={enviar} enviando={enviando} compact />
        </div>
      )}

      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-label={abierto ? "Cerrar chat" : "Abrir chat con El Hongo AI Assistant"}
        className="fixed bottom-5 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-surface shadow-lg ring-2 ring-primary/30 transition hover:-translate-y-0.5 hover:shadow-xl"
      >
        {abierto ? <span className="text-xl text-muted">✕</span> : <MascotaAvatar size={48} className="border-2 border-primary/40" />}
      </button>
    </>
  );
}

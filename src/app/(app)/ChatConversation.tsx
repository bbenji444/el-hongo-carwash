"use client";

import { useEffect, useRef } from "react";
import { MascotaAvatar } from "./MascotaAvatar";
import { PREGUNTAS_SUGERIDAS, type ChatMensaje } from "./useAiChatDemo";

export function ChatConversation({
  mensajes,
  enviando,
  nombreUsuario,
  onSeleccionarPregunta,
  compact = false,
}: {
  mensajes: ChatMensaje[];
  enviando: boolean;
  nombreUsuario: string;
  onSeleccionarPregunta: (texto: string) => void;
  compact?: boolean;
}) {
  const finRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [mensajes, enviando]);

  const hayConversacion = mensajes.length > 0;

  if (!hayConversacion) {
    return (
      <div className={`flex h-full flex-col items-center justify-center gap-4 text-center ${compact ? "px-3 py-3" : "px-4 py-4 sm:px-6"}`}>
        <MascotaAvatar size={compact ? 64 : 84} className="border-2 border-primary/30 shadow-md" />
        <div>
          <h2 className={`font-semibold text-foreground ${compact ? "text-base" : "text-lg sm:text-xl"}`}>
            ¿En qué te ayudo, {nombreUsuario}?
          </h2>
          {!compact && (
            <p className="mt-1 text-sm text-muted">Pregúntame sobre ventas, gastos, lavadores o cualquier cosa del negocio.</p>
          )}
        </div>
        <div className={`grid w-full gap-2 ${compact ? "max-w-xs grid-cols-1" : "max-w-md grid-cols-1 sm:grid-cols-2"}`}>
          {PREGUNTAS_SUGERIDAS.map((p) => (
            <button
              key={p.texto}
              type="button"
              onClick={() => onSeleccionarPregunta(p.texto)}
              className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5 text-left text-sm text-foreground transition hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/5"
            >
              <span className="text-base">{p.icono}</span>
              {p.texto}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex-1 overflow-y-auto ${compact ? "px-3 py-3" : "px-4 py-4 sm:px-6"}`}>
      <div className={`mx-auto flex flex-col ${compact ? "gap-3" : "max-w-2xl gap-5"}`}>
        {mensajes.map((m) =>
          m.rol === "usuario" ? (
            <div key={m.id} className="flex justify-end">
              <div className="max-w-[80%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm text-white">{m.texto}</div>
            </div>
          ) : (
            <div key={m.id} className="flex items-start gap-2.5">
              <MascotaAvatar size={compact ? 24 : 32} className="mt-0.5" />
              <p className="max-w-[85%] whitespace-pre-wrap text-sm leading-relaxed text-foreground">{m.texto}</p>
            </div>
          )
        )}
        {enviando && (
          <div className="flex items-center gap-2.5">
            <MascotaAvatar size={compact ? 24 : 32} />
            <span className="flex items-center gap-1 py-1">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted" />
            </span>
          </div>
        )}
        <div ref={finRef} />
      </div>
    </div>
  );
}

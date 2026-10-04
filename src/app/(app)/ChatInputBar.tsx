"use client";

import { useEffect, useRef, type FormEvent, type KeyboardEvent } from "react";

export function ChatInputBar({
  texto,
  setTexto,
  onEnviar,
  enviando,
  compact = false,
}: {
  texto: string;
  setTexto: (v: string) => void;
  onEnviar: (texto: string) => void;
  enviando: boolean;
  compact?: boolean;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Autoajusta el alto del textarea al texto escrito (estilo ChatGPT/Claude),
  // con un tope para que no se coma todo el panel en un mensaje largo.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, compact ? 96 : 128)}px`;
  }, [texto, compact]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onEnviar(texto);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onEnviar(texto);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={`shrink-0 border-t border-border ${compact ? "p-2.5" : "p-3 sm:p-4"}`}>
      <div
        className={`mx-auto flex items-end gap-2 rounded-2xl border border-border bg-background px-3 py-2 transition focus-within:border-accent ${compact ? "" : "max-w-2xl"}`}
      >
        <textarea
          ref={textareaRef}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder="Pregúntame sobre tu negocio..."
          className={`flex-1 resize-none bg-transparent py-1.5 text-sm text-foreground outline-none placeholder:text-muted ${compact ? "max-h-24" : "max-h-32"}`}
        />
        <button
          type="submit"
          disabled={!texto.trim() || enviando}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-white transition hover:bg-primary-hover disabled:opacity-40"
          aria-label="Enviar"
        >
          ➤
        </button>
      </div>
    </form>
  );
}

"use client";

import { useEffect, useRef, type FormEvent, type KeyboardEvent } from "react";
import { motion } from "motion/react";
import { SendHorizontal } from "lucide-react";

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
  const puedeEnviar = texto.trim().length > 0 && !enviando;

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
    <form
      onSubmit={handleSubmit}
      className={`shrink-0 border-t border-border bg-surface/70 backdrop-blur ${compact ? "p-2.5" : "p-3 sm:p-4"}`}
    >
      {/* Borde con degradado de la marca que aparece al escribir */}
      <div className={`group relative mx-auto rounded-2xl p-[1.5px] ${compact ? "" : "max-w-2xl"}`}>
        <span aria-hidden className="absolute inset-0 rounded-2xl bg-border" />
        <span
          aria-hidden
          className="animate-degradado absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-focus-within:opacity-100"
          style={{ backgroundImage: "linear-gradient(120deg, var(--primary), #facc15, var(--accent), var(--primary))" }}
        />
        <div className="relative flex items-end gap-2 rounded-[14px] bg-background px-3 py-2">
          <textarea
            ref={textareaRef}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder="Pregúntame sobre tu negocio..."
            className={`flex-1 resize-none bg-transparent py-1.5 text-sm text-foreground outline-none placeholder:text-muted ${compact ? "max-h-24" : "max-h-32"}`}
          />
          <motion.button
            type="submit"
            disabled={!puedeEnviar}
            aria-label="Enviar"
            animate={{ scale: puedeEnviar ? 1 : 0.9 }}
            whileHover={puedeEnviar ? { scale: 1.1, rotate: -8 } : undefined}
            whileTap={puedeEnviar ? { scale: 0.88 } : undefined}
            transition={{ type: "spring", stiffness: 420, damping: 20 }}
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white transition-[box-shadow,opacity] duration-300 ${
              puedeEnviar ? "shadow-[0_6px_16px_-6px_var(--primary)]" : "opacity-40"
            }`}
            style={{ backgroundImage: "linear-gradient(135deg, var(--primary), color-mix(in srgb, var(--primary) 55%, #ff8a3d))" }}
          >
            <SendHorizontal className="h-4 w-4" />
          </motion.button>
        </div>
      </div>
      {!compact && (
        <p className="mt-1.5 hidden text-center text-[10px] text-muted sm:block">
          Enter para enviar · Shift + Enter para un salto de línea
        </p>
      )}
    </form>
  );
}

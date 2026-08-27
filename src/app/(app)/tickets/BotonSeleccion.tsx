"use client";

export function BotonSeleccion({
  seleccionado,
  onClick,
  children,
}: {
  seleccionado: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-1 rounded-lg border-2 px-2 py-2.5 text-center transition-all duration-150 ${
        seleccionado
          ? "border-primary bg-primary/10 text-foreground shadow-md shadow-primary/10 scale-[1.03]"
          : "border-border bg-background text-muted hover:-translate-y-0.5 hover:border-primary/40 hover:text-foreground hover:shadow-sm"
      }`}
    >
      {children}
    </button>
  );
}

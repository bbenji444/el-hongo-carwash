"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { iniciarSesionConUsuario } from "./actions";

// API nativa del navegador para guardar/recuperar credenciales — soportada
// en Chrome/Edge, no en Firefox/Safari, por eso todo esto va detrás de
// comprobar que exista antes de usarla.
declare global {
  interface Window {
    PasswordCredential?: {
      new (data: { id: string; password: string; name?: string }): Credential;
    };
  }
  // TypeScript ya trae "mediation" en CredentialRequestOptions, pero no
  // "password" (esa parte del spec es más nueva que sus tipos de DOM).
  interface CredentialRequestOptions {
    password?: boolean;
  }
}

type CredencialGuardada = Credential & { id: string; password?: string };

const MOTIVOS: Record<string, string> = {
  cuenta_inactiva: "Tu cuenta fue desactivada. Contacta al dueño.",
};

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const motivo = searchParams.get("motivo");
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(motivo ? MOTIVOS[motivo] ?? null : null);
  const [loading, setLoading] = useState(false);

  // Si el navegador ya tiene una credencial guardada para este sitio (por
  // haber iniciado sesión antes), se rellenan solos correo y contraseña —
  // así no hay que volver a escribirlos cada vez. mediation "optional" deja
  // que el navegador decida si lo hace en silencio o pide confirmar.
  useEffect(() => {
    if (typeof window === "undefined" || !window.PasswordCredential || !navigator.credentials) return;
    navigator.credentials
      .get({ password: true, mediation: "optional" })
      .then((credencial) => {
        const c = credencial as CredencialGuardada | null;
        if (c && c.type === "password" && c.password) {
          setUsuario(c.id);
          setPassword(c.password);
        }
      })
      .catch(() => {
        // El usuario pudo haber cancelado el selector, o el navegador no
        // tiene nada guardado — no es un error real, se ignora.
      });
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: loginError } = await iniciarSesionConUsuario(usuario, password);

    if (loginError) {
      setError(loginError);
      setLoading(false);
      return;
    }

    // Le pide al navegador que guarde usuario+contraseña para la próxima vez
    // (equivalente a que aparezca el aviso de "¿Guardar contraseña?", pero
    // sin depender de que el navegador lo detecte solo en un login por
    // JavaScript en vez de un submit normal de formulario).
    if (window.PasswordCredential) {
      try {
        await navigator.credentials.store(new window.PasswordCredential({ id: usuario, password, name: usuario }));
      } catch {
        // Si el navegador lo rechaza (p. ej. el usuario ya dijo "nunca para
        // este sitio"), no es un error que deba bloquear el login.
      }
    }

    router.replace("/");
    router.refresh();
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      <div
        aria-hidden="true"
        className="animate-blob pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-primary/25 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="animate-blob pointer-events-none absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-accent/20 blur-3xl"
        style={{ animationDelay: "-7s" }}
      />

      <div className="relative w-full max-w-sm">
        <div className="animate-in mb-8 flex flex-col items-center gap-3">
          <Image
            src="/logo.jpg"
            alt="El Hongo Car Wash"
            width={140}
            height={140}
            className="rounded-full border-2 border-primary shadow-[0_0_30px_-5px_rgba(227,30,36,0.5)]"
            priority
          />
          <div className="text-center">
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              EL HONGO <span className="text-gradient-brand">CAR WASH</span>
            </h1>
            <p className="text-xs uppercase tracking-[0.2em] text-muted">Panel de administración</p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="animate-in flex flex-col gap-4 rounded-xl border border-border bg-surface p-6 shadow-xl"
          style={{ animationDelay: "80ms" }}
        >
          <div className="flex flex-col gap-1.5">
            <label htmlFor="usuario" className="text-sm font-medium text-muted">
              Usuario
            </label>
            <input
              id="usuario"
              name="usuario"
              type="text"
              required
              autoComplete="username"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2.5 text-foreground outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
              placeholder="Benjamin"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-sm font-medium text-muted">
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2.5 text-foreground outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm text-primary">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded-lg bg-primary px-4 py-2.5 font-semibold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <p className="animate-in mt-6 text-center text-xs text-muted" style={{ animationDelay: "160ms" }}>
          Acceso restringido. Las cuentas son creadas por el dueño.
        </p>
      </div>
    </main>
  );
}

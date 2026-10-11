import { inicioDeDiaMX, inicioDeMesMX, inicioDeDiaMXDesdeFecha, finDeDiaMXDesdeFecha } from "@/lib/fecha";

export type Periodo = "hoy" | "7d" | "30d" | "mes_actual" | "todo";

export const PERIODOS: { value: Periodo; label: string }[] = [
  { value: "hoy", label: "Hoy" },
  { value: "7d", label: "Últimos 7 días" },
  { value: "30d", label: "Últimos 30 días" },
  { value: "mes_actual", label: "Este mes" },
  { value: "todo", label: "Todo" },
];

export type ParamsRango = { periodo?: string; desde?: string; hasta?: string };

export type RangoResuelto = {
  desdeIso: string | null;
  hastaIso: string | null;
  personalizado: boolean;
  periodo: Periodo;
  etiqueta: string;
  // Valores crudos "YYYY-MM-DD" del filtro personalizado, para repoblar el
  // formulario y para armar el query string que reciben los exportadores.
  desdeInput: string;
  hastaInput: string;
};

function fechaLegible(fechaStr: string): string {
  const [anio, mes, dia] = fechaStr.split("-").map(Number);
  return new Date(anio, mes - 1, dia).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function resolverRango(params: ParamsRango): RangoResuelto {
  const desdeInput = params.desde ?? "";
  const hastaInput = params.hasta ?? "";
  const personalizado = Boolean(desdeInput || hastaInput);

  if (personalizado) {
    const desdeIso = desdeInput ? inicioDeDiaMXDesdeFecha(desdeInput).toISOString() : null;
    const hastaIso = hastaInput ? finDeDiaMXDesdeFecha(hastaInput).toISOString() : null;
    const etiqueta = `${desdeInput ? fechaLegible(desdeInput) : "el inicio"} al ${
      hastaInput ? fechaLegible(hastaInput) : "hoy"
    }`;
    return { desdeIso, hastaIso, personalizado, periodo: "todo", etiqueta, desdeInput, hastaInput };
  }

  const periodo: Periodo = PERIODOS.some((p) => p.value === params.periodo)
    ? (params.periodo as Periodo)
    : "hoy";

  let desdeIso: string | null;
  if (periodo === "hoy") {
    desdeIso = inicioDeDiaMX(0).toISOString();
  } else if (periodo === "7d") {
    desdeIso = inicioDeDiaMX(6).toISOString();
  } else if (periodo === "30d") {
    desdeIso = inicioDeDiaMX(29).toISOString();
  } else if (periodo === "mes_actual") {
    // Del día 1 del mes en curso (hora de México) a hoy — se detecta solo
    // según la fecha real, sin importar en qué mes estemos.
    desdeIso = inicioDeMesMX(0).toISOString();
  } else {
    desdeIso = null;
  }

  return {
    desdeIso,
    hastaIso: null,
    personalizado: false,
    periodo,
    etiqueta: PERIODOS.find((p) => p.value === periodo)!.label,
    desdeInput: "",
    hastaInput: "",
  };
}

export function queryStringRango(rango: RangoResuelto): string {
  const qs = new URLSearchParams();
  if (rango.personalizado) {
    if (rango.desdeInput) qs.set("desde", rango.desdeInput);
    if (rango.hastaInput) qs.set("hasta", rango.hastaInput);
  } else {
    qs.set("periodo", rango.periodo);
  }
  return qs.toString();
}

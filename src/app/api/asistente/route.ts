import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import { construirHerramientas } from "./herramientas";

export const runtime = "nodejs";

// Configurable por si el modelo se vuelve obsoleto más adelante, sin tener
// que tocar código — "mini" porque es un asistente de preguntas cortas,
// no necesita el modelo más grande ni caro.
const MODELO = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

const SYSTEM_PROMPT = `Eres el asistente de IA de El Hongo Car Wash, un car wash real. Respondes en español de México, de forma breve, amigable y directa, como si fueras parte del equipo del negocio.

Reglas muy importantes:
- NUNCA inventes cifras de ventas, gastos, lavadores ni ningún dato del negocio. Solo puedes dar números que vengan de una llamada a una herramienta.
- Si la pregunta necesita datos del negocio, SIEMPRE llama primero a la herramienta correspondiente antes de responder — nunca respondas con un número sin haber llamado una herramienta.
- El resultado de la herramienta (el JSON que te llega con role "tool") es siempre verdad — úsalo literal. Si un lavador tiene "autosLavados": 12, di 12, no "ninguno" ni "0". Si la lista viene vacía o todos los valores son 0, ESO sí significa que no hubo actividad — pero si hay números mayores a 0 en el JSON, repórtalos tal cual, nunca digas que no hay datos cuando sí los hay.
- Si no tienes una herramienta para contestar algo (o el resultado de la herramienta realmente no alcanza para responder), dilo con honestidad en vez de adivinar.
- Los montos son en pesos mexicanos. Redondea a 2 decimales al mencionarlos.
- Sé conciso: la mayoría de respuestas deben caber en 2-4 oraciones, salvo que te pidan un desglose explícito.`;

type MensajeEntrada = { rol: "usuario" | "asistente"; texto: string };

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Falta configurar OPENAI_API_KEY en el servidor." }, { status: 500 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sesión no válida." }, { status: 401 });
  }

  const { data: usuario } = await supabase.from("usuarios").select("nombre, rol").eq("id", user.id).maybeSingle();
  if (!usuario) {
    return NextResponse.json({ error: "Sesión no válida." }, { status: 401 });
  }

  // DIAGNÓSTICO TEMPORAL — para encontrar en qué paso se pierden los datos
  // (mismo cliente que ya autenticó arriba, para descartar que sea un
  // problema de RLS/sesión vs. un bug de lógica en la consulta compuesta).
  const [{ count: countTickets }, { count: countTicketLavadores }, { count: countPagos }] = await Promise.all([
    supabase.from("tickets").select("id", { count: "exact", head: true }).eq("estado", "entregado"),
    supabase.from("ticket_lavadores").select("ticket_id", { count: "exact", head: true }),
    supabase.from("pagos").select("ticket_id", { count: "exact", head: true }),
  ]);

  // Réplica exacta de la consulta con filtro de fecha que usa
  // ticketsLavadosEnRango (30 días) — esta vez SÍ revisando "error", que el
  // código original nunca revisa (solo hace `?? []`, así que un error ahí
  // se ve idéntico a "no hay tickets").
  const { resolverRango } = await import("@/lib/rangoFechas");
  const rango30d = resolverRango({ periodo: "30d" });
  const { data: ticketsConFecha, error: errorTicketsFecha } = await supabase
    .from("tickets")
    .select("id")
    .eq("estado", "entregado")
    .gte("hora_entrada", rango30d.desdeIso!);

  const debugDiagnostico = `userId=${user.id} tickets_entregados_total=${countTickets} ticket_lavadores_total=${countTicketLavadores} pagos_total=${countPagos} desdeIso_30d=${rango30d.desdeIso} tickets_con_filtro_fecha=${ticketsConFecha?.length ?? "null"} error_filtro_fecha=${errorTicketsFecha ? JSON.stringify(errorTicketsFecha) : "ninguno"}`;
  console.log("[asistente][diagnostico]", debugDiagnostico);

  let body: { mensajes?: MensajeEntrada[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  const mensajesEntrada = Array.isArray(body.mensajes) ? body.mensajes : [];
  // Tope de costo/seguridad: con las últimas ~12 vueltas sobra contexto
  // para este tipo de preguntas cortas, sin mandar conversaciones enormes
  // en cada llamada.
  const recientes = mensajesEntrada.slice(-12);

  const herramientas = construirHerramientas(usuario.rol !== "cajero");
  const herramientaPorNombre = new Map(herramientas.map((h) => [h.definicion.function.name, h]));

  const openai = new OpenAI({ apiKey });

  const mensajes: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: `${SYSTEM_PROMPT}\n\nLa persona que te escribe se llama ${usuario.nombre}.` },
    ...recientes.map((m) => ({
      role: m.rol === "usuario" ? ("user" as const) : ("assistant" as const),
      content: m.texto,
    })),
  ];

  try {
    const primera = await openai.chat.completions.create({
      model: MODELO,
      temperature: 0.3,
      messages: mensajes,
      tools: herramientas.map((h) => h.definicion),
    });

    const mensaje = primera.choices[0].message;

    if (!mensaje.tool_calls || mensaje.tool_calls.length === 0) {
      return NextResponse.json({ respuesta: mensaje.content ?? "No pude generar una respuesta." });
    }

    mensajes.push(mensaje);

    // DEBUG TEMPORAL — se quita en cuanto encontremos el bug de los datos
    // en 0. Se agrega al final de la respuesta lo que la herramienta
    // REALMENTE regresó, para verlo sin depender de los Logs de Vercel.
    const debugLlamadas: string[] = [];

    // Solo definimos herramientas de tipo "function" (no el tipo "custom"
    // más nuevo del SDK), así que toda llamada que recibamos de vuelta es
    // de ese tipo — se filtra explícito para que TypeScript lo sepa.
    for (const llamada of mensaje.tool_calls) {
      if (llamada.type !== "function") continue;

      const herramienta = herramientaPorNombre.get(llamada.function.name);
      let resultado: unknown;
      if (!herramienta) {
        resultado = { error: "Esa herramienta no está disponible para tu rol." };
      } else {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(llamada.function.arguments || "{}");
        } catch {
          args = {};
        }
        try {
          resultado = await herramienta.ejecutar(args);
          console.log(`[asistente] ${llamada.function.name}(${JSON.stringify(args)}) ->`, JSON.stringify(resultado).slice(0, 2000));
        } catch (err) {
          console.error(`Error ejecutando la herramienta ${llamada.function.name}:`, err);
          resultado = { error: "No se pudo consultar ese dato en este momento." };
        }
      }
      debugLlamadas.push(`${llamada.function.name}(${llamada.function.arguments}) -> ${JSON.stringify(resultado)}`);
      mensajes.push({
        role: "tool",
        tool_call_id: llamada.id,
        content: JSON.stringify(resultado),
      });
    }

    const segunda = await openai.chat.completions.create({
      model: MODELO,
      temperature: 0.3,
      messages: mensajes,
    });

    const respuestaFinal = segunda.choices[0].message.content ?? "No pude generar una respuesta.";
    const conDebug = `${respuestaFinal}\n\n---\n🔧 DEBUG:\n${debugDiagnostico}\n${debugLlamadas.join("\n")}`;

    return NextResponse.json({ respuesta: conDebug });
  } catch (err) {
    console.error("Error del asistente de IA:", err);
    return NextResponse.json(
      { error: "Hubo un problema al conectar con el asistente. Intenta de nuevo en un momento." },
      { status: 500 }
    );
  }
}

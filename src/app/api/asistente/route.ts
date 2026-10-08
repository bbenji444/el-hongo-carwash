import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import { construirHerramientas } from "./herramientas";

export const runtime = "nodejs";

// Configurable por si el modelo se vuelve obsoleto más adelante, sin tener
// que tocar código — "mini" porque es un asistente de preguntas cortas,
// no necesita el modelo más grande ni caro.
const MODELO = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

function construirSystemPrompt(hoyTexto: string, hoyFecha: string) {
  return `Eres el asistente de IA de El Hongo Car Wash, un car wash real. Respondes en español de México, de forma breve, amigable y directa, como si fueras parte del equipo del negocio.

Hoy es ${hoyTexto} (fecha ${hoyFecha}, zona horaria de México). Úsala para calcular cualquier rango de fechas que te pidan.

Reglas muy importantes:
- NUNCA inventes cifras de ventas, gastos, lavadores ni ningún dato del negocio. Solo puedes dar números que vengan de una llamada a una herramienta.
- Si la pregunta necesita datos del negocio, SIEMPRE llama primero a la herramienta correspondiente antes de responder — nunca respondas con un número sin haber llamado una herramienta.
- Las herramientas de fecha aceptan periodo "hoy", "7d", "30d", "todo", o "personalizado" con "desde"/"hasta" (YYYY-MM-DD). Si te piden un período que NO es exactamente uno de esos cuatro atajos — un mes del calendario (ej. "octubre"), una semana específica, "los últimos N días" con N distinto de 7/30, "ayer", etc. — SIEMPRE usa "personalizado" y calcula tú mismo las fechas exactas a partir de hoy. Nunca aproximes con el atajo más parecido y describas el resultado como si fuera el período que te pidieron.
- Si usas "personalizado", SIEMPRE manda tanto "desde" como "hasta" explícitos — nunca dejes "hasta" sin poner. Para un mes ya terminado, "hasta" es el último día de ese mes. Para un mes en curso o "hasta hoy", "hasta" es la fecha de hoy.
- CONFIRMA siempre el período exacto que usaste: empieza tu respuesta indicando el rango de fechas real (usa el campo "periodo" que te regresó la herramienta), antes de dar el número — así la persona puede verificar que es lo que quería preguntar. Ejemplo: "Del 1 al 30 de septiembre: ...". No repitas las palabras exactas de la pregunta si el período que de verdad consultaste es otro.
- Tienes herramientas separadas para gastos por CATEGORÍA general (gastos_por_categoria), por PRODUCTO específico (gastos_por_producto), y por NÓMINA/SUELDO de cada lavador (nomina_por_lavador) — son cosas distintas, usa la(s) que de verdad respondan la pregunta. Si preguntan "en qué producto gasto más" es gastos_por_producto; si preguntan cuánto se le ha pagado a alguien es nomina_por_lavador.
- Para preguntas que comparan sueldo fijo vs comisión, o piden un análisis combinado de un lavador (ventas + lo que se le paga), llama VARIAS herramientas en la misma respuesta (ej. rendimiento_lavadores Y nomina_por_lavador) y combina sus resultados — no digas que no tienes la información sin antes revisar si otra herramienta de la lista la tiene.
- SÍ puedes hacer cuentas simples tú mismo (sumas, porcentajes, comparaciones, diferencias) a partir de números que vengan de una herramienta — eso no es "inventar", es matemática sobre datos reales. Lo que nunca debes hacer es inventar el número base.
- El resultado de la herramienta (el JSON que te llega con role "tool") es siempre verdad — úsalo literal. Si un valor es 12, di 12, no "ninguno" ni "0", y no lo cambies entre una respuesta y otra para la misma pregunta. Si la lista viene vacía o todos los valores son 0, ESO sí significa que no hubo actividad — pero si hay números mayores a 0 en el JSON, repórtalos tal cual, nunca digas que no hay datos cuando sí los hay.
- Si preguntan sobre auditoría, quién hizo qué, cuántas veces entró alguien a algo, o en qué ha estado consultando cada quien, usa consultar_historial — nunca inventes quién hizo una acción ni cuántas veces.
- Si de verdad no tienes una herramienta para contestar algo (revisa bien la lista completa de herramientas disponibles primero, incluyendo combinarlas), dilo con honestidad en vez de adivinar o dar un número de una herramienta que no es la correcta.
- Los montos son en pesos mexicanos. Redondea a 2 decimales al mencionarlos.
- Sé conciso: la mayoría de respuestas deben caber en 2-4 oraciones, salvo que te pidan un desglose explícito.`;
}

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

  const { data: usuario } = await supabase
    .from("usuarios")
    .select("nombre, rol, puede_ver_historial")
    .eq("id", user.id)
    .maybeSingle();
  if (!usuario) {
    return NextResponse.json({ error: "Sesión no válida." }, { status: 401 });
  }

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

  const herramientas = construirHerramientas(usuario.rol !== "cajero", usuario.puede_ver_historial);
  const herramientaPorNombre = new Map(herramientas.map((h) => [h.definicion.function.name, h]));

  const openai = new OpenAI({ apiKey });

  const hoyTexto = new Date().toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Mexico_City",
  });
  const hoyFecha = new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" }); // YYYY-MM-DD
  const systemPrompt = construirSystemPrompt(hoyTexto, hoyFecha);

  const mensajes: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: `${systemPrompt}\n\nLa persona que te escribe se llama ${usuario.nombre}.` },
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
        } catch (err) {
          console.error(`Error ejecutando la herramienta ${llamada.function.name}:`, err);
          resultado = { error: "No se pudo consultar ese dato en este momento." };
        }
      }
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

    return NextResponse.json({ respuesta: segunda.choices[0].message.content ?? "No pude generar una respuesta." });
  } catch (err) {
    console.error("Error del asistente de IA:", err);
    return NextResponse.json(
      { error: "Hubo un problema al conectar con el asistente. Intenta de nuevo en un momento." },
      { status: 500 }
    );
  }
}

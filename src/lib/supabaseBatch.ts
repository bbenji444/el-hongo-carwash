// Dos problemas del mismo origen, que ya causaron bugs reales (ventas y
// lavadores en 0 con suficiente volumen de tickets):
//
// 1. PostgREST trae máximo 1000 renglones por consulta si no se pagina
//    explícito — pasado ese punto, los renglones de más allá simplemente
//    desaparecen, sin ningún error.
// 2. Un .in("columna", ids) con miles de ids arma una URL kilométrica que
//    PostgREST puede rechazar — y si el código no revisa "error" (solo
//    hace "?? []"), una petición así de fallida se ve idéntica a "no hay
//    datos".
//
// Estas dos funciones son el reemplazo estándar para cualquier consulta
// sobre una tabla que pueda crecer sin límite (tickets, pagos,
// ticket_lavadores, gastos, etc.) — nunca una select() ni un .in() directo
// sin pasar por aquí.

const TAMANO_PAGINA_DEFAULT = 1000;
const TAMANO_LOTE_IN_DEFAULT = 200;

type ResultadoConsulta<T> = { data: T[] | null; error: unknown };

// Pagina una consulta completa pidiendo página tras página con .range(),
// hasta que una página regresa menos filas de las pedidas (fin de los
// datos) o se alcanza "maxFilas" (tope opcional, para búsquedas que a
// propósito no quieren traer una tabla completa sin filtrar).
// "construirQuery" arma la consulta para un rango [desde, hasta].
export async function fetchPaginado<T>(
  construirQuery: (desde: number, hasta: number) => PromiseLike<ResultadoConsulta<T>>,
  tamanoPagina = TAMANO_PAGINA_DEFAULT,
  maxFilas?: number
): Promise<T[]> {
  const resultado: T[] = [];
  for (let desde = 0; ; desde += tamanoPagina) {
    const hasta = maxFilas ? Math.min(desde + tamanoPagina - 1, maxFilas - 1) : desde + tamanoPagina - 1;
    const { data } = await construirQuery(desde, hasta);
    resultado.push(...(data ?? []));
    const pedidas = hasta - desde + 1;
    if (!data || data.length < pedidas) break;
    if (maxFilas && resultado.length >= maxFilas) break;
  }
  return resultado;
}

// Manda un .in(columna, ids) en lotes chicos en paralelo, en vez de una
// sola llamada con todos los ids juntos, y junta los resultados.
export async function fetchEnLotes<T>(
  ids: string[],
  construirQuery: (lote: string[]) => PromiseLike<ResultadoConsulta<T>>,
  tamanoLote = TAMANO_LOTE_IN_DEFAULT
): Promise<T[]> {
  if (ids.length === 0) return [];
  const lotes: string[][] = [];
  for (let i = 0; i < ids.length; i += tamanoLote) lotes.push(ids.slice(i, i + tamanoLote));
  const resultados = await Promise.all(lotes.map((lote) => construirQuery(lote)));
  return resultados.flatMap((r) => r.data ?? []);
}

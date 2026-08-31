import { Document, Page, Text, View, Image, StyleSheet, Font } from "@react-pdf/renderer";
import type { DatosReporte } from "../../data";
import { logoBuffer } from "@/lib/logoPdf";

// Sin esto, react-pdf parte palabras largas a la mitad al justificar texto
// dentro de cajas angostas (p. ej. "ENTREGA-DOS"); con el callback identidad
// solo puede saltar de línea entre palabras completas.
Font.registerHyphenationCallback((word) => [word]);

const ROJO = "#e31e24";
const VERDE = "#16a34a";
const GRIS_TEXTO = "#3a3a3a";
const GRIS_MUTED = "#767676";
const BORDE = "#e2e2e0";
const FONDO_SUAVE = "#f7f5f4";

const styles = StyleSheet.create({
  page: {
    padding: 32,
    fontSize: 9,
    color: GRIS_TEXTO,
    fontFamily: "Helvetica",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
    paddingBottom: 12,
    borderBottom: `2 solid ${ROJO}`,
  },
  headerMarca: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  logo: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  marca: {
    fontSize: 18,
    fontWeight: 700,
    color: ROJO,
  },
  marcaSub: {
    fontSize: 8,
    color: GRIS_MUTED,
    marginTop: 2,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  metaBox: {
    alignItems: "flex-end",
  },
  metaTitulo: {
    fontSize: 12,
    fontWeight: 700,
    color: GRIS_TEXTO,
  },
  metaLinea: {
    fontSize: 8,
    color: GRIS_MUTED,
    marginTop: 2,
  },
  resumenFila: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  resumenCaja: {
    flex: 1,
    borderRadius: 4,
    border: `1 solid ${BORDE}`,
    backgroundColor: FONDO_SUAVE,
    padding: 8,
  },
  resumenLabel: {
    fontSize: 7,
    color: GRIS_MUTED,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  resumenValor: {
    fontSize: 13,
    fontWeight: 700,
    color: GRIS_TEXTO,
    marginTop: 3,
  },
  resumenValorRojo: {
    color: ROJO,
  },
  resumenValorVerde: {
    color: VERDE,
  },
  seccion: {
    marginBottom: 16,
  },
  seccionTitulo: {
    fontSize: 11,
    fontWeight: 700,
    color: GRIS_TEXTO,
    marginBottom: 6,
  },
  tabla: {
    border: `1 solid ${BORDE}`,
    borderRadius: 4,
    overflow: "hidden",
  },
  filaEncabezado: {
    flexDirection: "row",
    backgroundColor: ROJO,
  },
  fila: {
    flexDirection: "row",
    borderTop: `1 solid ${BORDE}`,
  },
  filaAlterna: {
    backgroundColor: FONDO_SUAVE,
  },
  celdaEncabezado: {
    padding: 5,
    fontSize: 8,
    fontWeight: 700,
    color: "#ffffff",
    textTransform: "uppercase",
  },
  celda: {
    padding: 5,
    fontSize: 8,
  },
  celdaMuted: {
    padding: 5,
    fontSize: 8,
    color: GRIS_MUTED,
  },
  celdaRoja: {
    padding: 5,
    fontSize: 8,
    color: ROJO,
    fontWeight: 700,
  },
  vacio: {
    padding: 10,
    textAlign: "center",
    fontSize: 8,
    color: GRIS_MUTED,
  },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 32,
    right: 32,
    textAlign: "center",
    fontSize: 7,
    color: GRIS_MUTED,
    borderTop: `1 solid ${BORDE}`,
    paddingTop: 6,
  },
});

function money(n: number) {
  return `$${n.toFixed(2)}`;
}

const METODO_LABEL: Record<string, string> = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  transferencia: "Transferencia",
};

export function ReportePdf({ datos }: { datos: DatosReporte }) {
  const generado = new Date(datos.generadoEn).toLocaleString("es-MX", {
    dateStyle: "long",
    timeStyle: "short",
  });

  return (
    <Document title={`Reporte El Hongo Car Wash — ${datos.rango.etiqueta}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.headerMarca}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer's Image, not an HTML img */}
            <Image src={logoBuffer()} style={styles.logo} />
            <View>
              <Text style={styles.marca}>EL HONGO CAR WASH</Text>
              <Text style={styles.marcaSub}>Reporte de ventas y caja</Text>
            </View>
          </View>
          <View style={styles.metaBox}>
            <Text style={styles.metaTitulo}>Período: {datos.rango.etiqueta}</Text>
            <Text style={styles.metaLinea}>Generado el {generado}</Text>
          </View>
        </View>

        <View style={styles.resumenFila}>
          <View style={styles.resumenCaja}>
            <Text style={styles.resumenLabel}>Ventas totales</Text>
            <Text style={styles.resumenValor}>{money(datos.ventasTotales)}</Text>
          </View>
          <View style={styles.resumenCaja}>
            <Text style={styles.resumenLabel}>Tickets</Text>
            <Text style={styles.resumenValor}>{datos.numTickets}</Text>
          </View>
          <View style={styles.resumenCaja}>
            <Text style={styles.resumenLabel}>Ticket promedio</Text>
            <Text style={styles.resumenValor}>{money(datos.ticketPromedio)}</Text>
          </View>
          <View style={styles.resumenCaja}>
            <Text style={styles.resumenLabel}>Descuentos</Text>
            <Text style={styles.resumenValor}>{money(datos.totalDescuentos)}</Text>
          </View>
          <View style={styles.resumenCaja}>
            <Text style={styles.resumenLabel}>Diferencia de caja</Text>
            <Text
              style={[styles.resumenValor, datos.diferenciaAcumulada !== 0 ? styles.resumenValorRojo : undefined]}
            >
              {money(datos.diferenciaAcumulada)}
            </Text>
          </View>
        </View>

        <View style={styles.resumenFila}>
          <View style={styles.resumenCaja}>
            <Text style={styles.resumenLabel}>Gastos</Text>
            <Text style={[styles.resumenValor, styles.resumenValorRojo]}>{money(datos.totalGastos)}</Text>
          </View>
          <View style={styles.resumenCaja}>
            <Text style={styles.resumenLabel}>Ganancia neta</Text>
            <Text style={[styles.resumenValor, styles.resumenValorVerde]}>{money(datos.gananciaNeta)}</Text>
          </View>
        </View>

        <View style={styles.seccion}>
          <Text style={styles.seccionTitulo}>Ventas por método de pago</Text>
          <View style={styles.tabla}>
            <View style={styles.filaEncabezado}>
              <Text style={[styles.celdaEncabezado, { flex: 2 }]}>Método</Text>
              <Text style={[styles.celdaEncabezado, { flex: 1 }]}>Total</Text>
            </View>
            {Object.entries(datos.ventasPorMetodo).map(([metodo, total], i) => (
              <View key={metodo} style={[styles.fila, i % 2 === 1 ? styles.filaAlterna : undefined]}>
                <Text style={[styles.celda, { flex: 2 }]}>{METODO_LABEL[metodo] ?? metodo}</Text>
                <Text style={[styles.celda, { flex: 1 }]}>{money(total)}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.seccion}>
          <Text style={styles.seccionTitulo}>Ventas por paquete</Text>
          <View style={styles.tabla}>
            <View style={styles.filaEncabezado}>
              <Text style={[styles.celdaEncabezado, { flex: 3 }]}>Paquete</Text>
              <Text style={[styles.celdaEncabezado, { flex: 1 }]}>Tickets</Text>
              <Text style={[styles.celdaEncabezado, { flex: 1.5 }]}>Ventas</Text>
            </View>
            {datos.ventasPorServicio.map((v, i) => (
              <View key={v.nombre} style={[styles.fila, i % 2 === 1 ? styles.filaAlterna : undefined]}>
                <Text style={[styles.celda, { flex: 3 }]}>{v.nombre}</Text>
                <Text style={[styles.celdaMuted, { flex: 1 }]}>{v.tickets}</Text>
                <Text style={[styles.celda, { flex: 1.5 }]}>{money(v.total)}</Text>
              </View>
            ))}
            {datos.ventasPorServicio.length === 0 && <Text style={styles.vacio}>Sin ventas en este período.</Text>}
          </View>
        </View>

        <View style={styles.seccion} wrap={false}>
          <Text style={styles.seccionTitulo}>Descuentos otorgados</Text>
          <View style={styles.tabla}>
            <View style={styles.filaEncabezado}>
              <Text style={[styles.celdaEncabezado, { flex: 1.6 }]}>Fecha</Text>
              <Text style={[styles.celdaEncabezado, { flex: 1.6 }]}>Paquete</Text>
              <Text style={[styles.celdaEncabezado, { flex: 1.4 }]}>Cajero</Text>
              <Text style={[styles.celdaEncabezado, { flex: 1.4 }]}>Autorizó</Text>
              <Text style={[styles.celdaEncabezado, { flex: 1 }]}>Monto</Text>
            </View>
            {datos.descuentos.map((d, i) => (
              <View key={d.id} style={[styles.fila, i % 2 === 1 ? styles.filaAlterna : undefined]}>
                <Text style={[styles.celdaMuted, { flex: 1.6 }]}>
                  {new Date(d.fecha).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}
                </Text>
                <Text style={[styles.celda, { flex: 1.6 }]}>{d.servicio}</Text>
                <Text style={[styles.celda, { flex: 1.4 }]}>{d.empleado}</Text>
                <Text style={[styles.celda, { flex: 1.4 }]}>{d.autorizadoPor}</Text>
                <Text style={[styles.celdaRoja, { flex: 1 }]}>{money(d.monto)}</Text>
              </View>
            ))}
            {datos.descuentos.length === 0 && <Text style={styles.vacio}>Sin descuentos en este período.</Text>}
          </View>
        </View>

        <View style={styles.seccion} wrap={false}>
          <Text style={styles.seccionTitulo}>Gastos</Text>
          <View style={styles.tabla}>
            <View style={styles.filaEncabezado}>
              <Text style={[styles.celdaEncabezado, { flex: 1.4 }]}>Fecha</Text>
              <Text style={[styles.celdaEncabezado, { flex: 2 }]}>Concepto</Text>
              <Text style={[styles.celdaEncabezado, { flex: 2 }]}>Notas</Text>
              <Text style={[styles.celdaEncabezado, { flex: 1 }]}>Monto</Text>
            </View>
            {datos.gastos.map((g, i) => (
              <View key={g.id} style={[styles.fila, i % 2 === 1 ? styles.filaAlterna : undefined]}>
                <Text style={[styles.celdaMuted, { flex: 1.4 }]}>
                  {new Date(g.fecha).toLocaleDateString("es-MX")}
                </Text>
                <Text style={[styles.celda, { flex: 2 }]}>{g.concepto}</Text>
                <Text style={[styles.celdaMuted, { flex: 2 }]}>{g.notas ?? "—"}</Text>
                <Text style={[styles.celdaRoja, { flex: 1 }]}>{money(g.monto)}</Text>
              </View>
            ))}
            {datos.gastos.length === 0 && <Text style={styles.vacio}>Sin gastos en este período.</Text>}
          </View>
        </View>

        <View style={styles.seccion}>
          <Text style={styles.seccionTitulo}>Historial de cierres de turno</Text>
          <View style={styles.tabla}>
            <View style={styles.filaEncabezado}>
              <Text style={[styles.celdaEncabezado, { flex: 1.6 }]}>Cierre</Text>
              <Text style={[styles.celdaEncabezado, { flex: 1.2 }]}>Abrió</Text>
              <Text style={[styles.celdaEncabezado, { flex: 1.2 }]}>Cerró</Text>
              <Text style={[styles.celdaEncabezado, { flex: 1 }]}>Inicial</Text>
              <Text style={[styles.celdaEncabezado, { flex: 1 }]}>Esperado</Text>
              <Text style={[styles.celdaEncabezado, { flex: 1 }]}>Contado</Text>
              <Text style={[styles.celdaEncabezado, { flex: 1 }]}>Diferencia</Text>
              <Text style={[styles.celdaEncabezado, { flex: 1 }]}>Ganancia</Text>
            </View>
            {datos.turnos.map((t, i) => (
              <View key={t.id} style={[styles.fila, i % 2 === 1 ? styles.filaAlterna : undefined]}>
                <Text style={[styles.celdaMuted, { flex: 1.6 }]}>
                  {t.horaCierre
                    ? new Date(t.horaCierre).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })
                    : "—"}
                </Text>
                <Text style={[styles.celda, { flex: 1.2 }]}>{t.abrio}</Text>
                <Text style={[styles.celda, { flex: 1.2 }]}>{t.cerro}</Text>
                <Text style={[styles.celdaMuted, { flex: 1 }]}>{money(t.inicial)}</Text>
                <Text style={[styles.celdaMuted, { flex: 1 }]}>{t.esperado != null ? money(t.esperado) : "—"}</Text>
                <Text style={[styles.celdaMuted, { flex: 1 }]}>{t.contado != null ? money(t.contado) : "—"}</Text>
                <Text style={[t.alertaDiferencia ? styles.celdaRoja : styles.celda, { flex: 1 }]}>
                  {t.diferencia != null ? money(t.diferencia) : "—"}
                </Text>
                <Text style={[styles.celda, { flex: 1 }]}>{money(t.ganancia)}</Text>
              </View>
            ))}
            {datos.turnos.length === 0 && <Text style={styles.vacio}>Sin turnos cerrados en este período.</Text>}
          </View>
        </View>

        <Text
          style={styles.footer}
          fixed
          render={({ pageNumber, totalPages }) => `El Hongo Car Wash · Página ${pageNumber} de ${totalPages}`}
        />
      </Page>
    </Document>
  );
}

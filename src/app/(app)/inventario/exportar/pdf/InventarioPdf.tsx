import { Document, Page, Text, View, Image, StyleSheet, Font } from "@react-pdf/renderer";
import type { DatosInventario } from "../../data";
import { logoBuffer } from "@/lib/logoPdf";

Font.registerHyphenationCallback((word) => [word]);

const ROJO = "#e31e24";
const AMBAR = "#b45309";
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
  celdaAmbar: {
    padding: 5,
    fontSize: 8,
    color: AMBAR,
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

export function InventarioPdf({ datos }: { datos: DatosInventario }) {
  const generado = new Date(datos.generadoEn).toLocaleString("es-MX", {
    dateStyle: "long",
    timeStyle: "short",
  });

  return (
    <Document title="Reporte de inventario — El Hongo Car Wash">
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.headerMarca}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer's Image, not an HTML img */}
            <Image src={logoBuffer()} style={styles.logo} />
            <View>
              <Text style={styles.marca}>EL HONGO CAR WASH</Text>
              <Text style={styles.marcaSub}>Reporte de inventario</Text>
            </View>
          </View>
          <View style={styles.metaBox}>
            <Text style={styles.metaTitulo}>
              {datos.soloBajo ? "Solo insumos con stock bajo" : "Todos los insumos"}
            </Text>
            <Text style={styles.metaLinea}>Generado el {generado}</Text>
          </View>
        </View>

        <View style={styles.resumenFila}>
          <View style={styles.resumenCaja}>
            <Text style={styles.resumenLabel}>Insumos registrados</Text>
            <Text style={styles.resumenValor}>{datos.totalInsumos}</Text>
          </View>
          <View style={styles.resumenCaja}>
            <Text style={styles.resumenLabel}>Con stock bajo</Text>
            <Text style={[styles.resumenValor, datos.numBajo > 0 ? styles.resumenValorRojo : undefined]}>
              {datos.numBajo}
            </Text>
          </View>
          <View style={styles.resumenCaja}>
            <Text style={styles.resumenLabel}>Agotados</Text>
            <Text style={[styles.resumenValor, datos.numAgotados > 0 ? styles.resumenValorRojo : undefined]}>
              {datos.numAgotados}
            </Text>
          </View>
          <View style={styles.resumenCaja}>
            <Text style={styles.resumenLabel}>Valor total en inventario</Text>
            <Text style={styles.resumenValor}>{money(datos.valorTotalInventario)}</Text>
          </View>
        </View>

        <Text style={styles.seccionTitulo}>
          {datos.soloBajo ? "Insumos con stock bajo" : "Listado de insumos"}
        </Text>
        <View style={styles.tabla}>
          <View style={styles.filaEncabezado}>
            <Text style={[styles.celdaEncabezado, { flex: 3 }]}>Insumo</Text>
            <Text style={[styles.celdaEncabezado, { flex: 1.4 }]}>Stock actual</Text>
            <Text style={[styles.celdaEncabezado, { flex: 1.4 }]}>Stock mínimo</Text>
            <Text style={[styles.celdaEncabezado, { flex: 1.4 }]}>Costo unitario</Text>
            <Text style={[styles.celdaEncabezado, { flex: 1.4 }]}>Valor en stock</Text>
          </View>
          {datos.insumos.map((i, idx) => {
            const agotado = i.stock_actual <= 0;
            const bajo = !agotado && i.stock_actual <= i.stock_minimo;
            const estiloStock = agotado ? styles.celdaRoja : bajo ? styles.celdaAmbar : styles.celda;
            return (
              <View key={i.id} style={[styles.fila, idx % 2 === 1 ? styles.filaAlterna : undefined]}>
                <Text style={[styles.celda, { flex: 3 }]}>{i.nombre_insumo}</Text>
                <Text style={[estiloStock, { flex: 1.4 }]}>{i.stock_actual}</Text>
                <Text style={[styles.celdaMuted, { flex: 1.4 }]}>{i.stock_minimo}</Text>
                <Text style={[styles.celda, { flex: 1.4 }]}>{money(i.costo_unitario)}</Text>
                <Text style={[styles.celda, { flex: 1.4 }]}>{money(i.stock_actual * i.costo_unitario)}</Text>
              </View>
            );
          })}
          {datos.insumos.length === 0 && (
            <Text style={styles.vacio}>
              {datos.soloBajo ? "Ningún insumo tiene el stock bajo ahora mismo." : "Sin insumos registrados."}
            </Text>
          )}
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

import ExcelJS from "exceljs";
import type { DatosReporte } from "../../data";

const ROJO = "FFE31E24";
const GRIS_CLARO = "FFF7F5F4";
const BLANCO = "FFFFFFFF";
const FORMATO_MONEDA = '"$"#,##0.00';

const METODO_LABEL: Record<string, string> = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  transferencia: "Transferencia",
};

function estiloEncabezado(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: BLANCO } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ROJO } };
    cell.alignment = { vertical: "middle" };
  });
}

function sombrearFilasAlternas(hoja: ExcelJS.Worksheet) {
  hoja.eachRow((row, i) => {
    if (i > 1 && i % 2 === 0) {
      row.eachCell((c) => (c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GRIS_CLARO } }));
    }
  });
}

export function construirReporteExcel(datos: DatosReporte): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "El Hongo Car Wash";
  workbook.created = new Date();

  // --- Resumen ---
  const hojaResumen = workbook.addWorksheet("Resumen");
  hojaResumen.columns = [
    { key: "concepto", width: 28 },
    { key: "valor", width: 20 },
  ];
  hojaResumen.addRow(["EL HONGO CAR WASH — Reporte de ventas y caja"]);
  hojaResumen.mergeCells("A1:B1");
  hojaResumen.getCell("A1").font = { bold: true, size: 14, color: { argb: ROJO } };
  hojaResumen.addRow([`Período: ${datos.rango.etiqueta}`]);
  hojaResumen.mergeCells("A2:B2");
  hojaResumen.getCell("A2").font = { italic: true, color: { argb: "FF767676" } };
  hojaResumen.addRow([`Generado: ${new Date(datos.generadoEn).toLocaleString("es-MX")}`]);
  hojaResumen.mergeCells("A3:B3");
  hojaResumen.getCell("A3").font = { italic: true, color: { argb: "FF767676" } };
  hojaResumen.addRow([]);

  const filaEncabezadoResumen = hojaResumen.addRow(["Concepto", "Valor"]);
  estiloEncabezado(filaEncabezadoResumen);

  const filasResumen: [string, number][] = [
    ["Ventas totales", datos.ventasTotales],
    ["Tickets entregados", datos.numTickets],
    ["Ticket promedio", datos.ticketPromedio],
    ["Descuentos otorgados", datos.totalDescuentos],
    ["Tickets con descuento", datos.descuentos.length],
    ["Diferencia acumulada de caja", datos.diferenciaAcumulada],
    ["Turnos con diferencia", datos.turnosConAlerta],
  ];
  const conceptosMoneda = ["ventas totales", "ticket promedio", "descuentos otorgados", "diferencia acumulada de caja"];
  for (const [concepto, valor] of filasResumen) {
    const row = hojaResumen.addRow([concepto, valor]);
    if (conceptosMoneda.includes(concepto.toLowerCase())) {
      row.getCell(2).numFmt = FORMATO_MONEDA;
    }
  }

  hojaResumen.addRow([]);
  const filaEncabezadoMetodo = hojaResumen.addRow(["Ventas por método", "Total"]);
  estiloEncabezado(filaEncabezadoMetodo);
  for (const [metodo, total] of Object.entries(datos.ventasPorMetodo)) {
    const row = hojaResumen.addRow([METODO_LABEL[metodo] ?? metodo, total]);
    row.getCell(2).numFmt = FORMATO_MONEDA;
  }

  // --- Ventas por paquete ---
  const hojaServicios = workbook.addWorksheet("Ventas por paquete");
  hojaServicios.columns = [
    { header: "Paquete", key: "nombre", width: 28 },
    { header: "Tickets", key: "tickets", width: 12 },
    { header: "Ventas", key: "total", width: 16 },
  ];
  estiloEncabezado(hojaServicios.getRow(1));
  for (const v of datos.ventasPorServicio) {
    hojaServicios.addRow({ nombre: v.nombre, tickets: v.tickets, total: v.total });
  }
  hojaServicios.getColumn("total").numFmt = FORMATO_MONEDA;
  sombrearFilasAlternas(hojaServicios);

  // --- Descuentos ---
  const hojaDescuentos = workbook.addWorksheet("Descuentos");
  hojaDescuentos.columns = [
    { header: "Fecha", key: "fecha", width: 20 },
    { header: "Paquete", key: "servicio", width: 24 },
    { header: "Cajero", key: "empleado", width: 20 },
    { header: "Autorizó", key: "autorizadoPor", width: 20 },
    { header: "Monto", key: "monto", width: 14 },
  ];
  estiloEncabezado(hojaDescuentos.getRow(1));
  for (const d of datos.descuentos) {
    hojaDescuentos.addRow({
      fecha: new Date(d.fecha).toLocaleString("es-MX"),
      servicio: d.servicio,
      empleado: d.empleado,
      autorizadoPor: d.autorizadoPor,
      monto: d.monto,
    });
  }
  hojaDescuentos.getColumn("monto").numFmt = FORMATO_MONEDA;
  sombrearFilasAlternas(hojaDescuentos);

  // --- Cierres de turno ---
  const hojaTurnos = workbook.addWorksheet("Cierres de turno");
  hojaTurnos.columns = [
    { header: "Cierre", key: "cierre", width: 20 },
    { header: "Abrió", key: "abrio", width: 18 },
    { header: "Cerró", key: "cerro", width: 18 },
    { header: "Inicial", key: "inicial", width: 14 },
    { header: "Esperado", key: "esperado", width: 14 },
    { header: "Contado", key: "contado", width: 14 },
    { header: "Diferencia", key: "diferencia", width: 14 },
    { header: "Ganancia", key: "ganancia", width: 14 },
  ];
  estiloEncabezado(hojaTurnos.getRow(1));
  for (const t of datos.turnos) {
    const row = hojaTurnos.addRow({
      cierre: t.horaCierre ? new Date(t.horaCierre).toLocaleString("es-MX") : "—",
      abrio: t.abrio,
      cerro: t.cerro,
      inicial: t.inicial,
      esperado: t.esperado ?? null,
      contado: t.contado ?? null,
      diferencia: t.diferencia ?? null,
      ganancia: t.ganancia,
    });
    if (t.alertaDiferencia) {
      row.getCell("diferencia").font = { color: { argb: ROJO }, bold: true };
    }
  }
  (["inicial", "esperado", "contado", "diferencia", "ganancia"] as const).forEach((key) => {
    hojaTurnos.getColumn(key).numFmt = FORMATO_MONEDA;
  });
  sombrearFilasAlternas(hojaTurnos);

  return workbook;
}

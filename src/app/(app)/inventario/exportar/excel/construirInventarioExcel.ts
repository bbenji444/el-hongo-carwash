import ExcelJS from "exceljs";
import type { DatosInventario } from "../../data";

const ROJO = "FFE31E24";
const AMBAR = "FFB45309";
const GRIS_CLARO = "FFF7F5F4";
const BLANCO = "FFFFFFFF";
const FORMATO_MONEDA = '"$"#,##0.00';

function estiloEncabezado(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: BLANCO } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ROJO } };
    cell.alignment = { vertical: "middle" };
  });
}

export function construirInventarioExcel(datos: DatosInventario): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "El Hongo Car Wash";
  workbook.created = new Date();

  const hojaResumen = workbook.addWorksheet("Resumen");
  hojaResumen.columns = [
    { key: "concepto", width: 28 },
    { key: "valor", width: 20 },
  ];
  hojaResumen.addRow(["EL HONGO CAR WASH — Reporte de inventario"]);
  hojaResumen.mergeCells("A1:B1");
  hojaResumen.getCell("A1").font = { bold: true, size: 14, color: { argb: ROJO } };
  hojaResumen.addRow([datos.soloBajo ? "Solo insumos con stock bajo" : "Todos los insumos"]);
  hojaResumen.mergeCells("A2:B2");
  hojaResumen.getCell("A2").font = { italic: true, color: { argb: "FF767676" } };
  hojaResumen.addRow([`Generado: ${new Date(datos.generadoEn).toLocaleString("es-MX")}`]);
  hojaResumen.mergeCells("A3:B3");
  hojaResumen.getCell("A3").font = { italic: true, color: { argb: "FF767676" } };
  hojaResumen.addRow([]);

  const filaEncabezadoResumen = hojaResumen.addRow(["Concepto", "Valor"]);
  estiloEncabezado(filaEncabezadoResumen);
  hojaResumen.addRow(["Insumos registrados", datos.totalInsumos]);
  hojaResumen.addRow(["Con stock bajo", datos.numBajo]);
  hojaResumen.addRow(["Agotados", datos.numAgotados]);
  const filaValor = hojaResumen.addRow(["Valor total en inventario", datos.valorTotalInventario]);
  filaValor.getCell(2).numFmt = FORMATO_MONEDA;

  const hojaInsumos = workbook.addWorksheet(datos.soloBajo ? "Stock bajo" : "Insumos");
  hojaInsumos.columns = [
    { header: "Insumo", key: "nombre", width: 30 },
    { header: "Stock actual", key: "stockActual", width: 14 },
    { header: "Stock mínimo", key: "stockMinimo", width: 14 },
    { header: "Costo unitario", key: "costoUnitario", width: 16 },
    { header: "Valor en stock", key: "valorStock", width: 16 },
  ];
  estiloEncabezado(hojaInsumos.getRow(1));
  for (const i of datos.insumos) {
    const row = hojaInsumos.addRow({
      nombre: i.nombre_insumo,
      stockActual: i.stock_actual,
      stockMinimo: i.stock_minimo,
      costoUnitario: i.costo_unitario,
      valorStock: i.stock_actual * i.costo_unitario,
    });
    const agotado = i.stock_actual <= 0;
    const bajo = !agotado && i.stock_actual <= i.stock_minimo;
    if (agotado) {
      row.getCell("stockActual").font = { color: { argb: ROJO }, bold: true };
    } else if (bajo) {
      row.getCell("stockActual").font = { color: { argb: AMBAR }, bold: true };
    }
  }
  hojaInsumos.getColumn("costoUnitario").numFmt = FORMATO_MONEDA;
  hojaInsumos.getColumn("valorStock").numFmt = FORMATO_MONEDA;
  hojaInsumos.eachRow((row, i) => {
    if (i > 1 && i % 2 === 0) {
      row.eachCell((c) => (c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GRIS_CLARO } }));
    }
  });

  return workbook;
}

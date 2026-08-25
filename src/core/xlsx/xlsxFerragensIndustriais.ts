import ExcelJS from "exceljs";
import type { ProjectIndustrialFerragens } from "../industriais/buildIndustrialFerragensForProject";
import {
  assertIndustrialOutputAuthorized,
  registerIndustrialRequiredArtifact,
} from "../industrial/industrialOutputGuard";

/** Sem coluna Caixa (embutida no nome completo); N QR = buildIndustrialId. */
const HEADERS = [
  "Peça",
  "Ferragem",
  "Qtd",
  "Material",
  "N QR",
  "Observações",
] as const;

const BORDER_STYLE: Partial<ExcelJS.Border> = {
  style: "thin",
  color: { argb: "FF000000" },
};

function applyGridStyle(cell: ExcelJS.Cell): void {
  cell.border = {
    top: BORDER_STYLE,
    left: BORDER_STYLE,
    bottom: BORDER_STYLE,
    right: BORDER_STYLE,
  };
  cell.font = { name: "Calibri", size: 11, color: { argb: "FF000000" } };
}

function autofitColumns(sheet: ExcelJS.Worksheet): void {
  sheet.columns.forEach((column) => {
    let maxLength = 10;
    column.eachCell?.({ includeEmpty: true }, (cell) => {
      const value = cell.value == null ? "" : String(cell.value);
      maxLength = Math.max(maxLength, value.length + 2);
    });
    column.width = Math.min(maxLength, 48);
  });
}

export async function buildFerragensIndustriaisXlsxBuffer(
  data: ProjectIndustrialFerragens
): Promise<ArrayBuffer> {
  assertIndustrialOutputAuthorized("xlsx-ferragens-industriais");

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "PIMO";
  workbook.created = new Date(data.generatedAt);
  const sheet = workbook.addWorksheet("Ferragens Industriais", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  const headerRow = sheet.addRow([...HEADERS]);
  headerRow.eachCell((cell) => {
    applyGridStyle(cell);
    cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FF000000" } };
  });

  const bodyRows =
    data.rows.length > 0
      ? data.rows.map((row) => [
          row.peca,
          row.ferragem,
          row.qtd,
          row.material,
          row.nQr,
          row.observacoes,
        ])
      : [["—", "Sem ferragens", 0, "—", "—", "—"]];

  for (const values of bodyRows) {
    const row = sheet.addRow(values);
    row.eachCell((cell) => applyGridStyle(cell));
  }

  autofitColumns(sheet);

  const buffer = await workbook.xlsx.writeBuffer();
  registerIndustrialRequiredArtifact("xlsx-ferragens-industriais");
  return buffer;
}
